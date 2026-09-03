import {
  CLAIM_METHOD_RULES,
  CLAIM_STATUS_LABEL,
  matchesOfficialDomain,
  type ClaimMethod,
  type ClaimStatus,
} from '@weddingpick/domain';

import { loadConfig } from './config';
import { newEventId, recordDecision, requireOperator } from './decisions';
import { createPool, withTransaction } from './db';
import { notify } from './notify';

/**
 * 업체 관계자 인증 심사 도구. 최종통합정책 v2.0 26·27번.
 *
 * **자동 승인은 없다.** 이메일 도메인이 업체 공식 도메인과 같다는 것은 그 회사의
 * 주소라는 뜻이지, 신청한 사람이 그 주소를 쓴다는 뜻이 아니다. 도메인은 사람이
 * 먼저 보는 재료이고, 연락해 확인하는 것은 사람이 한다.
 *
 *   npm run vendor-claims --workspace @weddingpick/api -- --list
 *   npm run vendor-claims --workspace @weddingpick/api -- --show <id>
 *   npm run vendor-claims --workspace @weddingpick/api -- --approve <id> --by <user-id> \
 *     --note "공식 도메인 주소로 회신 확인"
 *   npm run vendor-claims --workspace @weddingpick/api -- --reject <id> --by <user-id> \
 *     --note "..."
 *
 * `--show`는 증빙 원본을 열지 않는다. 어떤 종류의 증빙이 왔는지와, 연락할 주소가
 * 무엇인지까지만 보여준다 — 원본은 스토리지에 있고 보관기간 작업이 지운다.
 */

type Options = {
  list: boolean;
  show?: string;
  approve?: string;
  reject?: string;
  by?: string;
  note?: string;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { list: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--list') options.list = true;
    else if (arg === '--show') options.show = argv[++i];
    else if (arg === '--approve') options.approve = argv[++i];
    else if (arg === '--reject') options.reject = argv[++i];
    else if (arg === '--by') options.by = argv[++i];
    else if (arg === '--note') options.note = argv[++i];
  }

  return options;
}

const when = (at: Date): string => at.toISOString().slice(0, 16).replace('T', ' ');

export async function decide(
  pool: ReturnType<typeof createPool>,
  id: string,
  to: Exclude<ClaimStatus, 'pending'>,
  by: string,
  note: string
): Promise<void> {
  await withTransaction(pool, async (client) => {
    await requireOperator(client, by);

    const { rows } = await client.query<{
      status: ClaimStatus;
      claimant_user_id: string;
      vendor_id: string;
    }>(
      `SELECT status, claimant_user_id, vendor_id
       FROM structured.vendor_claims WHERE id = $1 FOR UPDATE`,
      [id]
    );

    const found = rows[0];

    if (!found) throw new Error('없는 신청이다.');

    if (found.status !== 'pending') {
      throw new Error(`이미 ${CLAIM_STATUS_LABEL[found.status]} 상태다.`);
    }

    if (found.claimant_user_id === by) {
      // 반론 심사와 같은 규칙이다. 자기 신청을 자기가 통과시킬 수는 없다.
      throw new Error('신청한 본인은 심사할 수 없다.');
    }

    await client.query(
      `UPDATE structured.vendor_claims
       SET status = $2::vendor_claim_status, decided_at = now(), decided_by = $3::uuid,
           decision_note = $4, updated_at = now()
       WHERE id = $1::uuid`,
      [id, to, by, note]
    );

    /*
     * 접수 때 규칙이 남긴 줄은 pending으로 열려 있다. 사람이 결론을 냈으니
     * 닫는다 — 안 그러면 `open_decisions`에 영영 남아, 정말 손이 필요한 것과
     * 끝난 것이 섞인다.
     */
    await client.query(
      `UPDATE structured.decisions
       SET execution_status = 'succeeded', updated_at = now()
       WHERE subject_kind = 'vendor_claim' AND subject_id = $1::uuid
         AND execution_status = 'pending'`,
      [id]
    );

    await recordDecision(client, {
      eventId: newEventId(),
      workflow: 'vendor_claim',
      step: 'decide',
      subjectKind: 'vendor_claim',
      subjectId: id,
      decider: { kind: 'human', userId: by },
      decision: to,
      reasonCode: to === 'approved' ? 'affiliation_verified' : 'not_verified',
      // 가리키기만 한다. 무엇으로 확인했는지는 note에 사람이 적는다(원문 27번).
      evidence: [{ kind: 'vendor', id: found.vendor_id }],
    });

    await notify(client, {
      userId: found.claimant_user_id,
      kind: 'notice',
      title:
        to === 'approved' ? '업체 관계자로 확인됐어요' : '업체 관계자 확인이 어려웠어요',
      body: note,
      targetId: found.vendor_id,
    });
  });

  console.log(
    to === 'approved'
      ? '확인했다. 이제 이 업체의 후기에 반론을 낼 때 관계자로 표시된다.'
      : '확인하지 못한 것으로 정했다. 사유는 신청한 사람에게 보인다.'
  );
}

export type PendingVendorClaim = {
  id: string;
  vendorName: string;
  claimedRole: string;
  method: ClaimMethod;
  createdAt: Date;
};

/** 확인 대기 신청 전부. 조회라 `requireOperator`를 부르지 않는다. */
export async function list(pool: ReturnType<typeof createPool>): Promise<PendingVendorClaim[]> {
  const { rows } = await pool.query<{
    id: string;
    vendor_name: string;
    claimed_role: string;
    method: ClaimMethod;
    created_at: Date;
  }>(
    `SELECT c.id, v.name AS vendor_name, c.claimed_role, c.method, c.created_at
     FROM structured.vendor_claims c
     JOIN structured.vendors v ON v.id = c.vendor_id
     WHERE c.status = 'pending'
     ORDER BY c.created_at`
  );

  return rows.map((row) => ({
    id: row.id,
    vendorName: row.vendor_name,
    claimedRole: row.claimed_role,
    method: row.method,
    createdAt: row.created_at,
  }));
}

export type VendorClaimDetail = {
  id: string;
  status: ClaimStatus;
  vendorName: string;
  officialDomain: string | null;
  claimedRole: string;
  method: ClaimMethod;
  contactEmail: string | null;
  listedAt: string | null;
  hasDocument: boolean;
  decisionNote: string | null;
  createdAt: Date;
};

/** 신청 하나의 상세. 조회라 `requireOperator`를 부르지 않는다. */
export async function show(
  pool: ReturnType<typeof createPool>,
  id: string
): Promise<VendorClaimDetail | null> {
  const { rows } = await pool.query<{
    id: string;
    status: ClaimStatus;
    vendor_name: string;
    official_domain: string | null;
    claimed_role: string;
    method: ClaimMethod;
    contact_email: string | null;
    listed_at: string | null;
    has_document: boolean;
    decision_note: string | null;
    created_at: Date;
  }>(
    `SELECT c.id, c.status, v.name AS vendor_name, v.official_domain,
            c.claimed_role, c.method, c.contact_email, c.listed_at,
            c.evidence_document_id IS NOT NULL AS has_document,
            c.decision_note, c.created_at
     FROM structured.vendor_claims c
     JOIN structured.vendors v ON v.id = c.vendor_id
     WHERE c.id = $1`,
    [id]
  );

  const found = rows[0];

  if (!found) return null;

  return {
    id: found.id,
    status: found.status,
    vendorName: found.vendor_name,
    officialDomain: found.official_domain,
    claimedRole: found.claimed_role,
    method: found.method,
    contactEmail: found.contact_email,
    listedAt: found.listed_at,
    hasDocument: found.has_document,
    decisionNote: found.decision_note,
    createdAt: found.created_at,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = createPool(loadConfig().databaseUrl);

  try {
    if (options.list) {
      const rows = await list(pool);

      if (rows.length === 0) {
        console.log('확인할 신청이 없다.');
        return;
      }

      console.log(`확인 대기 ${rows.length}건:`);
      for (const row of rows) {
        console.log(
          `  ${row.id}  ${row.vendorName}  ${row.claimedRole}  ` +
            `${CLAIM_METHOD_RULES[row.method].label}  ${when(row.createdAt)}`
        );
      }
      return;
    }

    if (options.show) {
      const found = await show(pool, options.show);

      if (!found) {
        console.error('없는 신청이다.');
        process.exitCode = 1;
        return;
      }

      console.log(`${found.id}  ${CLAIM_STATUS_LABEL[found.status]}  ${when(found.createdAt)}`);
      console.log(`  업체: ${found.vendorName}`);
      console.log(`  본인이 밝힌 소속: ${found.claimedRole}  ← 이걸 확인하는 것이 심사다`);
      console.log(`  수단: ${CLAIM_METHOD_RULES[found.method].label}`);

      if (found.contactEmail) {
        console.log(`  연락할 주소: ${found.contactEmail}`);
        console.log(`  업체 공식 도메인: ${found.officialDomain ?? '아직 모른다'}`);

        if (found.officialDomain === null) {
          console.log('  → 견줄 것이 없다. 공식 홈페이지를 확인해 도메인부터 적는다.');
        } else if (matchesOfficialDomain(found.contactEmail, found.officialDomain)) {
          console.log('  → 도메인이 같다. 다만 그 주소를 신청인이 쓰는지는 연락해 확인한다.');
        } else {
          console.log('  → 도메인이 다르다.');
        }
      }

      if (found.listedAt) console.log(`  공개돼 있다는 자리: ${found.listedAt}`);

      /*
       * 증빙은 왔는지만 말한다. 사업자등록증에는 대표자 이름과 주소가 적혀
       * 있고, 그걸 이 화면에 옮기면 로그에도 남는다(원문 27번).
       */
      if (found.hasDocument) {
        console.log('  사업자 관련 증빙: 첨부됨 (원본은 스토리지에서 본다)');
      }

      if (found.decisionNote) console.log(`  결정 사유: ${found.decisionNote}`);
      return;
    }

    if (!options.by) {
      console.error('결정한 사람(--by <user-id>)이 필요하다. 결론에는 사람이 남아야 한다.');
      process.exitCode = 1;
      return;
    }

    if (!options.note) {
      console.error(
        '왜 그렇게 결정했는지(--note)가 필요하다. 확인했을 때는 무엇으로 확인했는지, ' +
          '확인하지 못했을 때는 그 사유를 적는다. 신청한 사람이 이걸 읽는다.'
      );
      process.exitCode = 1;
      return;
    }

    if (options.approve) {
      await decide(pool, options.approve, 'approved', options.by, options.note);
      return;
    }

    if (options.reject) {
      await decide(pool, options.reject, 'rejected', options.by, options.note);
      return;
    }

    console.error('무엇을 할지 정해라: --list | --show | --approve | --reject');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

/*
 * CLI로 직접 실행했을 때만 돈다. 테스트가 이 파일에서 함수를 가져오면(require)
 * `require.main`이 테스트 러너를 가리키므로 여기 걸리지 않는다 — 안 걸리면
 * 테스트마다 실제 커넥션 풀을 만들고 빈 인자로 main()이 돌며 exitCode를
 * 조용히 오염시킨다.
 */
if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
