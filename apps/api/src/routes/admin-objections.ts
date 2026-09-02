import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { currentUserId, requireOperator } from '../auth/plugin';
import type { AppContext } from '../context';
import { NotAnOperator } from '../decisions';
import { ApiError, forbidden } from '../errors';
import { listUnderObjection } from '../objection-admin';
import { holdReview, ObjectionRefused, resolveObjection } from '../objection-decide';

const holdRequestSchema = z.object({
  note: z.string(),
  days: z.number().int().positive().optional(),
});

const resolveRequestSchema = z.object({
  to: z.enum(['restore', 'remove']),
  note: z.string(),
});

/**
 * 후기 이의 처리 API. `objection-admin.ts`/`objection-decide.ts`의 조회·내려두기·
 * 결론을 그대로 연다. 서비스정책서 6번 · 정보통신망법 제44조의2 — 임시조치는
 * 기한이 지나면 저절로 다시 보인다(0050), 이 도구가 멈춰 있어도 그렇다.
 */
export function registerAdminObjectionRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireOperator(context) };

  app.get('/v1/admin/objections', auth, async () => {
    const reviews = await listUnderObjection(context.pool);

    return {
      reviews: reviews.map((row) => ({
        id: row.id,
        vendorName: row.vendorName,
        title: row.title,
        objectionHoldUntil: row.objectionHoldUntil.toISOString(),
        expired: row.expired,
      })),
    };
  });

  app.post<{ Params: { reviewId: string } }>(
    '/v1/admin/objections/:reviewId/hold',
    auth,
    async (request) => {
      const by = currentUserId(request);
      const body = holdRequestSchema.parse(request.body);

      await runAsOperator(() =>
        holdReview(context.pool, {
          reviewId: request.params.reviewId,
          by,
          note: body.note,
          days: body.days,
        })
      );

      return { ok: true };
    }
  );

  app.post<{ Params: { reviewId: string } }>(
    '/v1/admin/objections/:reviewId/resolve',
    auth,
    async (request) => {
      const by = currentUserId(request);
      const body = resolveRequestSchema.parse(request.body);

      await runAsOperator(() =>
        resolveObjection(context.pool, {
          reviewId: request.params.reviewId,
          to: body.to,
          by,
          note: body.note,
        })
      );

      return { ok: true };
    }
  );
}

/**
 * 잘못된 상태 전이는 `ObjectionRefused`, 운영자 아님은 `NotAnOperator`로
 * 온다. HTTP에서는 각각 400/403으로 바꾼다.
 */
async function runAsOperator<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof NotAnOperator) throw forbidden();
    if (error instanceof ObjectionRefused) throw new ApiError('invalid_request', error.message);
    if (error instanceof ApiError) throw error;

    throw error;
  }
}
