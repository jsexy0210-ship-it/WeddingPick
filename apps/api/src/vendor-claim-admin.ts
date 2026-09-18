import {
  CLAIM_METHOD_RULES,
  CLAIM_STATUS_LABEL,
  VENDOR_OFFICIAL_SOURCE,
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

    // 한 사건의 여러 단계가 나눠 쓴다(L장 B-3). 승인이면 심사 한 줄과 출처 승격 한 줄이
    // 같은 열쇠로 묶여, 나중에 「이 업체가 왜 공식이 됐나」를 한 번에 따라갈 수 있다.
    const eventId = newEventId();

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
      eventId,
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

    /*
     * 승인이 업체의 출처 표시를 올린다. 2026-09-15 대표 지시 —
     * 「업체 공식인증이란 업체 승인을 통해 수급한 이미지와 기타 정보들」.
     *
     * 지금까지 승인과 `vendors.source`가 이어져 있지 않았다. 승인 표(0038)와
     * `approved_vendor_claims` 뷰는 있는데 승인해도 업체는 `public_data`인 채였고,
     * 그래서 「공식인증된 업체」를 출처로 셀 수가 없었다.
     *
     * **같은 트랜잭션 안에서 한다.** 따로 하면 승인은 됐는데 출처만 안 올라간 업체가
     * 생기고, 그 업체는 앱 필터를 켜는 날 조용히 빠진다.
     *
     * **이미 `vendor_official`인 업체는 건드리지 않는다** — 둘째 · 셋째 관계자가
     * 승인될 때마다 `last_verified_at`이 밀리고 승격 기록이 또 쌓이는 것을 막는다.
     * 승격은 처음 한 번만 일어난 사건이다.
     *
     * `last_verified_at`을 함께 민다. 0001의 주석대로 출처와 마지막 확인일은 짝이고,
     * 방금 사람이 확인해서 출처가 바뀐 참이다.
     */
    if (to === 'approved') {
      // 업체 줄을 먼저 잠그고 이전 값을 읽는다. 이력에 「무엇에서 무엇으로」를 적어야
      // 하는데, UPDATE는 바뀌기 전 값을 돌려주지 않는다.
      const { rows: vendorRows } = await client.query<{ source: string }>(
        'SELECT source::text AS source FROM structured.vendors WHERE id = $1::uuid FOR UPDATE',
        [found.vendor_id]
      );

      const previousSource = vendorRows[0]!.source;

      if (previousSource !== VENDOR_OFFICIAL_SOURCE) {
        await client.query(
          `UPDATE structured.vendors
              SET source = $2::source_type, last_verified_at = now()
            WHERE id = $1::uuid`,
          [found.vendor_id, VENDOR_OFFICIAL_SOURCE]
        );

        /*
         * 0048이 이 자리를 위해 만들어 둔 원인 값이 `claim`이다 — 「업체 관계자
         * 인증(0038 vendor_claims) 후 수정」. 여태 아무도 쓰지 않았다.
         *
         * 운영자가 볼 수 있는 자리가 여기다. 업체 관리 화면의 변경 이력이
         * `vendor_change_log`를 그대로 그리므로, 화면을 고치지 않고도 승격이 보인다.
         */
        await client.query(
          `INSERT INTO structured.vendor_change_log
             (vendor_id, field_name, old_value, new_value, cause, changed_by, note)
           VALUES ($1::uuid, 'source', $2, $3, 'claim', $4::uuid, $5)`,
          [found.vendor_id, previousSource, VENDOR_OFFICIAL_SOURCE, by, `관계자 인증 승인 ${id}`]
        );

        /*
         * 올린 기록. 누가 · 언제 · 어느 신청 때문인지가 여기 남는다 — 때는
         * `decisions.created_at`, 사람은 `actor_user_id`, 신청은 evidence다.
         *
         * **되돌리지 않는다. 그 판단을 여기 적어 둔다.**
         *
         * 되돌릴 자리로 물은 것이 둘이었다.
         *
         *   ① 승인이 뒤집힌다(approved → rejected)
         *      **이 코드에 그 길이 없다.** 위에서 `status !== 'pending'`이면 바로
         *      막는다 — 한 번 결론이 난 신청은 다시 심사되지 않는다. 없는 길에
         *      되돌리기를 붙이면 돌지 않는 코드가 규칙처럼 읽힌다.
         *
         *   ② 마지막 승인 claim이 사라진다
         *      claim은 사람이 지우지 않는다. `claimant_user_id`의 ON DELETE CASCADE로
         *      **신청한 사람이 탈퇴하면** 사라진다(0038). 그때 업체를 `public_data`로
         *      내리면, 관계없는 사람의 탈퇴가 그 업체를 앱에서 없앤다.
         *
         * 승격은 **그때 일어난 일의 기록**이다. 운영자가 소속을 확인했고 그 확인을
         * 근거로 업체가 정보를 넘겼다는 사실은, 신청인이 계정을 지운다고 없던 일이
         * 되지 않는다. 되돌려야 할 일이 생기면 사유와 기록을 갖춘 운영자의 조작이어야
         * 하고, 다른 곳에서 딸려 오는 부수 효과여서는 안 된다.
         *
         * **되돌리기를 붙인다면** 남은 승인 claim부터 세야 한다 —
         * `officialVendorCondition(alias, 'approvedClaim')`이 그 조건이다. 한 업체에
         * 관계자가 여럿 승인될 수 있으므로, 하나 사라졌다고 0이 된 것이 아니다.
         * 이 자리는 대표님 결정이 필요해 비워 둔다.
         */
        await recordDecision(client, {
          eventId,
          workflow: 'vendor_claim',
          step: 'promote_source',
          subjectKind: 'vendor',
          subjectId: found.vendor_id,
          decider: { kind: 'human', userId: by },
          decision: VENDOR_OFFICIAL_SOURCE,
          reasonCode: 'affiliation_verified',
          // 어느 신청 때문에 올랐는지. 값이 아니라 가리키기만 한다.
          evidence: [{ kind: 'vendor_claim', id }],
        });
      }
    }

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

export type VendorClaimQueueRow = VendorClaimDetail & {
  /**
   * 낸 주소가 업체 공식 도메인과 같은가.
   *
   * **결론이 아니라 재료다**(0038) — 도메인이 같다는 것은 그 회사의 주소라는 뜻이지
   * 신청한 사람이 그 주소를 쓴다는 뜻이 아니다. 화면도 그렇게 적는다. 증빙으로 낸
   * 신청(`business_document`)은 견줄 주소 자체가 없으므로 `null`이다.
   */
  domainMatches: boolean | null;
};

/**
 * 관리자 화면(`/admin/biz-queue`)이 읽는 목록.
 *
 * `list`와 나눠 둔 이유 둘. 저쪽은 **확인 대기만** 세므로 대시보드의 숫자가 되고,
 * 여기는 처리가 끝난 것까지 보여줘야 한다 — 방금 승인한 건이 목록에서 사라지면
 * 운영자는 처리된 것인지 놓친 것인지 알 수 없다. 그리고 화면은 한 줄을 고르면
 * 곧바로 상세를 그리므로(따로 부르지 않는다) `show`가 주는 칸이 전부 필요하다.
 */
export async function queue(
  pool: ReturnType<typeof createPool>
): Promise<VendorClaimQueueRow[]> {
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
    /*
     * 확인 대기가 맨 위다. 그 다음은 최근 순 — 운영자가 할 일을 먼저 보고,
     * 그 아래에서 방금 무엇을 했는지 되짚는다.
     */
    `SELECT c.id, c.status, v.name AS vendor_name, v.official_domain,
            c.claimed_role, c.method, c.contact_email, c.listed_at,
            c.evidence_document_id IS NOT NULL AS has_document,
            c.decision_note, c.created_at
     FROM structured.vendor_claims c
     JOIN structured.vendors v ON v.id = c.vendor_id
     ORDER BY (c.status = 'pending') DESC, c.created_at DESC`
  );

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    vendorName: row.vendor_name,
    officialDomain: row.official_domain,
    claimedRole: row.claimed_role,
    method: row.method,
    contactEmail: row.contact_email,
    listedAt: row.listed_at,
    hasDocument: row.has_document,
    decisionNote: row.decision_note,
    createdAt: row.created_at,
    domainMatches:
      row.contact_email === null
        ? null
        : matchesOfficialDomain(row.contact_email, row.official_domain),
  }));
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
