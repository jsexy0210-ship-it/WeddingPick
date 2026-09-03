import { REBUTTAL_STATUS_LABEL, type RebuttalStatus } from '@weddingpick/domain';
import type { Pool } from 'pg';

import { loadConfig } from './config';
import { createPool } from './db';
import { decideRebuttal } from './rebuttal-decide';

/**
 * 업체 반론 심사 도구.
 *
 * **자동 게시는 없다.** 반론이 사람 없이 후기 옆에 붙으면, 업체라고 말하기만 하면
 * 누구나 남의 후기 아래에 글을 실을 수 있다. 사람이 이 명령으로 두 가지를 본다 —
 * 낸 사람이 정말 그 업체인지, 그리고 그 글이 반론인지.
 *
 *   npm run rebuttals --workspace @weddingpick/api -- --list
 *   npm run rebuttals --workspace @weddingpick/api -- --show <id>
 *   npm run rebuttals --workspace @weddingpick/api -- --publish <id> --by <user-id> \
 *     --note "사업자등록증으로 소속 확인"
 *   npm run rebuttals --workspace @weddingpick/api -- --reject <id> --by <user-id> \
 *     --note "..."
 *
 * `--by`는 결정한 사람의 사용자 id다. 스키마가 결론에 사람을 요구한다.
 *
 * 소속은 관계자 인증(v2.0 26번)이 확인한다. `--show`가 그 결과를 함께 보여주므로,
 * 인증을 마친 사람의 반론인지 아니면 아직 아무도 확인하지 않은 이름인지 심사하는
 * 사람이 먼저 안다. 인증이 없어도 실을 수는 있다 — 대신 `--note`에 무엇으로
 * 확인했는지 적는다. **적지 않으면 나중에 왜 실었는지 아무도 답할 수 없다.**
 */

type Options = {
  list: boolean;
  show?: string;
  publish?: string;
  reject?: string;
  by?: string;
  note?: string;
  withoutClaim: boolean;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { list: false, withoutClaim: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--list') options.list = true;
    else if (arg === '--show') options.show = argv[++i];
    else if (arg === '--publish') options.publish = argv[++i];
    else if (arg === '--reject') options.reject = argv[++i];
    else if (arg === '--by') options.by = argv[++i];
    else if (arg === '--note') options.note = argv[++i];
    else if (arg === '--without-claim') options.withoutClaim = true;
  }

  return options;
}

const when = (at: Date): string => at.toISOString().slice(0, 16).replace('T', ' ');

async function decide(
  pool: Pool,
  id: string,
  to: Exclude<RebuttalStatus, 'pending'>,
  by: string,
  note: string,
  withoutClaim = false
): Promise<void> {
  await decideRebuttal(pool, { id, to, by, note, withoutClaim });

  console.log(
    to === 'published'
      ? '게시했다. 이제 후기 아래에 함께 보인다.'
      : '게시하지 않기로 했다. 사유는 낸 사람에게 보인다.'
  );
}

export type PendingRebuttal = {
  id: string;
  claimedRole: string;
  vendorName: string;
  createdAt: Date;
};

/** 확인 대기 반론 전부. 조회라 `requireOperator`를 부르지 않는다. */
export async function list(pool: Pool): Promise<PendingRebuttal[]> {
  const { rows } = await pool.query<{
    id: string;
    claimed_role: string;
    vendor_name: string;
    created_at: Date;
  }>(
    `SELECT b.id, b.claimed_role, v.name AS vendor_name, b.created_at
     FROM structured.review_rebuttals b
     JOIN structured.reviews r ON r.id = b.review_id
     JOIN structured.vendors v ON v.id = r.vendor_id
     WHERE b.status = 'pending'
     ORDER BY b.created_at`
  );

  return rows.map((row) => ({
    id: row.id,
    claimedRole: row.claimed_role,
    vendorName: row.vendor_name,
    createdAt: row.created_at,
  }));
}

export type RebuttalDetail = {
  id: string;
  status: RebuttalStatus;
  claimedRole: string;
  body: string;
  decisionNote: string | null;
  createdAt: Date;
  vendorName: string;
  reviewTitle: string;
  reviewBody: string;
  reviewOverall: number;
  verifiedRole: string | null;
};

/** 반론 하나의 상세. 조회라 `requireOperator`를 부르지 않는다. */
export async function show(pool: Pool, id: string): Promise<RebuttalDetail | null> {
  const { rows } = await pool.query<{
    id: string;
    status: RebuttalStatus;
    claimed_role: string;
    body: string;
    decision_note: string | null;
    created_at: Date;
    vendor_name: string;
    review_title: string;
    review_body: string;
    review_overall: number;
    verified_role: string | null;
  }>(
    `SELECT b.id, b.status, b.claimed_role, b.body, b.decision_note, b.created_at,
            v.name AS vendor_name, r.title AS review_title, r.body AS review_body,
            r.overall AS review_overall,
            (SELECT c.claimed_role
             FROM structured.approved_vendor_claims c
             WHERE c.vendor_id = r.vendor_id
               AND c.claimant_user_id = b.submitted_by_user_id
             ORDER BY c.decided_at DESC
             LIMIT 1) AS verified_role
     FROM structured.review_rebuttals b
     JOIN structured.reviews r ON r.id = b.review_id
     JOIN structured.vendors v ON v.id = r.vendor_id
     WHERE b.id = $1`,
    [id]
  );

  const found = rows[0];

  if (!found) return null;

  return {
    id: found.id,
    status: found.status,
    claimedRole: found.claimed_role,
    body: found.body,
    decisionNote: found.decision_note,
    createdAt: found.created_at,
    vendorName: found.vendor_name,
    reviewTitle: found.review_title,
    reviewBody: found.review_body,
    reviewOverall: found.review_overall,
    verifiedRole: found.verified_role,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = createPool(loadConfig().databaseUrl);

  try {
    if (options.list) {
      const rows = await list(pool);

      if (rows.length === 0) {
        console.log('확인할 반론이 없다.');
        return;
      }

      console.log(`확인 대기 ${rows.length}건:`);
      for (const row of rows) {
        console.log(`  ${row.id}  ${row.vendorName}  ${row.claimedRole}  ${when(row.createdAt)}`);
      }
      return;
    }

    if (options.show) {
      const found = await show(pool, options.show);

      if (!found) {
        console.error('없는 반론이다.');
        process.exitCode = 1;
        return;
      }

      console.log(`${found.id}  ${REBUTTAL_STATUS_LABEL[found.status]}  ${when(found.createdAt)}`);
      console.log(`  업체: ${found.vendorName}`);
      console.log(`  본인이 밝힌 소속: ${found.claimedRole}`);
      /*
       * 관계자 인증을 마쳤는지. v2.0 25번이 반론의 첫 단계로 관계자 인증을
       * 두었으므로, 심사하는 사람이 먼저 볼 것은 이 줄이다.
       */
      console.log(
        found.verifiedRole === null
          ? '  관계자 인증: 없다  ← 이걸 확인하는 것이 심사다'
          : `  관계자 인증: 확인됨 (${found.verifiedRole})`
      );
      console.log(`  원본 후기(${found.reviewOverall}점): ${found.reviewTitle}`);
      console.log(`    ${found.reviewBody}`);
      console.log(`  반론: ${found.body}`);
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
        '왜 그렇게 결정했는지(--note)가 필요하다. 게시할 때는 소속을 무엇으로 확인했는지, ' +
          '게시하지 않을 때는 그 사유를 적는다. 낸 사람이 이걸 읽는다.'
      );
      process.exitCode = 1;
      return;
    }

    if (options.publish) {
      await decide(pool, options.publish, 'published', options.by, options.note, options.withoutClaim);
      return;
    }

    if (options.reject) {
      await decide(pool, options.reject, 'rejected', options.by, options.note);
      return;
    }

    console.error('무엇을 할지 정해라: --list | --show | --publish | --reject');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

/*
 * CLI로 직접 실행했을 때만 돈다. 테스트가 이 파일에서 함수를 가져오면(require)
 * `require.main`이 테스트 러너를 가리키므로 여기 걸리지 않는다.
 */
if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
