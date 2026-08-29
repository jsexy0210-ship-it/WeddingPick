import type { NotificationKind } from '@weddingpick/domain';
import type { Pool } from 'pg';

import type { Push, PushMessage } from '../push/port';

/**
 * 사용자에게 알림을 보낸다. 최종통합정책 v2.0 36번.
 *
 * **알림함이 먼저고 푸시가 나중이다.** 푸시를 못 받는 기기에서도 결과를 볼 수
 * 있어야 하므로, 알림함에 남기는 것이 본체다.
 *
 * **스위치를 여기서 본다.** 끌 수 있게 만들어놓고 보내는 쪽이 그 값을 안 보면
 * 그 스위치는 장식이다. 보내는 곳이 여럿이므로 조건을 각자 적게 두지 않고,
 * 이 함수 하나가 지킨다.
 */

export type Deliverable = {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  targetId?: string | null;
  /** 같은 알림을 두 번 보내지 않기 위한 열쇠. 한 번만 일어나는 일은 비워둔다. */
  dedupeKey?: string | null;
  /**
   * 가격 변동 알림인가.
   *
   * 서비스 알림과 따로 끈다(v2.0 37번) — 자료 확인 결과는 받고 싶지만 가격
   * 알림은 시끄러운 사람이 있다.
   */
  priceChange?: boolean;
};

export type DeliveryResult = {
  /** 알림함에 새로 남은 것. 이미 같은 열쇠가 있었으면 0이다. */
  stored: number;
  /** 푸시가 닿은 기기 수. 스위치를 끈 사람에게는 0이다. */
  pushed: number;
  skipped: number;
};

type Settings = { push_enabled: boolean; price_change_enabled: boolean };

export async function deliver(
  deps: { pool: Pool; push: Push },
  items: readonly Deliverable[]
): Promise<DeliveryResult> {
  const result: DeliveryResult = { stored: 0, pushed: 0, skipped: 0 };

  for (const item of items) {
    /*
     * 알림함에는 스위치와 무관하게 남긴다.
     *
     * 스위치는 **밀어서 알려줄지**를 정하는 값이지, 결과를 감추는 값이 아니다.
     * 알림을 껐다고 자료 확인 결과가 사라지면, 그 사람은 결과를 영영 모른다.
     */
    const { rows } = await deps.pool.query<{ id: string }>(
      `INSERT INTO structured.notifications (user_id, kind, title, body, target_id, dedupe_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
       RETURNING id`,
      [item.userId, item.kind, item.title, item.body, item.targetId ?? null, item.dedupeKey ?? null]
    );

    if (rows.length === 0) {
      // 이미 보낸 알림이다. 푸시도 다시 쏘지 않는다.
      result.skipped += 1;
      continue;
    }

    result.stored += 1;

    const settings = await deps.pool.query<Settings>(
      `SELECT coalesce(s.push_enabled, true) AS push_enabled,
              coalesce(s.price_change_enabled, true) AS price_change_enabled
       FROM structured.users u
       LEFT JOIN structured.notification_settings s ON s.user_id = u.id
       WHERE u.id = $1`,
      [item.userId]
    );

    const found = settings.rows[0];
    const pushEnabled = found?.push_enabled ?? true;
    const priceEnabled = found?.price_change_enabled ?? true;

    if (!pushEnabled || (item.priceChange && !priceEnabled)) continue;

    const { rows: tokens } = await deps.pool.query<{ token: string }>(
      `SELECT token FROM structured.device_tokens
       WHERE user_id = $1 AND disabled_at IS NULL`,
      [item.userId]
    );

    if (tokens.length === 0) continue;

    const messages: PushMessage[] = tokens.map(({ token }) => ({
      token,
      title: item.title,
      body: item.body,
    }));

    const outcomes = await deps.push.send(messages);

    result.pushed += outcomes.filter((outcome) => outcome.delivered).length;
  }

  return result;
}
