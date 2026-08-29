import { NOTIFICATION_KIND_LABEL, type NotificationKind } from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { notFound } from '../errors';
import { notificationSummary } from '../notify';

/**
 * 최근 것만 내려간다.
 *
 * 안 읽은 개수는 이 목록에서 세지 않는다 — 오래된 안 읽은 알림이 잘려 나가면
 * 홈의 점이 꺼지고, 알림함에 들어가면 다시 켜지는 이상한 일이 생긴다.
 */
const PAGE_SIZE = 50;

type NotificationRow = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  target_id: string | null;
  created_at: Date;
  read_at: Date | null;
};

export function registerNotificationRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  app.get('/v1/me/notifications', auth, async (request) => {
    const userId = currentUserId(request);

    const { rows } = await context.pool.query<NotificationRow>(
      `SELECT id, kind, title, body, target_id, created_at, read_at
       FROM structured.notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, PAGE_SIZE]
    );

    const summary = await notificationSummary(context.pool, userId);

    return {
      notifications: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        kindLabel: NOTIFICATION_KIND_LABEL[row.kind],
        title: row.title,
        body: row.body,
        targetId: row.target_id,
        createdAt: row.created_at.toISOString(),
        readAt: row.read_at?.toISOString() ?? null,
      })),
      ...summary,
    };
  });

  /** 홈이 벨 하나 때문에 목록 전체를 받지 않도록. */
  app.get('/v1/me/notifications/summary', auth, async (request) =>
    notificationSummary(context.pool, currentUserId(request))
  );

  app.post<{ Params: { notificationId: string } }>(
    '/v1/me/notifications/:notificationId/read',
    auth,
    async (request) => {
      const userId = currentUserId(request);

      /*
       * 남의 알림을 읽음으로 바꿀 수 없다. WHERE에 user_id를 함께 둬서, 없는
       * 알림과 남의 알림이 같은 답(못 찾음)을 받게 한다 — 다르게 답하면 남의
       * 알림 id가 실재하는지 알아낼 수 있다.
       */
      const { rowCount } = await context.pool.query(
        `UPDATE structured.notifications
         SET read_at = coalesce(read_at, now())
         WHERE id = $1 AND user_id = $2`,
        [request.params.notificationId, userId]
      );

      if (rowCount === 0) throw notFound('알림');

      return await notificationSummary(context.pool, userId);
    }
  );

  app.post('/v1/me/notifications/read-all', auth, async (request) => {
    const userId = currentUserId(request);

    await context.pool.query(
      `UPDATE structured.notifications SET read_at = now()
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );

    return await notificationSummary(context.pool, userId);
  });
}
