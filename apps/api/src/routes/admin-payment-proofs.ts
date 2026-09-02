import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { currentUserId, requireOperator } from '../auth/plugin';
import type { AppContext } from '../context';
import { NotAnOperator } from '../decisions';
import { ApiError, forbidden, notFound } from '../errors';
import { getPaymentProof, link, listUnlinkedProofs } from '../payment-proof-admin';

const linkRequestSchema = z.object({
  vendorId: z.string(),
});

/**
 * 결제인증-업체 잇기 API. `payment-proof-admin.ts`의 조회·잇기를 그대로 연다.
 * 05번 명세 20번 — 가맹점 이름이 여러 업체에 걸리면 자동으로 고르지 않는다.
 */
export function registerAdminPaymentProofRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireOperator(context) };

  app.get('/v1/admin/payment-proofs/unlinked', auth, async () => {
    const unlinked = await listUnlinkedProofs(context.pool);

    return {
      unlinked: unlinked.map((row) => ({
        id: row.id,
        merchantName: row.merchantName,
        paidAmount: row.paidAmount,
        paidAt: row.paidAt.toISOString(),
        candidateCount: row.candidateCount,
      })),
    };
  });

  app.get<{ Params: { id: string } }>(
    '/v1/admin/payment-proofs/:id',
    auth,
    async (request) => {
      const found = await getPaymentProof(context.pool, request.params.id);

      if (!found) throw notFound('결제인증');

      return {
        id: found.id,
        merchantName: found.merchantName,
        paidAmount: found.paidAmount,
        paidAt: found.paidAt.toISOString(),
        method: found.method,
        vendorId: found.vendorId,
        candidates: found.candidates,
      };
    }
  );

  app.post<{ Params: { id: string } }>(
    '/v1/admin/payment-proofs/:id/link',
    auth,
    async (request) => {
      const by = currentUserId(request);
      const body = linkRequestSchema.parse(request.body);

      await runAsOperator(() => link(context.pool, request.params.id, body.vendorId, by));

      return { ok: true };
    }
  );
}

/**
 * `payment-proof-admin.ts`의 `link`는 잘못된 상태를 평범한 `Error`로 던진다
 * (CLI에서는 메시지만 찍으면 됐다). HTTP에서는 이걸 400으로 바꾼다.
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
