import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { currentUserId, requireOperator } from '../auth/plugin';
import type { AppContext } from '../context';
import { NotAnOperator } from '../decisions';
import { ApiError, forbidden, notFound } from '../errors';
import {
  approve,
  getVerification,
  listBacklog,
  listPending,
  reject,
  startReview,
} from '../verification-admin';

const approveRequestSchema = z.object({
  note: z.string().nullable().optional(),
});

const rejectRequestSchema = z.object({
  reason: z.string(),
});

/**
 * 인증 심사 API. `verification-admin.ts`의 조회·심사시작·승인·반려를 그대로 연다.
 * A-13은 신청을 접수만 하고, 등급은 여기서 사람이 증빙을 보고 나서야 오른다
 * (서비스정책서 7번).
 */
export function registerAdminVerificationRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireOperator(context) };

  app.get('/v1/admin/verifications', auth, async () => {
    const pending = await listPending(context.pool);

    return {
      pending: pending.map((row) => ({
        id: row.id,
        targetLevel: row.targetLevel,
        status: row.status,
        receivedAt: row.receivedAt.toISOString(),
        totalAmount: row.totalAmount,
        evidenceKinds: row.evidenceKinds,
      })),
    };
  });

  app.get('/v1/admin/verifications/backlog', auth, async () => {
    const backlog = await listBacklog(context.pool);

    return { backlog };
  });

  app.get<{ Params: { id: string } }>('/v1/admin/verifications/:id', auth, async (request) => {
    const found = await getVerification(context.pool, request.params.id);

    if (!found) throw notFound('신청');

    return {
      id: found.id,
      targetLevel: found.targetLevel,
      status: found.status,
      receivedAt: found.receivedAt.toISOString(),
      rejectionReason: found.rejectionReason,
      requestedBy: found.requestedBy,
      verificationLevel: found.verificationLevel,
      totalAmount: found.totalAmount,
      evidenceKinds: found.evidenceKinds,
      events: found.events.map((event) => ({
        kind: event.kind,
        actorUserId: event.actorUserId,
        note: event.note,
        occurredAt: event.occurredAt.toISOString(),
      })),
    };
  });

  app.post<{ Params: { id: string } }>(
    '/v1/admin/verifications/:id/review',
    auth,
    async (request) => {
      const by = currentUserId(request);

      await runAsOperator(() => startReview(context.pool, request.params.id, by));

      return { ok: true };
    }
  );

  app.post<{ Params: { id: string } }>(
    '/v1/admin/verifications/:id/approve',
    auth,
    async (request) => {
      const by = currentUserId(request);
      const body = approveRequestSchema.parse(request.body ?? {});

      await runAsOperator(() => approve(context.pool, request.params.id, by, body.note ?? null));

      return { ok: true };
    }
  );

  app.post<{ Params: { id: string } }>(
    '/v1/admin/verifications/:id/reject',
    auth,
    async (request) => {
      const by = currentUserId(request);
      const body = rejectRequestSchema.parse(request.body);

      await runAsOperator(() => reject(context.pool, request.params.id, by, body.reason));

      return { ok: true };
    }
  );
}

/**
 * `verification-admin.ts`의 동작들은 잘못된 상태 전이를 평범한 `Error`로 던진다
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
