import { updateTasteRequestSchema, type TasteListResponse } from '@weddingpick/api-contract';
import { reconcileTasteSelection } from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';

/**
 * 취향. 온보딩 5/5(WP-APP-021) — 핸드오프 v3.19 «취향을 다음 미완료 업종 기준으로 개편».
 *
 * **한 업종의 취향만 둔다.** 준비 현황에서 완료하지 않은 첫 업종 하나를 묻고,
 * 다시 보내면 업종째 덮어쓴다 — 아홉 업종을 모아두는 자리가 아니다.
 *
 * **행이 없으면 아직 안 고른 것으로 본다.** 설정(settings.ts)과 같은 관례다 —
 * 로그인한 모든 사람에게 미리 빈 행을 만들지 않는다.
 *
 * 고를 수 있는 값은 계약(zod · 도메인 TASTE_SETS)이 지킨다 — 여기서 다시 검사하지
 * 않는다. 읽을 때는 세트가 바뀌어 남은 모르는 키를 버린다(reconcileTasteSelection).
 */
export function registerTasteRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  app.get('/v1/me/taste', auth, async (request): Promise<TasteListResponse> => {
    const { rows } = await context.pool.query<{ taste_category: string | null; tastes: string[] }>(
      'SELECT taste_category, tastes FROM structured.taste_preferences WHERE user_id = $1',
      [currentUserId(request)]
    );

    const row = rows[0];
    const selection = reconcileTasteSelection(row?.taste_category ?? null, row?.tastes ?? []);

    return { category: selection.category, keys: [...selection.keys] };
  });

  /**
   * 고른 전체를 그대로 덮어쓴다. 하나를 눌러 빼면 그 값이 빠진 배열이 온다 —
   * "추가"가 아니라 "지금 고른 전체"를 보내는 계약이라, 부분 갱신을 시도하지
   * 않는다. 업종이 바뀌면 이전 업종의 키는 함께 사라진다.
   */
  app.put('/v1/me/taste', auth, async (request): Promise<TasteListResponse> => {
    const userId = currentUserId(request);
    const body = updateTasteRequestSchema.parse(request.body);

    await context.pool.query(
      `INSERT INTO structured.taste_preferences (user_id, taste_category, tastes)
       VALUES ($1, $2::vendor_category, $3)
       ON CONFLICT (user_id) DO UPDATE
         SET taste_category = $2::vendor_category, tastes = $3, updated_at = now()`,
      [userId, body.category, body.keys]
    );

    return { category: body.category, keys: body.keys };
  });
}
