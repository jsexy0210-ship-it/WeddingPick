import {
  VERIFICATION_EVENT_LABEL,
  VERIFICATION_EVIDENCE_RULES,
  VERIFICATION_LEVEL_RULES,
  VERIFICATION_POLICY,
  VERIFICATION_STATUS_LABEL,
  canApprove,
} from '@weddingpick/domain';
import type {
  RequestableLevel,
  VerificationEventKind,
  VerificationEvidenceKind,
  VerificationLevel,
  VerificationStatus,
} from '@weddingpick/domain';
import type { PoolClient } from 'pg';

import { loadConfig } from './config';
import { createPool, withTransaction } from './db';
import { requireOperator } from './decisions';
import { notify } from './notify';

/**
 * 인증 심사 도구.
 *
 * A-13은 신청을 접수만 한다 — 등급은 사람이 증빙을 보고 나서야 오른다
 * (서비스정책서 7번). 그 "사람이 보는" 자리가 여기다. 이게 없으면 신청은
 * 쌓이기만 하고 L1~L4는 영원히 붙지 않으며, 시장 대표가격은 L2 이상만 쓰므로
 * 가격 비교 자체가 서지 않는다.
 *
 *   npm run verifications --workspace @weddingpick/api -- --list
 *   npm run verifications --workspace @weddingpick/api -- --backlog
 *   npm run verifications --workspace @weddingpick/api -- --show <id>
 *   npm run verifications --workspace @weddingpick/api -- --review <id> --by <user-id>
 *   npm run verifications --workspace @weddingpick/api -- --approve <id> --by <user-id> \
 *     --note "계약서 3면 도장 확인"
 *   npm run verifications --workspace @weddingpick/api -- --reject <id> --by <user-id> \
 *     --reason "..."
 *
 * `--by`는 심사한 사람의 사용자 id다. 신청자 본인은 넣을 수 없다 — 도메인 규칙과
 * 스키마 제약(0011)이 양쪽에서 막는다.
 *
 * 승인은 되돌리기 어렵다. 등급이 오르는 순간 그 문서는 다른 사람이 보는 중앙값에
 * 들어간다. 그래서 이 도구는 승인 직전에 조건을 다시 확인하고, 맞지 않으면
 * 이유를 말하고 멈춘다.
 */

type Options = {
  list: boolean;
  backlog: boolean;
  show?: string;
  review?: string;
  approve?: string;
  reject?: string;
  by?: string;
  note?: string;
  reason?: string;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { list: false, backlog: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--list') options.list = true;
    else if (arg === '--backlog') options.backlog = true;
    else if (arg === '--show') options.show = argv[++i];
    else if (arg === '--review') options.review = argv[++i];
    else if (arg === '--approve') options.approve = argv[++i];
    else if (arg === '--reject') options.reject = argv[++i];
    else if (arg === '--by') options.by = argv[++i];
    else if (arg === '--note') options.note = argv[++i];
    else if (arg === '--reason') options.reason = argv[++i];
  }

  return options;
}

const when = (at: Date): string => at.toISOString().slice(0, 16).replace('T', ' ');

/** 낸 증빙을 사람이 읽는 말로. DB의 enum 값을 그대로 보여주지 않는다. */
function evidenceLabels(kinds: readonly string[]): string {
  if (kinds.length === 0) return '(없음)';

  return kinds
    .map((kind) => VERIFICATION_EVIDENCE_RULES[kind as VerificationEvidenceKind]?.label ?? kind)
    .join(', ');
}

type PendingRow = {
  id: string;
  target_level: RequestableLevel;
  status: VerificationStatus;
  received_at: Date;
  total_amount: string | null;
  evidence_kinds: string[];
};

function describe(row: PendingRow, now: Date): string {
  const waitingDays = Math.floor(
    (now.getTime() - row.received_at.getTime()) / (24 * 60 * 60 * 1000)
  );

  return (
    `${row.id}  ${VERIFICATION_STATUS_LABEL[row.status]}  ` +
    `→ ${VERIFICATION_LEVEL_RULES[row.target_level].label}  ` +
    `증빙: ${evidenceLabels(row.evidence_kinds)}  ${when(row.received_at)}` +
    // 밀린 것을 목록에서 바로 알아볼 수 있게 한다. 따로 --backlog를 봐야만
    // 알 수 있으면, 안 보는 날에는 모른다.
    (waitingDays >= VERIFICATION_POLICY.backlogDays ? `  (${waitingDays}일째)` : '')
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = createPool(loadConfig().databaseUrl);

  try {
    if (options.list) {
      const { rows } = await pool.query<PendingRow>(
        `SELECT id, target_level, status, received_at, total_amount, evidence_kinds
         FROM structured.pending_verification_requests
         ORDER BY received_at`
      );

      if (rows.length === 0) {
        console.log('심사할 신청이 없다.');
        return;
      }

      const now = new Date();
      const backlogged = rows.filter(
        (row) =>
          now.getTime() - row.received_at.getTime() >=
          VERIFICATION_POLICY.backlogDays * 24 * 60 * 60 * 1000
      ).length;

      console.log(`심사 대기 ${rows.length}건:`);
      for (const row of rows) console.log(`  ${describe(row, now)}`);

      if (backlogged > 0) {
        console.log(
          `\n그중 ${backlogged}건은 ${VERIFICATION_POLICY.backlogDays}일 넘게 밀렸다.` +
            ' 밀리는 동안 그 증빙 원본은 파기되지 않는다: npm run verifications -- --backlog'
        );
      }
      return;
    }

    if (options.backlog) {
      const { rows } = await pool.query<{
        id: string;
        target_level: RequestableLevel;
        status: VerificationStatus;
        waiting_days: number;
        held_document_count: string;
      }>(
        `SELECT id, target_level, status, waiting_days, held_document_count
         FROM structured.backlogged_verification_requests
         ORDER BY waiting_days DESC`
      );

      if (rows.length === 0) {
        console.log(`${VERIFICATION_POLICY.backlogDays}일 넘게 밀린 신청이 없다.`);
        return;
      }

      const held = rows.reduce((sum, row) => sum + Number(row.held_document_count), 0);

      console.log(`${VERIFICATION_POLICY.backlogDays}일 넘게 밀린 신청 ${rows.length}건:`);
      for (const row of rows) {
        console.log(
          `  ${row.id}  ${VERIFICATION_STATUS_LABEL[row.status]}  ` +
            `→ ${VERIFICATION_LEVEL_RULES[row.target_level].label}  ${row.waiting_days}일째` +
            `  증빙 ${row.held_document_count}건`
        );
      }

      /*
       * 왜 급한지를 함께 말한다. 심사가 밀리는 동안 그 증빙 원본은 파기되지
       * 않는다 — 심사 문제가 아니라 개인정보가 남는 문제다.
       */
      if (held > 0) {
        console.log(
          `\n이 신청들 때문에 원본 ${held}건의 파기 일정이 아직 시작되지 않았다.` +
            '\n결론이 나야 그 원본의 30일이 시작된다.'
        );
      }
      return;
    }

    if (options.show) {
      await show(pool, options.show);
      return;
    }

    if (!options.by) {
      console.error('심사한 사람(--by <user-id>)이 필요하다. 결론에는 사람이 남아야 한다.');
      process.exitCode = 1;
      return;
    }

    if (options.review) {
      await startReview(pool, options.review, options.by);
      return;
    }

    if (options.approve) {
      await approve(pool, options.approve, options.by, options.note ?? null);
      return;
    }

    if (options.reject) {
      if (!options.reason) {
        console.error('반려 사유(--reason)가 필요하다. 신청한 사람이 이걸 읽는다.');
        process.exitCode = 1;
        return;
      }

      await reject(pool, options.reject, options.by, options.reason);
      return;
    }

    console.log('--list, --backlog, --show, --review, --approve, --reject 중 하나가 필요하다.');
  } finally {
    await pool.end();
  }
}

async function show(pool: ReturnType<typeof createPool>, id: string): Promise<void> {
  const { rows } = await pool.query<{
    id: string;
    target_level: RequestableLevel;
    status: VerificationStatus;
    received_at: Date;
    decided_at: Date | null;
    rejection_reason: string | null;
    requested_by: string;
    verification_level: VerificationLevel;
    total_amount: string | null;
    evidence_kinds: string[];
  }>(
    `SELECT r.id, r.target_level, r.status, r.received_at, r.decided_at, r.rejection_reason,
            r.requested_by, q.verification_level, q.total_amount,
            COALESCE(
              (SELECT array_agg(DISTINCT e.kind::text ORDER BY e.kind::text)
                 FROM structured.verification_evidence e
                WHERE e.request_id = r.id),
              ARRAY[]::text[]
            ) AS evidence_kinds
     FROM structured.verification_requests r
     JOIN structured.quotes q ON q.id = r.quote_id
     WHERE r.id = $1`,
    [id]
  );

  const found = rows[0];

  if (!found) {
    console.error('없는 신청이다.');
    process.exitCode = 1;
    return;
  }

  // 결정이 난 뒤에는 화살표를 쓰지 않는다. 승인되면 문서 등급이 이미 목표와 같아져
  // "계약인증 → 계약인증"이 되고, 그건 아무것도 말해주지 않는다.
  const decided = found.status === 'approved' || found.status === 'rejected';

  console.log(
    `${found.id}  ${VERIFICATION_STATUS_LABEL[found.status]}  ` +
      (decided
        ? `${VERIFICATION_LEVEL_RULES[found.target_level].label} 신청`
        : `${VERIFICATION_LEVEL_RULES[found.verification_level].label}` +
          ` → ${VERIFICATION_LEVEL_RULES[found.target_level].label}`) +
      `  ${when(found.received_at)}`
  );
  console.log(`  신청자: ${found.requested_by}`);
  console.log(`  금액: ${found.total_amount ?? '(없음)'}`);
  console.log(`  낸 증빙: ${evidenceLabels(found.evidence_kinds)}`);
  console.log(
    `  ${VERIFICATION_LEVEL_RULES[found.target_level].label} 조건: ` +
      `${VERIFICATION_LEVEL_RULES[found.target_level].condition}`
  );
  if (found.rejection_reason) console.log(`  반려 사유: ${found.rejection_reason}`);

  const events = await pool.query<{
    kind: VerificationEventKind;
    actor_user_id: string | null;
    note: string | null;
    occurred_at: Date;
  }>(
    `SELECT kind, actor_user_id, note, occurred_at
     FROM structured.verification_events WHERE request_id = $1 ORDER BY occurred_at`,
    [id]
  );

  console.log('  이력:');
  for (const event of events.rows) {
    console.log(
      `    ${when(event.occurred_at)} ${VERIFICATION_EVENT_LABEL[event.kind]}` +
        `${event.actor_user_id ? ` (${event.actor_user_id})` : ''}` +
        `${event.note ? ` — ${event.note}` : ''}`
    );
  }
}

/** 심사 시작 표시. 여러 사람이 같은 신청을 붙잡는 것을 막는 최소한의 표시다. */
async function startReview(
  pool: ReturnType<typeof createPool>,
  id: string,
  by: string
): Promise<void> {
  await withTransaction(pool, async (client) => {
    const found = await lock(client, id);

    if (found.status !== 'received') {
      throw new Error(`이미 ${VERIFICATION_STATUS_LABEL[found.status]} 상태다.`);
    }

    await client.query(
      "UPDATE structured.verification_requests SET status = 'in_review' WHERE id = $1",
      [id]
    );
    await logEvent(client, id, 'review_started', by, null);
  });

  console.log('심사를 시작했다고 기록했다.');
}

/**
 * 승인.
 *
 * 접수 때 한 번 걸렀지만 여기서 다시 본다. 접수와 승인 사이에 증빙이 지워졌거나
 * 문서 등급이 다른 경로로 올랐을 수 있고, 승인은 이 자료를 다른 사람이 보는
 * 중앙값에 넣는 일이라 되돌리기 어렵다.
 */
export async function approve(
  pool: ReturnType<typeof createPool>,
  id: string,
  by: string,
  note: string | null
): Promise<void> {
  await withTransaction(pool, async (client) => {
    await requireOperator(client, by);

    const found = await lock(client, id);

    if (found.status === 'approved' || found.status === 'rejected') {
      throw new Error(`이미 ${VERIFICATION_STATUS_LABEL[found.status]}된 신청이다.`);
    }

    const check = canApprove({
      targetLevel: found.target_level,
      currentLevel: found.verification_level,
      evidenceKinds: found.evidence_kinds as VerificationEvidenceKind[],
      reviewerId: by,
      requesterId: found.requested_by,
    });

    if (!check.ok) {
      throw new Error(`승인할 수 없다: ${check.reason}`);
    }

    await client.query(
      `UPDATE structured.verification_requests
       SET status = 'approved', decided_at = now(), decided_by = $2::uuid
       WHERE id = $1::uuid`,
      [id, by]
    );

    // 등급은 여기서만 오른다. 신청 경로(routes/verification.ts)는 절대 건드리지 않는다.
    await client.query(
      'UPDATE structured.quotes SET verification_level = $2::verification_level WHERE id = $1::uuid',
      [found.quote_id, found.target_level]
    );

    await logEvent(client, id, 'approved', by, note);

    // 신청한 사람은 심사가 끝났는지 알 길이 없다. 결과를 알림함에 남긴다.
    await notify(client, {
      userId: found.requested_by,
      kind: 'verification',
      title: '자료 확인이 끝났어요',
      body: '확인 결과가 반영됐어요. 문서 화면에서 확인해주세요',
      targetId: found.quote_id,
    });
  });

  console.log('승인했다. 문서 등급이 올랐고, 이제 가격 비교에 쓰인다.');
}

export async function reject(
  pool: ReturnType<typeof createPool>,
  id: string,
  by: string,
  reason: string
): Promise<void> {
  await withTransaction(pool, async (client) => {
    await requireOperator(client, by);

    const found = await lock(client, id);

    if (found.status === 'approved' || found.status === 'rejected') {
      throw new Error(`이미 ${VERIFICATION_STATUS_LABEL[found.status]}된 신청이다.`);
    }

    if (by === found.requested_by) {
      throw new Error('신청한 본인은 심사할 수 없다.');
    }

    await client.query(
      `UPDATE structured.verification_requests
       SET status = 'rejected', decided_at = now(), decided_by = $2::uuid, rejection_reason = $3
       WHERE id = $1::uuid`,
      [id, by, reason]
    );

    await logEvent(client, id, 'rejected', by, reason);

    await notify(client, {
      userId: found.requested_by,
      kind: 'verification',
      title: '자료 확인 결과를 알려드려요',
      body: reason,
      targetId: found.quote_id,
    });
  });

  console.log('반려했다. 사유는 신청한 사람에게 보인다.');
}

type LockedRow = {
  quote_id: string;
  requested_by: string;
  target_level: RequestableLevel;
  status: VerificationStatus;
  verification_level: VerificationLevel;
  evidence_kinds: string[];
};

/** 판단에 쓰는 값을 한 번에 잠그고 읽는다. 읽고 나서 바뀌면 판단이 무의미해진다. */
async function lock(client: PoolClient, id: string): Promise<LockedRow> {
  const { rows } = await client.query<LockedRow>(
    `SELECT r.quote_id, r.requested_by, r.target_level, r.status, q.verification_level,
            COALESCE(
              (SELECT array_agg(DISTINCT e.kind::text ORDER BY e.kind::text)
                 FROM structured.verification_evidence e
                WHERE e.request_id = r.id),
              ARRAY[]::text[]
            ) AS evidence_kinds
     FROM structured.verification_requests r
     JOIN structured.quotes q ON q.id = r.quote_id
     WHERE r.id = $1
     FOR UPDATE OF r, q`,
    [id]
  );

  const found = rows[0];

  if (!found) throw new Error('없는 신청이다.');

  return found;
}

async function logEvent(
  client: PoolClient,
  requestId: string,
  kind: 'review_started' | 'approved' | 'rejected',
  actor: string,
  note: string | null
): Promise<void> {
  await client.query(
    `INSERT INTO structured.verification_events (request_id, kind, actor_user_id, note)
     VALUES ($1::uuid, $2::verification_event_kind, $3::uuid, $4::text)`,
    [requestId, kind, actor, note]
  );
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
