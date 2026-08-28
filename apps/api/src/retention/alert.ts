import {
  isDeadTokenError,
  retentionAlertContent,
  shouldAlert,
  verificationBacklogContent,
} from '@weddingpick/domain';
import type { OperatorAlertKind } from '@weddingpick/domain';
import type { Pool } from 'pg';

import type { Push, PushMessage } from '../push/port';

/**
 * 운영자 알림.
 *
 * 사람이 손대야 할 일이 쌓였다는 것을 기계가 알린다 — 사람이 목록을 보고 있기를
 * 기대하는 것은 절차가 아니다.
 *
 * 알림은 운영자에게만 간다. 알리는 대상은 남의 계약서와 남의 인증 신청이고,
 * 그 사실을 그 사람들에게 알리는 것이 우리 일은 아니다.
 *
 * 종류를 나누어 각각 따로 센다. 하나로 합치면 파기가 줄어드는 사이 심사가
 * 쌓여도 "숫자가 그대로"라 조용해진다.
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

export type AllAlertsResult = Record<OperatorAlertKind, AlertResult>;

type Operator = {
  id: string;
  last_count: number | null;
  last_sent_at: Date | null;
};

/** 무엇을 셀지와 무엇이라고 말할지. 종류마다 이것만 다르다. */
type AlertSubject = {
  kind: OperatorAlertKind;
  count(pool: Pool): Promise<{ count: number; oldestDays: number }>;
  content(count: number, oldestDays: number): { title: string; body: string };
};

const RETENTION_DUE: AlertSubject = {
  kind: 'retention_due',
  async count(pool) {
    const { rows } = await pool.query<{ count: string; oldest: Date | null }>(
      `SELECT count(*) AS count, min(retention_until) AS oldest
       FROM originals.documents_due_for_deletion`
    );

    const oldest = rows[0]?.oldest ?? null;

    return {
      count: Number(rows[0]?.count ?? 0),
      oldestDays: oldest
        ? Math.floor((Date.now() - oldest.getTime()) / (24 * 60 * 60 * 1000))
        : 0,
    };
  },
  content: retentionAlertContent,
};

const VERIFICATION_BACKLOG: AlertSubject = {
  kind: 'verification_backlog',
  async count(pool) {
    const { rows } = await pool.query<{ count: string; oldest: number | null }>(
      `SELECT count(*) AS count, max(waiting_days) AS oldest
       FROM structured.backlogged_verification_requests`
    );

    return { count: Number(rows[0]?.count ?? 0), oldestDays: rows[0]?.oldest ?? 0 };
  },
  content: verificationBacklogContent,
};

/** 두 종류를 모두 본다. 워커가 부르는 것은 이쪽이다. */
export async function alertOperators(
  deps: AlertDeps,
  now = new Date()
): Promise<AllAlertsResult> {
  return {
    retention_due: await alertOne(deps, RETENTION_DUE, now),
    verification_backlog: await alertOne(deps, VERIFICATION_BACKLOG, now),
  };
}

async function alertOne(
  deps: AlertDeps,
  subject: AlertSubject,
  now: Date
): Promise<AlertResult> {
  const { count, oldestDays } = await subject.count(deps.pool);

  if (count === 0) {
    return { dueCount: 0, notified: 0, delivered: 0, disabledTokens: 0 };
  }

  const content = subject.content(count, oldestDays);

  /*
   * 운영자마다 이 종류로 마지막에 무엇을 알렸는지 함께 가져온다. 사람마다
   * 판단이 다르고, 종류마다도 다르다 — 파기는 어제 알렸고 심사는 처음일 수 있다.
   */
  const { rows: operators } = await deps.pool.query<Operator>(
    `SELECT u.id, a.subject_count AS last_count, a.sent_at AS last_sent_at
     FROM structured.users u
     LEFT JOIN LATERAL (
       SELECT subject_count, sent_at FROM structured.operator_alerts
        WHERE operator_user_id = u.id AND kind = $1::operator_alert_kind
        ORDER BY sent_at DESC LIMIT 1
     ) a ON true
     WHERE u.is_operator`,
    [subject.kind]
  );

  let notified = 0;
  let delivered = 0;
  let disabledTokens = 0;

  for (const operator of operators) {
    const decision = shouldAlert({
      dueCount: count,
      lastAlert:
        operator.last_sent_at && operator.last_count !== null
          ? { dueCount: operator.last_count, sentAt: operator.last_sent_at }
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
     * 판단해 매 10분마다 다시 쏘게 된다. 대신 delivered_to에 0이 남아,
     * 아무에게도 닿지 않았다는 사실이 드러난다.
     */
    await deps.pool.query(
      `INSERT INTO structured.operator_alerts (operator_user_id, kind, subject_count, delivered_to)
       VALUES ($1, $2::operator_alert_kind, $3, $4)`,
      [operator.id, subject.kind, count, reached]
    );

    notified += 1;
    delivered += reached;
  }

  return { dueCount: count, notified, delivered, disabledTokens };
}
