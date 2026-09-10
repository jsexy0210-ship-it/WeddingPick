import { OPERATOR_CANNOT_WITHDRAW } from '@weddingpick/domain';
import type { Pool, PoolClient } from 'pg';

import { loadConfig } from './config';
import { requireOperator } from './decisions';
import { createPool, withTransaction } from './db';
import { sweepExpiredDocuments } from './retention/worker';
import { createLocalStorage } from './storage/local';
import { createS3Storage } from './storage/s3';
import type { Storage } from './storage/port';
import {
  WithdrawalRefused,
  attemptDeleteAccount,
  withdraw,
  type WithdrawalDeps,
} from './withdrawal';

/**
 * 회원탈퇴에 대한 운영자 개입. 05번 명세 14·35번.
 *
 * 자동 파기(withdrawal.ts)는 그대로 둔다. 이 파일이 더하는 것은 세 가지뿐이다 —
 * **조회**(누가 탈퇴 대기·보류·실패 중인지), **보류**(사고가 의심되면 잠깐
 * 멈춘다, 무기한은 아니다), **재시도**(실패한 계정을 다시 지운다). 운영자가
 * 탈퇴 자체를 취소하거나, 이미 지운 계정을 되살리거나, 보류를 무기한으로 두는
 * 기능은 여기 없다 — 그건 개입이 아니라 사용자의 요청을 운영자가 대신 뒤집는
 * 것이다.
 *
 * `requireOperator`(decisions.ts)를 그대로 쓴다. 여기서 새 권한 체계를 만들지
 * 않는다.
 *
 *   npm run withdrawal-admin --workspace @weddingpick/api -- --list
 *   npm run withdrawal-admin --workspace @weddingpick/api -- --hold <user-id> --by <operator-id> --reason <글> --until <ISO 날짜>
 *   npm run withdrawal-admin --workspace @weddingpick/api -- --resume <user-id> --by <operator-id> --reason <글>
 *   npm run withdrawal-admin --workspace @weddingpick/api -- --retry <user-id> --by <operator-id>
 */

export type WithdrawalAccountStatus = 'pending' | 'hold' | 'failed' | 'deletion_pending';

export type WithdrawalAccountSummary = {
  userId: string;
  requestedAt: Date;
  status: WithdrawalAccountStatus;
  hold: { reason: string; by: string; until: Date } | null;
  failure: { message: string; attemptCount: number; failedAt: Date } | null;
};

/**
 * 지금 상태 하나. 저장하지 않고 매번 계산한다 — 원본 파기·보류 만료는 다른 곳에서
 * 일어나는 일이라 저장값을 두면 그 일이 있을 때마다 여기도 고쳐야 하고, 잊으면
 * 어긋난다.
 */
async function currentStatus(
  db: Pool | PoolClient,
  userId: string
): Promise<WithdrawalAccountStatus | 'active' | 'unknown'> {
  const { rows } = await db.query<{ status: string }>(
    `SELECT
       CASE
         WHEN u.deleted_at IS NULL THEN 'active'
         WHEN EXISTS (
           SELECT 1 FROM structured.withdrawal_holds h
           WHERE h.user_id = u.id AND h.resolved_at IS NULL AND h.hold_until > now()
         ) THEN 'hold'
         WHEN EXISTS (
           SELECT 1 FROM structured.withdrawal_deletion_failures f WHERE f.user_id = u.id
         ) THEN 'failed'
         WHEN EXISTS (
           SELECT 1 FROM originals.raw_documents d
           WHERE d.owner_user_id = u.id AND d.status <> 'deleted'
         ) THEN 'pending'
         ELSE 'deletion_pending'
       END AS status
     FROM structured.users u
     WHERE u.id = $1`,
    [userId]
  );

  return (rows[0]?.status as WithdrawalAccountStatus | 'active' | undefined) ?? 'unknown';
}

/**
 * 탈퇴를 접수한(=`deleted_at`이 찍힌) 계정 전부. **개인정보 최소 노출** —
 * 이메일·연락처 같은 값은 애초에 `structured.users`에 없다(0002 이후 식별자만
 * 둔다). 여기서 더 보여줄 것도, 더 가릴 것도 없다.
 */
export async function list(pool: Pool): Promise<WithdrawalAccountSummary[]> {
  const { rows } = await pool.query<{
    user_id: string;
    deleted_at: Date;
    hold_reason: string | null;
    hold_by: string | null;
    hold_until: Date | null;
    error_message: string | null;
    attempt_count: number | null;
    failed_at: Date | null;
    has_pending_originals: boolean;
  }>(
    `SELECT
       u.id AS user_id,
       u.deleted_at,
       h.hold_reason, h.hold_by, h.hold_until,
       f.error_message, f.attempt_count, f.failed_at,
       EXISTS (
         SELECT 1 FROM originals.raw_documents d
         WHERE d.owner_user_id = u.id AND d.status <> 'deleted'
       ) AS has_pending_originals
     FROM structured.users u
     LEFT JOIN structured.withdrawal_holds h
       ON h.user_id = u.id AND h.resolved_at IS NULL AND h.hold_until > now()
     LEFT JOIN structured.withdrawal_deletion_failures f ON f.user_id = u.id
     WHERE u.deleted_at IS NOT NULL
     ORDER BY u.deleted_at`
  );

  return rows.map((row) => {
    const hold =
      row.hold_reason && row.hold_by && row.hold_until
        ? { reason: row.hold_reason, by: row.hold_by, until: row.hold_until }
        : null;
    const failure =
      row.error_message && row.failed_at
        ? {
            message: row.error_message,
            attemptCount: row.attempt_count ?? 1,
            failedAt: row.failed_at,
          }
        : null;

    const status: WithdrawalAccountStatus = hold
      ? 'hold'
      : failure
        ? 'failed'
        : row.has_pending_originals
          ? 'pending'
          : 'deletion_pending';

    return { userId: row.user_id, requestedAt: row.deleted_at, status, hold, failure };
  });
}

/**
 * 보류를 건다. **`hold_until` 없는 보류는 없다** — 무기한으로 두면 운영자가
 * 잊는 순간 탈퇴 요청을 조용히 취소한 것과 같아진다.
 */
export async function hold(
  pool: Pool,
  userId: string,
  by: string,
  reason: string,
  until: Date
): Promise<void> {
  await requireOperator(pool, by);

  const trimmedReason = reason.trim();

  if (trimmedReason === '') throw new Error('보류 사유가 필요하다.');
  if (!(until.getTime() > Date.now())) throw new Error('hold_until은 지금보다 뒤여야 한다.');

  await withTransaction(pool, async (client) => {
    const { rows } = await client.query<{ deleted_at: Date | null }>(
      'SELECT deleted_at FROM structured.users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    const user = rows[0];

    if (!user) throw new Error('없는 계정이다.');
    if (!user.deleted_at) throw new Error('탈퇴를 접수하지 않은 계정은 보류할 수 없다.');

    const { rows: active } = await client.query(
      'SELECT 1 FROM structured.withdrawal_holds WHERE user_id = $1 AND resolved_at IS NULL',
      [userId]
    );

    if (active.length > 0) throw new Error('이미 보류가 걸려 있는 계정이다. 먼저 해제해라.');

    const before = await currentStatus(client, userId);

    await client.query(
      `INSERT INTO structured.withdrawal_holds (user_id, hold_reason, hold_by, hold_until)
       VALUES ($1, $2, $3, $4)`,
      [userId, trimmedReason, by, until]
    );

    await client.query(
      `INSERT INTO structured.withdrawal_audit_log
         (operator_id, account_id, action, reason, before_status, after_status)
       VALUES ($1, $2, 'hold', $3, $4, 'hold')`,
      [by, userId, trimmedReason, before]
    );
  });
}

/** 보류를 해제한다. 해제하면 다음 워커 실행에서 다시 파기 대상이 될 수 있다. */
export async function resume(pool: Pool, userId: string, by: string, reason: string): Promise<void> {
  await requireOperator(pool, by);

  const trimmedReason = reason.trim();

  if (trimmedReason === '') throw new Error('해제 사유가 필요하다.');

  await withTransaction(pool, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM structured.withdrawal_holds
       WHERE user_id = $1 AND resolved_at IS NULL
       FOR UPDATE`,
      [userId]
    );
    const active = rows[0];

    if (!active) throw new Error('걸려 있는 보류가 없다.');

    await client.query(
      `UPDATE structured.withdrawal_holds
       SET resolved_at = now(), resolved_by = $2, resolved_reason = $3
       WHERE id = $1`,
      [active.id, by, trimmedReason]
    );

    const after = await currentStatus(client, userId);

    await client.query(
      `INSERT INTO structured.withdrawal_audit_log
         (operator_id, account_id, action, reason, before_status, after_status)
       VALUES ($1, $2, 'resume', $3, 'hold', $4)`,
      [by, userId, trimmedReason, after]
    );
  });
}

/**
 * 실패한 계정 하나를 다시 지워본다.
 *
 * **실패 기록이 있는 계정만 받는다** — 그냥 아직 원본 파기가 안 끝난 계정을
 * "재시도"라고 부르면, 원본 파기 진행 중인 계정마다 운영자가 계속 눌러보게
 * 된다. 그건 이 명령이 할 일이 아니라 시간이 할 일이다.
 */
/**
 * 운영자가 **대신** 탈퇴를 시작한다.
 *
 * 「내가 탈퇴도 시키고 해야하는데」(2026-09-10 대표). 지금까지 이 파일이 하던 셋은
 * 전부 **사용자가 이미 낸 탈퇴**에 개입하는 것이었다 — 보류 · 재개 · 재시도. 시작을
 * 대신 눌러 줄 자리가 없었고, 그래서 운영자는 지워야 할 계정을 보고도 손이 없었다.
 *
 * **본인이 누른 것과 같은 길로 간다.** `withdraw()`를 그대로 부른다. 여기서 계정을
 * 직접 지우는 짧은 길을 따로 내면 원본 파기 순서(접수 → 파기 대상 → 파일 파기 →
 * 계정 삭제)를 건너뛰게 되고, 그러면 지울 열쇠를 잃은 파일이 스토리지에 남는다.
 * 없애려던 결과가 그것이다.
 *
 * **되돌릴 수 없다.** 그래서 두 가지를 요구한다 — 사유를 반드시 적고, 그 사유가
 * 감사 기록에 남는다. 남이 대신 지운 계정은 본인이 지운 계정과 결과가 같아서,
 * 기록이 없으면 나중에 둘을 가릴 방법이 없다.
 *
 * **운영자 계정은 막는다.** `withdraw()` 안쪽도 막지만 여기서 먼저 막는다 —
 * 안쪽에서 걸리면 이미 접수가 시작된 뒤라 되돌릴 것이 생긴다.
 */
export async function forceWithdraw(
  deps: WithdrawalDeps,
  userId: string,
  by: string,
  reason: string
): Promise<{ completed: boolean; note: string }> {
  await requireOperator(deps.pool, by);

  const trimmedReason = reason.trim();

  if (trimmedReason === '') throw new WithdrawalRefused('탈퇴 사유가 필요하다.');

  const { rows } = await deps.pool.query<{ is_operator: boolean; deleted_at: Date | null }>(
    'SELECT is_operator, deleted_at FROM structured.users WHERE id = $1',
    [userId]
  );
  const target = rows[0];

  if (!target) throw new WithdrawalRefused('그런 계정이 없다.');
  if (target.is_operator) throw new WithdrawalRefused(OPERATOR_CANNOT_WITHDRAW);
  if (target.deleted_at) throw new WithdrawalRefused('이미 탈퇴가 접수된 계정이다.');

  const before = await currentStatus(deps.pool, userId);
  const result = await withdraw(deps, userId);
  const after = result.completed ? 'deleted' : await currentStatus(deps.pool, userId);

  const note = result.completed
    ? '지웠다.'
    : '접수했다. 원본 파기가 끝나면 파기 워커가 계정을 지운다.';

  /*
   * **기록은 지운 뒤에 쓴다.** 계정이 사라져도 이 행은 남는다 — `account_id`가
   * 외래키가 아니라서다(0058). 먼저 쓰고 탈퇴가 실패하면 「지웠다」는 기록만
   * 남으므로 순서를 바꾸지 않는다.
   */
  await deps.pool.query(
    `INSERT INTO structured.withdrawal_audit_log
       (operator_id, account_id, action, reason, before_status, after_status)
     VALUES ($1, $2, 'force', $3, $4, $5)`,
    [by, userId, trimmedReason, before, after]
  );

  return { completed: result.completed, note };
}

export async function retry(
  deps: WithdrawalDeps,
  userId: string,
  by: string
): Promise<{ completed: boolean; note: string }> {
  await requireOperator(deps.pool, by);

  const { rowCount: hasFailure } = await deps.pool.query(
    'SELECT 1 FROM structured.withdrawal_deletion_failures WHERE user_id = $1',
    [userId]
  );

  if (!hasFailure) throw new Error('다시 시도할 실패 기록이 없는 계정이다.');

  const { rowCount: activeHold } = await deps.pool.query(
    `SELECT 1 FROM structured.withdrawal_holds
     WHERE user_id = $1 AND resolved_at IS NULL AND hold_until > now()`,
    [userId]
  );

  if (activeHold) throw new Error('보류 중인 계정은 재시도할 수 없다. 먼저 보류를 해제해라.');

  const before = await currentStatus(deps.pool, userId);

  // 실패 원인이 원본 파기 지연이었을 수 있으니, 지우기 전에 한 번 더 밀어본다.
  await sweepExpiredDocuments(deps, 200, { ownerUserId: userId });

  const result = await attemptDeleteAccount(deps.pool, userId);
  const after = result.completed ? 'deleted' : await currentStatus(deps.pool, userId);

  const note = result.completed
    ? '지웠다.'
    : result.reason === 'error'
      ? result.message
      : '원본 파기가 아직 안 끝나 지울 수 없다.';

  await deps.pool.query(
    `INSERT INTO structured.withdrawal_audit_log
       (operator_id, account_id, action, reason, before_status, after_status)
     VALUES ($1, $2, 'retry', $3, $4, $5)`,
    [by, userId, note, before, after]
  );

  return { completed: result.completed, note };
}

const STATUS_LABEL: Record<WithdrawalAccountStatus, string> = {
  pending: '원본 파기 중',
  hold: '보류',
  failed: '삭제 실패',
  deletion_pending: '삭제 대기(다음 배치에서 지워짐)',
};

function when(at: Date): string {
  return at.toISOString().slice(0, 16).replace('T', ' ');
}

type Options = {
  list: boolean;
  hold?: string;
  resume?: string;
  retry?: string;
  by?: string;
  reason?: string;
  until?: string;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { list: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--list') options.list = true;
    else if (arg === '--hold') options.hold = argv[++i];
    else if (arg === '--resume') options.resume = argv[++i];
    else if (arg === '--retry') options.retry = argv[++i];
    else if (arg === '--by') options.by = argv[++i];
    else if (arg === '--reason') options.reason = argv[++i];
    else if (arg === '--until') options.until = argv[++i];
  }

  return options;
}

export async function main(): Promise<void> {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);
  const options = parseArgs(process.argv.slice(2));

  try {
    const openStorage = (): Storage =>
      config.storage.driver === 's3'
        ? createS3Storage(config.storage)
        : createLocalStorage(`http://localhost:${config.port}/dev-storage`);

    if (options.list) {
      const accounts = await list(pool);

      if (accounts.length === 0) {
        console.log('탈퇴를 접수한 계정이 없다.');
        return;
      }

      console.log(`탈퇴 접수 계정 ${accounts.length}건:`);
      for (const account of accounts) {
        const extra = account.hold
          ? `  보류 사유: ${account.hold.reason} (만료 ${when(account.hold.until)})`
          : account.failure
            ? `  실패 사유: ${account.failure.message} (시도 ${account.failure.attemptCount}회)`
            : '';

        console.log(
          `  ${account.userId}  ${STATUS_LABEL[account.status]}  요청 ${when(account.requestedAt)}${extra}`
        );
      }
      return;
    }

    if (options.hold) {
      if (!options.by) throw new Error('보류를 건 사람(--by <user-id>)이 필요하다.');
      if (!options.reason) throw new Error('보류 사유(--reason <글>)가 필요하다.');
      if (!options.until) throw new Error('보류 만료 시각(--until <ISO 날짜>)이 필요하다.');

      await hold(pool, options.hold, options.by, options.reason, new Date(options.until));
      console.log('보류를 걸었다.');
      return;
    }

    if (options.resume) {
      if (!options.by) throw new Error('해제한 사람(--by <user-id>)이 필요하다.');
      if (!options.reason) throw new Error('해제 사유(--reason <글>)가 필요하다.');

      await resume(pool, options.resume, options.by, options.reason);
      console.log('보류를 해제했다.');
      return;
    }

    if (options.retry) {
      if (!options.by) throw new Error('재시도한 사람(--by <user-id>)이 필요하다.');

      const result = await retry({ pool, storage: openStorage() }, options.retry, options.by);

      console.log(result.completed ? `지웠다. (${result.note})` : `아직 못 지웠다: ${result.note}`);
      return;
    }

    console.error('무엇을 할지 정해라: --list | --hold | --resume | --retry');
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
