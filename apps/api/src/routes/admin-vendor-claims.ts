import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { currentUserId, requireOperator } from '../auth/plugin';
import type { AppContext } from '../context';
import { NotAnOperator } from '../decisions';
import { ApiError, forbidden, notFound } from '../errors';
import { decide, getClaim, listPendingClaims } from '../vendor-claim-admin';

const decisionRequestSchema = z.object({
  note: z.string(),
});

/**
 * 업체 관계자 인증 심사 API. `vendor-claim-admin.ts`의 조회·결정을 그대로 연다.
 * 자동 승인은 없다 — 여기서도 사람(운영자)이 note를 남기고 결정해야 한다
 * (v2.0 26·27번).
 */
export function registerAdminVendorClaimRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireOperator(context) };

  app.get('/v1/admin/vendor-claims', auth, async () => {
    const claims = await listPendingClaims(context.pool);

    return {
      claims: claims.map((claim) => ({
        id: claim.id,
        vendorName: claim.vendorName,
        claimedRole: claim.claimedRole,
        method: claim.method,
        createdAt: claim.createdAt.toISOString(),
      })),
    };
  });

  app.get<{ Params: { id: string } }>('/v1/admin/vendor-claims/:id', auth, async (request) => {
    const claim = await getClaim(context.pool, request.params.id);

    if (!claim) throw notFound('신청');

    return {
      id: claim.id,
      status: claim.status,
      vendorName: claim.vendorName,
      officialDomain: claim.officialDomain,
      claimedRole: claim.claimedRole,
      method: claim.method,
      contactEmail: claim.contactEmail,
      listedAt: claim.listedAt,
      hasDocument: claim.hasDocument,
      decisionNote: claim.decisionNote,
      createdAt: claim.createdAt.toISOString(),
    };
  });

  app.post<{ Params: { id: string } }>(
    '/v1/admin/vendor-claims/:id/approve',
    auth,
    async (request) => {
      const by = currentUserId(request);
      const body = decisionRequestSchema.parse(request.body);

      await runAsOperator(() => decide(context.pool, request.params.id, 'approved', by, body.note));

      return { ok: true };
    }
  );

  app.post<{ Params: { id: string } }>(
    '/v1/admin/vendor-claims/:id/reject',
    auth,
    async (request) => {
      const by = currentUserId(request);
      const body = decisionRequestSchema.parse(request.body);

      await runAsOperator(() => decide(context.pool, request.params.id, 'rejected', by, body.note));

      return { ok: true };
    }
  );
}

/**
 * `vendor-claim-admin.ts`의 `decide`는 잘못된 상태 전이를 평범한 `Error`로
 * 던진다(CLI에서는 메시지만 찍으면 됐다). HTTP에서는 이걸 400으로 바꾼다.
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
