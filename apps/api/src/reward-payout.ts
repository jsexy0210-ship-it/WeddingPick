import {
  REWARD_PAYOUT_NOTIFICATION,
  REWARD_PAYOUT_STATUS_LABEL,
  REWARD_PAYOUT_STATUS_NOTE,
  maskMobilePhone,
  type RewardPayoutStatus,
} from '@weddingpick/domain';
import type { Pool, PoolClient } from 'pg';

import { notify } from './notify';

/**
 * Npay 리워드 수령(WP-EVT-006).
 *
 * 흐름 — 사용자가 «받는 분 · 휴대폰 번호 · 동의»로 요청 → 운영자가 Npay로 보내고 «보냈다»고
 * 적음(`reward-admin --sent`) → 보상은 paid, 번호는 지워짐 → 알림. 못 보냈으면 `--payout-failed`
 * → 보상은 풀려서 다시 받을 수 있고, 번호는 역시 지워지고, 사유가 알림으로 간다.
 *
 * **돈을 보내는 것은 이 코드가 아니다.** 사람이 보내고 사실만 남긴다(reward-admin과 같은 규칙).
 */

export type PayoutRow = {
  id: string;
  user_id: string;
  amount_krw: number;
  recipient_name: string;
  recipient_phone: string | null;
  status: RewardPayoutStatus;
  failure_reason: string | null;
  requested_at: Date;
  settled_at: Date | null;
};

export const PAYOUT_COLUMNS =
  'id, user_id, amount_krw, recipient_name, recipient_phone, status, failure_reason, requested_at, settled_at';

/** 계약 꼴로. 번호는 본인에게도 가린 꼴만 돌려준다. */
export function toPayoutDto(row: PayoutRow) {
  return {
    id: row.id,
    amountKrw: row.amount_krw,
    recipientName: row.recipient_name,
    phoneMasked: row.recipient_phone === null ? null : maskMobilePhone(row.recipient_phone),
    status: row.status,
    statusLabel: REWARD_PAYOUT_STATUS_LABEL[row.status],
    statusNote: REWARD_PAYOUT_STATUS_NOTE[row.status],
    failureReason: row.failure_reason,
    requestedAt: row.requested_at.toISOString(),
    settledAt: row.settled_at === null ? null : row.settled_at.toISOString(),
  };
}

/** 지금 받을 수 있는 보상 — 지급 대기(earned)인데 아직 어떤 요청에도 안 묶인 것. */
export async function receivableGrants(
  db: Pool | PoolClient,
  userId: string,
  lock = false
): Promise<{ id: string; amount_krw: number }[]> {
  const { rows } = await db.query<{ id: string; amount_krw: number }>(
    `SELECT id, amount_krw FROM structured.reward_grants
     WHERE user_id = $1 AND status = 'earned' AND payout_id IS NULL
     ORDER BY created_at${lock ? ' FOR UPDATE' : ''}`,
    [userId]
  );

  return rows;
}

const won = (amount: number): string => `${amount.toLocaleString('ko-KR')}원`;

/**
 * 운영자가 Npay로 보낸 뒤 적는다. 묶인 보상은 paid가 되고 번호는 지워진다.
 * 자기 것을 자기가 보냈다고 적을 수는 없다 — 부르는 쪽(reward-admin)이 requireOperator를 거친다.
 */
export async function markPayoutSent(
  client: PoolClient,
  payoutId: string,
  by: string,
  note: string
): Promise<PayoutRow> {
  const found = await lockPayout(client, payoutId);

  if (found.status !== 'requested') {
    throw new Error(`이미 ${REWARD_PAYOUT_STATUS_LABEL[found.status]} 상태다.`);
  }
  if (found.user_id === by) throw new Error('받는 본인은 지급할 수 없다.');

  await client.query(
    `UPDATE structured.reward_grants
     SET status = 'paid', decided_at = now(), decided_by = $2::uuid, decision_note = $3, updated_at = now()
     WHERE payout_id = $1::uuid AND status = 'earned'`,
    [payoutId, by, note]
  );

  const { rows } = await client.query<PayoutRow>(
    `UPDATE structured.reward_payouts
     SET status = 'sent', recipient_phone = NULL, phone_deleted_at = now(),
         settled_at = now(), settled_by = $2::uuid, updated_at = now()
     WHERE id = $1::uuid
     RETURNING ${PAYOUT_COLUMNS}`,
    [payoutId, by]
  );

  const sent = rows[0]!;
  const message = REWARD_PAYOUT_NOTIFICATION.sent(won(sent.amount_krw));

  await notify(client, {
    userId: sent.user_id,
    kind: 'notice',
    title: message.title,
    body: message.body,
    targetId: payoutId,
  });

  return sent;
}

/** 못 보냈다. 보상은 풀려서 다시 받을 수 있고, 번호는 지워지고, 사유는 받는 사람이 읽는다. */
export async function markPayoutFailed(
  client: PoolClient,
  payoutId: string,
  by: string,
  reason: string
): Promise<PayoutRow> {
  const found = await lockPayout(client, payoutId);

  if (found.status !== 'requested') {
    throw new Error(`이미 ${REWARD_PAYOUT_STATUS_LABEL[found.status]} 상태다.`);
  }

  await client.query(
    `UPDATE structured.reward_grants SET payout_id = NULL, updated_at = now()
     WHERE payout_id = $1::uuid AND status = 'earned'`,
    [payoutId]
  );

  const { rows } = await client.query<PayoutRow>(
    `UPDATE structured.reward_payouts
     SET status = 'failed', failure_reason = $3, recipient_phone = NULL, phone_deleted_at = now(),
         settled_at = now(), settled_by = $2::uuid, updated_at = now()
     WHERE id = $1::uuid
     RETURNING ${PAYOUT_COLUMNS}`,
    [payoutId, by, reason]
  );

  const failed = rows[0]!;
  const message = REWARD_PAYOUT_NOTIFICATION.failed(reason);

  await notify(client, {
    userId: failed.user_id,
    kind: 'notice',
    title: message.title,
    body: message.body,
    targetId: payoutId,
  });

  return failed;
}

async function lockPayout(client: PoolClient, payoutId: string): Promise<PayoutRow> {
  const { rows } = await client.query<PayoutRow>(
    `SELECT ${PAYOUT_COLUMNS} FROM structured.reward_payouts WHERE id = $1::uuid FOR UPDATE`,
    [payoutId]
  );

  const found = rows[0];
  if (!found) throw new Error('없는 수령 요청이다.');

  return found;
}
