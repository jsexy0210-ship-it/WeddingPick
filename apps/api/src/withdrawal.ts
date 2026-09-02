import { OPERATOR_CANNOT_WITHDRAW, type WithdrawalCounts } from '@weddingpick/domain';
import type { Pool } from 'pg';

import { withTransaction } from './db';
import { sweepExpiredDocuments } from './retention/worker';
import type { Storage } from './storage/port';

/**
 * 회원탈퇴. 디자인 핸드오프 WP-MY-008.
 *
 * **접수와 완료를 나눈다.** 계정을 곧바로 지우면 `raw_documents` 행이 CASCADE로
 * 함께 사라지고, 원본 파일은 지울 열쇠를 잃은 채 스토리지에 남는다. 아무도 그
 * 파일이 있는 줄 모르게 되는 것이 가장 나쁜 결과다 — 지웠다고 말하고 남기는 것이기
 * 때문이다.
 *
 * 그래서 순서가 있다:
 *
 *   접수(로그인 수단·세션 즉시 제거) → 원본을 즉시 파기 대상으로 → 파일 파기 →
 *   그 다음에 계정 삭제
 *
 * 접수 요청이 이 순서를 끝까지 밀어보고, 중간에 실패해도 원본은 이미 파기 대상이라
 * 파기 워커가 이어서 지운다. 그 뒤 `structured.deletable_accounts`에 뜬 계정을
 * `completeWithdrawals`가 지운다. **어느 단계에서 멈춰도 파일만 남는 상태는
 * 생기지 않는다.**
 */

export class WithdrawalRefused extends Error {}

export type WithdrawalDeps = { pool: Pool; storage: Storage };

/** 탈퇴하면 무엇이 어떻게 되는지 세어 온다. 화면이 짐작하지 않게. */
export async function countForWithdrawal(
  pool: Pool,
  userId: string
): Promise<WithdrawalCounts> {
  const { rows } = await pool.query<{
    has_partner: boolean;
    partner_name: string | null;
    candidates: string;
    tasks: string;
    expense_total: string;
    reviews: string;
    confirmed_reports: string;
  }>(
    `WITH mine AS (
       SELECT id, owner_user_id, partner_user_id FROM structured.weddings
       WHERE owner_user_id = $1 OR partner_user_id = $1
     )
     SELECT
       coalesce(bool_or(m.owner_user_id IS NOT NULL AND m.partner_user_id IS NOT NULL), false)
         AS has_partner,
       (SELECT p.display_name FROM structured.users p
         WHERE p.id IN (
           SELECT CASE WHEN owner_user_id = $1 THEN partner_user_id ELSE owner_user_id END
           FROM mine
         )
         LIMIT 1) AS partner_name,
       (SELECT count(*) FROM structured.vendor_candidates c
         WHERE c.wedding_id IN (SELECT id FROM mine)) AS candidates,
       (SELECT count(*) FROM structured.wedding_tasks t
         WHERE t.wedding_id IN (SELECT id FROM mine)) AS tasks,
       (SELECT coalesce(sum(e.amount), 0) FROM structured.expenses e
         WHERE e.wedding_id IN (SELECT id FROM mine)) AS expense_total,
       (SELECT count(*) FROM structured.reviews r WHERE r.author_user_id = $1) AS reviews,
       (SELECT
          (SELECT count(*) FROM structured.price_reports p
            WHERE p.reporter_user_id = $1 AND p.rejected_at IS NULL)
          + (SELECT count(*) FROM structured.payment_proofs f
              WHERE f.reporter_user_id = $1)) AS confirmed_reports
     FROM mine m`,
    [userId]
  );

  const row = rows[0];

  return {
    hasPartner: row?.has_partner ?? false,
    /*
     * 부를 이름은 사용자가 적어준 값이고(0030) 안 적었으면 없다. 없으면 화면이
     * 이름 없이 말한다 — **없는 이름을 지어내지 않는다.**
     */
    partnerName: row?.partner_name ?? null,
    candidates: Number(row?.candidates ?? 0),
    tasks: Number(row?.tasks ?? 0),
    expenseTotal: Number(row?.expense_total ?? 0),
    reviews: Number(row?.reviews ?? 0),
    confirmedReports: Number(row?.confirmed_reports ?? 0),
  };
}

/**
 * 탈퇴를 접수한다.
 *
 * 이 트랜잭션이 끝나면 그 사람은 더 이상 들어올 수 없다 — 로그인 수단과 세션이
 * 함께 사라지기 때문이다. **계정 행이 아직 남아 있는 것은 원본을 지울 열쇠를
 * 들고 있기 위해서지, 그 사람이 아직 우리 사용자이기 때문이 아니다.**
 */
async function accept(pool: Pool, userId: string): Promise<void> {
  await withTransaction(pool, async (client) => {
    const { rows } = await client.query<{ is_operator: boolean; deleted_at: Date | null }>(
      'SELECT is_operator, deleted_at FROM structured.users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    const user = rows[0];

    if (!user) throw new WithdrawalRefused('없는 계정이다.');
    if (user.deleted_at) return; // 이미 접수됐다. 두 번 눌러도 같은 결과다.

    /*
     * 운영자가 내린 결정에는 그 사람이 남아 있어야 한다. 파기 승인과 광고 전환
     * 승인은 스키마가 사람을 지우지 못하게 막아둔 자리(RESTRICT)이므로, 여기서
     * 막지 않으면 마지막 단계에서 알 수 없는 오류로 끝난다.
     */
    if (user.is_operator) throw new WithdrawalRefused(OPERATOR_CANNOT_WITHDRAW);

    /*
     * 배우자가 있으면 웨딩을 넘긴다.
     *
     * `weddings.owner_user_id`가 CASCADE라서, 넘기지 않고 지우면 **남는 사람의
     * 일정과 지출까지 함께 사라진다.** 떠나는 사람의 탈퇴가 남는 사람의 기록을
     * 지울 권한은 아니다.
     */
    await client.query(
      `UPDATE structured.weddings
       SET owner_user_id = partner_user_id, partner_user_id = NULL
       WHERE owner_user_id = $1 AND partner_user_id IS NOT NULL`,
      [userId]
    );

    // 내가 배우자 쪽이면 연결만 끊는다. 웨딩은 상대의 것이다.
    await client.query(
      'UPDATE structured.weddings SET partner_user_id = NULL WHERE partner_user_id = $1',
      [userId]
    );

    // 다시 로그인하면 새 계정이 된다 — "다시 가입하면 새로 시작해요"가 그 말이다.
    await client.query('DELETE FROM identity.identities WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM identity.sessions WHERE user_id = $1', [userId]);

    await client.query('UPDATE structured.users SET deleted_at = now() WHERE id = $1', [userId]);

    /*
     * 원본은 여기서 건드리지 않는다. 파기 일정은 저장값이 아니라 계산값이고
     * (0018·0022), `deleted_at`이 찍히는 순간 그 사람의 원본은 전부 만료된 것으로
     * 계산된다(0048). 열을 손으로 고치면 계산값과 저장값이 어긋나기만 한다.
     */
  });
}

/**
 * 계정 하나를 안전하게 지운다. 운영자 RETRY와 배치 워커가 함께 쓴다.
 *
 * **확인과 삭제 사이를 트랜잭션 하나로 묶는다.** `deletable_accounts` 뷰로 목록을
 * 뽑은 뒤 그 목록을 믿고 지우면, 목록을 뽑은 순간과 지우는 순간 사이에 운영자가
 * HOLD를 걸어도 삭제를 막을 방법이 없다 — 뷰는 조회 시점의 스냅샷이지 잠금이
 * 아니다. 그래서 여기서는 `structured.users` 행을 `FOR UPDATE`로 잠그고, 뷰가 보는
 * 조건(원본 파기 완료·활성 보류 없음)을 삭제 직전에 다시 확인한다.
 *
 * 두 번 불러도 안전하다(멱등) — 이미 지워진 계정은 `deleted_at`을 못 찾아
 * `not_deletable`로 끝나고, 아무것도 건드리지 않는다.
 */
export type DeleteAttempt =
  | { completed: true }
  | { completed: false; reason: 'not_deletable' }
  | { completed: false; reason: 'error'; message: string };

export async function attemptDeleteAccount(pool: Pool, userId: string): Promise<DeleteAttempt> {
  try {
    return await withTransaction(pool, async (client) => {
      const { rows } = await client.query<{ deletable: boolean }>(
        `SELECT
           u.deleted_at IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM originals.raw_documents d
             WHERE d.owner_user_id = u.id AND d.status <> 'deleted'
           )
           AND NOT EXISTS (
             SELECT 1 FROM structured.withdrawal_holds h
             WHERE h.user_id = u.id AND h.resolved_at IS NULL AND h.hold_until > now()
           ) AS deletable
         FROM structured.users u
         WHERE u.id = $1
         FOR UPDATE`,
        [userId]
      );

      if (!rows[0]?.deletable) return { completed: false, reason: 'not_deletable' } as const;

      await client.query('DELETE FROM structured.users WHERE id = $1', [userId]);
      // 재시도가 필요했던 계정이 이번에 지워졌으면 실패 기록도 함께 지운다.
      await client.query('DELETE FROM structured.withdrawal_deletion_failures WHERE user_id = $1', [
        userId,
      ]);

      return { completed: true } as const;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // 다음 배치·다음 RETRY가 이유를 볼 수 있게 남긴다. 콘솔 로그는 재시작하면 사라진다.
    await pool.query(
      `INSERT INTO structured.withdrawal_deletion_failures (user_id, error_message)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE
         SET error_message = excluded.error_message,
             failed_at = now(),
             attempt_count = structured.withdrawal_deletion_failures.attempt_count + 1`,
      [userId, message]
    );

    return { completed: false, reason: 'error', message };
  }
}

/**
 * 지울 준비가 된 계정을 지운다.
 *
 * 관문은 `structured.deletable_accounts` 하나다 — 원본 파일이 하나라도 남아 있거나
 * 운영자가 보류를 걸어뒀으면 이 뷰에 뜨지 않는다. 목록은 여기서 뽑지만, 실제로
 * 지울지는 `attemptDeleteAccount`가 트랜잭션 안에서 다시 확인한다(위 설명).
 */
export async function completeWithdrawals(pool: Pool, limit = 50): Promise<number> {
  const { rows } = await pool.query<{ user_id: string }>(
    'SELECT user_id FROM structured.deletable_accounts ORDER BY deleted_at LIMIT $1',
    [limit]
  );

  let deleted = 0;

  for (const row of rows) {
    const result = await attemptDeleteAccount(pool, row.user_id);

    if (result.completed) deleted += 1;
    // 실패는 attemptDeleteAccount가 이미 structured.withdrawal_deletion_failures에 남겼다.
  }

  return deleted;
}

/**
 * 탈퇴 요청 하나를 끝까지 밀어본다.
 *
 * 원본 파기까지 마치면 계정이 이 자리에서 사라지고, 파기가 남으면 접수 상태로
 * 둔다. 어느 쪽이든 그 사람은 이미 들어올 수 없다.
 */
export async function withdraw(
  deps: WithdrawalDeps,
  userId: string
): Promise<{ completed: boolean }> {
  await accept(deps.pool, userId);

  /*
   * 이 사람 것만 지운다. 다른 사람의 파기를 이 요청이 대신 떠맡을 이유가 없다.
   *
   * **`RETENTION_MODE`를 보지 않는다.** 그 설정이 막는 것은 "예정일이 됐다고 서버가
   * 남의 계약서를 지우는 일"이고(15번), 이건 본인이 지워달라고 한 자기 자료다. 둘을
   * 같이 묶으면 탈퇴한 사람이 운영자의 손을 기다려야 하고, 그동안 그 사람의 원본은
   * 지우겠다고 말해놓고 남아 있는 상태가 된다.
   */
  await sweepExpiredDocuments(deps, 200, { ownerUserId: userId });

  const result = await attemptDeleteAccount(deps.pool, userId);

  return { completed: result.completed };
}
