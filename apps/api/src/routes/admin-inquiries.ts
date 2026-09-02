import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { currentUserId, requireOperator } from '../auth/plugin';
import type { AppContext } from '../context';
import { NotAnOperator } from '../decisions';
import { ApiError, forbidden, notFound } from '../errors';
import { getInquiry, listPendingInquiries, moveStatus } from '../inquiry-admin';

const answerRequestSchema = z.object({
  resolution: z.string(),
  withdrawPlanner: z.boolean().optional(),
  listPlanner: z.boolean().optional(),
});

/**
 * 문의 처리 API. `inquiry-admin.ts`의 조회·심사시작·답변을 그대로 연다.
 * 접수만 받아두고 처리할 방법이 없으면 창구가 아니라 우편함이다(서비스정책서 6번).
 */
export function registerAdminInquiryRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireOperator(context) };

  app.get('/v1/admin/inquiries', auth, async () => {
    const pending = await listPendingInquiries(context.pool);

    return {
      pending: pending.map((row) => ({
        id: row.id,
        category: row.category,
        status: row.status,
        receivedAt: row.receivedAt.toISOString(),
        subjectKind: row.subjectKind,
        subjectId: row.subjectId,
      })),
    };
  });

  app.get<{ Params: { id: string } }>('/v1/admin/inquiries/:id', auth, async (request) => {
    const found = await getInquiry(context.pool, request.params.id);

    if (!found) throw notFound('문의');

    return {
      id: found.id,
      category: found.category,
      status: found.status,
      receivedAt: found.receivedAt.toISOString(),
      subjectKind: found.subjectKind,
      subjectId: found.subjectId,
      body: found.body,
      contact: found.contact,
      resolution: found.resolution,
      events: found.events.map((event) => ({
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        note: event.note,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  });

  app.post<{ Params: { id: string } }>('/v1/admin/inquiries/:id/review', auth, async (request) => {
    const by = currentUserId(request);

    await runAsOperator(() =>
      moveStatus(context.pool, request.params.id, 'in_review', by, null, false, null)
    );

    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/v1/admin/inquiries/:id/answer', auth, async (request) => {
    const by = currentUserId(request);
    const body = answerRequestSchema.parse(request.body);

    await runAsOperator(() =>
      moveStatus(
        context.pool,
        request.params.id,
        'answered',
        by,
        body.resolution,
        body.withdrawPlanner ?? false,
        null,
        body.listPlanner ?? false
      )
    );

    return { ok: true };
  });
}

/**
 * `inquiry-admin.ts`의 동작들은 잘못된 상태 전이를 평범한 `Error`로 던진다
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
