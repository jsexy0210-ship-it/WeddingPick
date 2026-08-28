import { isDeadTokenError, retentionAlertContent, shouldAlert } from '@weddingpick/domain';
import type { Pool } from 'pg';

import type { Push, PushMessage } from '../push/port';

/**
 * 파기 일정 알림.
 *
 * 원본을 지우는 것은 사람이 한다. 그러려면 지울 때가 됐다는 것을 사람이 알아야
 * 하고, 알리는 일은 기계가 한다 — 사람이 달력을 보고 있기를 기대하는 것은
 * 절차가 아니다.
 *
 * 알림은 운영자에게만 간다. 파기해야 할 것은 남의 계약서고, 그 사실을 그 사람에게
 * 알리는 것이 우리 일은 아니다. 사용자는 앱 화면에서 예정일을 본다.
 */

export type AlertDeps = {
  pool: Pool;
  push: Push;
  /** 처리되지 않은 채 이만큼 지나면 다시 알린다. */
  reminderAfterHours: number;
};

export type AlertResult = {
  dueCount: number;
  notified: number;
  delivered: number;
  disabledTokens: number;
};

type Operator = {
  id: string;
  last_due_count: number | null;
  last_sent_at: Date | null;
};

export async function alertOperators(deps: AlertDeps, now = new Date()): Promise<AlertResult> {
  const due = await deps.pool.query<{ count: string; oldest: Date | null }>(
    `SELECT count(*) AS count, min(retention_until) AS oldest
     FROM originals.documents_due_for_deletion`
  );

  const dueCount = Number(due.rows[0]?.count ?? 0);
  const oldest = due.rows[0]?.oldest ?? null;

  if (dueCount === 0) {
    return { dueCount: 0, notified: 0, delivered: 0, disabledTokens: 0 };
  }

  const overdueDays = oldest
    ? Math.floor((now.getTime() - oldest.getTime()) / (24 * 60 * 60 * 1000))
    : 0;
  const content = retentionAlertContent(dueCount, overdueDays);

  // 운영자마다 마지막으로 무엇을 알렸는지 함께 가져온다. 사람마다 판단이 다르다
  // — 한 명은 어제 받았고 다른 한 명은 오늘 운영자가 됐을 수 있다.
  const { rows: operators } = await deps.pool.query<Operator>(
    `SELECT u.id, a.due_count AS last_due_count, a.sent_at AS last_sent_at
     FROM structured.users u
     LEFT JOIN LATERAL (
       SELECT due_count, sent_at FROM structured.retention_alerts
        WHERE operator_user_id = u.id ORDER BY sent_at DESC LIMIT 1
     ) a ON true
     WHERE u.is_operator`
  );

  let notified = 0;
  let delivered = 0;
  let disabledTokens = 0;

  for (const operator of operators) {
    const decision = shouldAlert({
      dueCount,
      lastAlert:
        operator.last_sent_at && operator.last_due_count !== null
          ? { dueCount: operator.last_due_count, sentAt: operator.last_sent_at }
          : null,
      reminderAfterHours: deps.reminderAfterHours,
      now,
    });

    if (!decision.send) continue;

    const { rows: tokens } = await deps.pool.query<{ token: string }>(
      `SELECT token FROM structured.device_tokens
       WHERE user_id = $1 AND disabled_at IS NULL`,
      [operator.id]
    );

    const messages: PushMessage[] = tokens.map(({ token }) => ({
      token,
      title: content.title,
      body: content.body,
    }));

    const outcomes = messages.length > 0 ? await deps.push.send(messages) : [];
    const reached = outcomes.filter((outcome) => outcome.delivered).length;

    for (const outcome of outcomes) {
      if (outcome.delivered) continue;

      // 일시적인 실패로 토큰을 끄면 그 기기는 다시는 알림을 못 받는다.
      // 기기가 정말 사라졌다고 Expo가 말할 때만 끈다.
      if (!isDeadTokenError(outcome.error)) continue;

      await deps.pool.query(
        `UPDATE structured.device_tokens
         SET disabled_at = now(), disabled_reason = $2
         WHERE token = $1 AND disabled_at IS NULL`,
        [outcome.token, outcome.error]
      );
      disabledTokens += 1;
    }

    /*
     * 닿지 못했어도 기록은 남긴다. 기록이 없으면 다음 바퀴에서 또 'first'로
     * 판단해 매 10분마다 다시 쏘게 된다 — 기기가 없는 운영자 한 명 때문에
     * 발송이 무한히 반복된다. 대신 delivered_to에 0이 남아, 아무에게도 닿지
     * 않았다는 사실이 드러난다.
     */
    await deps.pool.query(
      `INSERT INTO structured.retention_alerts (operator_user_id, due_count, delivered_to)
       VALUES ($1, $2, $3)`,
      [operator.id, dueCount, reached]
    );

    notified += 1;
    delivered += reached;
  }

  return { dueCount, notified, delivered, disabledTokens };
}
