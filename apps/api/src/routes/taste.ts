import { updateTasteRequestSchema, type Taste } from '@weddingpick/api-contract';
import type { FastifyInstance } from 'fastify';

import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';

/**
 * 취향. 홈 C-1 시안 1 — 사진 넉 장으로 «어떤 결혼식을 원하세요?»를 받는 자리.
 *
 * **행이 없으면 아직 안 고른 것으로 본다.** 설정(settings.ts)과 같은 관례다 —
 * 로그인한 모든 사람에게 미리 빈 행을 만들지 않는다.
 *
 * 고를 수 있는 값은 계약(zod enum)이 지킨다 — 여기서 다시 검사하지 않는다.
 */
export function registerTasteRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  app.get('/v1/me/taste', auth, async (request) => {
    const { rows } = await context.pool.query<{ tastes: Taste[] }>(
      'SELECT tastes FROM structured.taste_preferences WHERE user_id = $1',
      [currentUserId(request)]
    );

    return { tastes: rows[0]?.tastes ?? [] };
  });

  /**
   * 고른 전체를 그대로 덮어쓴다. 하나를 눌러 빼면 그 값이 빠진 배열이 온다 —
   * "추가"가 아니라 "지금 고른 전체"를 보내는 계약이라, 부분 갱신을 시도하지
   * 않는다.
   */
  app.put('/v1/me/taste', auth, async (request) => {
    const userId = currentUserId(request);
    const body = updateTasteRequestSchema.parse(request.body);

    await context.pool.query(
      `INSERT INTO structured.taste_preferences (user_id, tastes)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE
         SET tastes = $2, updated_at = now()`,
      [userId, body.tastes]
    );

    return { tastes: body.tastes };
  });
}
