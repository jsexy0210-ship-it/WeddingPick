import { type NotificationKind } from '@weddingpick/domain';
import type { Pool, PoolClient } from 'pg';

/**
 * 알림 한 줄을 남긴다.
 *
 * **푸시가 아니라 알림함이다.** 푸시는 지나가고 못 받는 사람도 있다. 결과를
 * 알려주는 일은 여기서 끝나야 하고, 푸시는 그 위에 얹는 것이다.
 *
 * 실패해도 부르는 쪽을 막지 않는다 — 알림을 못 남겼다고 배우자 연결이 취소되거나
 * 반론 심사가 되돌아가면, 곁가지가 본줄기를 끊는 셈이 된다. 대신 조용히 지나가지
 * 않게 로그로 남길 책임은 부르는 쪽에 있다.
 */
export async function notify(
  db: Pool | PoolClient,
  input: {
    userId: string;
    kind: NotificationKind;
    title: string;
    body: string;
    targetId?: string | null;
  }
): Promise<void> {
  await db.query(
    `INSERT INTO structured.notifications (user_id, kind, title, body, target_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.userId, input.kind, input.title, input.body, input.targetId ?? null]
  );
}

/** 안 읽은 개수와 전체. 화면이 벨의 점을 정할 때 쓴다. */
export async function notificationSummary(
  db: Pool | PoolClient,
  userId: string
): Promise<{ unread: number; total: number }> {
  const { rows } = await db.query<{ unread: string; total: string }>(
    `SELECT count(*) FILTER (WHERE read_at IS NULL) AS unread, count(*) AS total
     FROM structured.notifications
     WHERE user_id = $1`,
    [userId]
  );

  return { unread: Number(rows[0]?.unread ?? 0), total: Number(rows[0]?.total ?? 0) };
}
