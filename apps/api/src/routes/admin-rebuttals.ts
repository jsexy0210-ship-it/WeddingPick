import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { currentUserId, requireOperator } from '../auth/plugin';
import type { AppContext } from '../context';
import { NotAnOperator } from '../decisions';
import { ApiError, forbidden, notFound } from '../errors';
import { getRebuttal, listPendingRebuttals } from '../rebuttal-admin';
import { decideRebuttal } from '../rebuttal-decide';

const decisionRequestSchema = z.object({
  note: z.string(),
  withoutClaim: z.boolean().optional(),
});

/**
 * 업체 반론 심사 API. `rebuttal-admin.ts`/`rebuttal-decide.ts`의 조회·결정을
 * 그대로 연다. 자동 게시는 없다 — 낸 사람이 정말 그 업체인지, 그 글이 반론인지
 * 사람이 본다.
 */
export function registerAdminRebuttalRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireOperator(context) };

  app.get('/v1/admin/rebuttals', auth, async () => {
    const rebuttals = await listPendingRebuttals(context.pool);

    return {
      rebuttals: rebuttals.map((row) => ({
        id: row.id,
        claimedRole: row.claimedRole,
        vendorName: row.vendorName,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  });

  app.get<{ Params: { id: string } }>('/v1/admin/rebuttals/:id', auth, async (request) => {
    const found = await getRebuttal(context.pool, request.params.id);

    if (!found) throw notFound('반론');

    return { ...found, createdAt: found.createdAt.toISOString() };
  });

  app.post<{ Params: { id: string } }>(
    '/v1/admin/rebuttals/:id/publish',
    auth,
    async (request) => {
      const by = currentUserId(request);
      const body = decisionRequestSchema.parse(request.body);

      await runAsOperator(() =>
        decideRebuttal(context.pool, {
          id: request.params.id,
          to: 'published',
          by,
          note: body.note,
          withoutClaim: body.withoutClaim,
        })
      );

      return { ok: true };
    }
  );

  app.post<{ Params: { id: string } }>('/v1/admin/rebuttals/:id/reject', auth, async (request) => {
    const by = currentUserId(request);
    const body = decisionRequestSchema.parse(request.body);

    await runAsOperator(() =>
      decideRebuttal(context.pool, { id: request.params.id, to: 'rejected', by, note: body.note })
    );

    return { ok: true };
  });
}

/**
 * `decideRebuttal`은 잘못된 상태 전이를 평범한 `Error`(일부는 그 서브클래스인
 * `RebuttalRefused`)로 던진다(CLI에서는 메시지만 찍으면 됐다). HTTP에서는
 * 이걸 400으로, `NotAnOperator`는 403으로 바꾼다.
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
