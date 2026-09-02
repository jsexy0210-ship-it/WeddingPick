import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { currentUserId, requireOperator } from '../auth/plugin';
import type { AppContext } from '../context';
import { NotAnOperator } from '../decisions';
import { ApiError, forbidden, notFound } from '../errors';
import { conclude, getPiiReview, listPendingPiiReviews, redact } from '../pii-admin';

const redactRequestSchema = z.object({
  field: z.string(),
  kind: z.string(),
});

/**
 * 개인정보 재검토 API. `pii-admin.ts`의 조회·클린 확인·지운 값 기록을 그대로 연다.
 * 검토가 끝나기 전까지 그 문서 값은 남들이 보는 면(시장 대표가격·비교표)으로
 * 가지 않는다 — 서비스정책서 4번.
 */
export function registerAdminPiiRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireOperator(context) };

  app.get('/v1/admin/pii-reviews', auth, async () => {
    const reviews = await listPendingPiiReviews(context.pool);

    return {
      reviews: reviews.map((review) => ({
        id: review.id,
        createdAt: review.createdAt.toISOString(),
        personalInfoKinds: review.personalInfoKinds,
        hintCount: review.hintCount,
      })),
    };
  });

  app.get<{ Params: { quoteId: string } }>(
    '/v1/admin/pii-reviews/:quoteId',
    auth,
    async (request) => {
      const found = await getPiiReview(context.pool, request.params.quoteId);

      if (!found) throw notFound('문서');

      return {
        id: found.id,
        status: found.status,
        createdAt: found.createdAt?.toISOString() ?? null,
        personalInfoKinds: found.personalInfoKinds,
        fields: found.fields,
        hints: found.hints,
      };
    }
  );

  app.post<{ Params: { quoteId: string } }>(
    '/v1/admin/pii-reviews/:quoteId/clean',
    auth,
    async (request) => {
      const by = currentUserId(request);

      await runAsOperator(() => conclude(context.pool, request.params.quoteId, by, 'clean'));

      return { ok: true };
    }
  );

  app.post<{ Params: { quoteId: string } }>(
    '/v1/admin/pii-reviews/:quoteId/redact',
    auth,
    async (request) => {
      const by = currentUserId(request);
      const body = redactRequestSchema.parse(request.body);

      await runAsOperator(() =>
        redact(context.pool, request.params.quoteId, by, body.field, body.kind)
      );

      return { ok: true };
    }
  );
}

/**
 * `pii-admin.ts`의 동작들은 잘못된 상태 전이를 평범한 `Error`로 던진다(CLI에서는
 * 메시지만 찍으면 됐다). HTTP에서는 이걸 400으로 바꾼다.
 */
async function runAsOperator<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof NotAnOperator) throw forbidden();
    if (error instanceof ApiError) throw error;
    if (error instanceof Error) throw new ApiError('invalid_request', error.message);

    throw error;
  }
}
