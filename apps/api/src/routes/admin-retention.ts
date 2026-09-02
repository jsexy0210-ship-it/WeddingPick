import type { FastifyInstance } from 'fastify';

import { requireOperator } from '../auth/plugin';
import type { AppContext } from '../context';
import { ApiError } from '../errors';
import {
  deleteDocument,
  listDueDocuments,
  listHeldForVerification,
  listRetentionAttention,
  markUnreachableForReview,
  sweepExpiredDocuments,
} from '../retention/worker';

/**
 * 보관 점검 API. `retention-admin.ts`/`retention/worker.ts`의 조회·수동 파기를
 * 그대로 연다. 서비스정책서 4번 — 자동삭제 실패에 알림 및 수동 처리 절차를
 * 요구한다.
 *
 * **`--operator`(운영자 지정/해제)는 여기 없다.** `retention-admin.ts`의
 * 주석대로 의도적인 설계다 — 운영자 지정을 API로 열면 스스로 올라갈 길이
 * 생긴다. 그 값은 CLI(서버·DB 직접 접근)로만 바꾼다.
 */
export function registerAdminRetentionRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireOperator(context) };

  app.get('/v1/admin/retention/due', auth, async () => {
    const [due, held] = await Promise.all([
      listDueDocuments(context.pool),
      listHeldForVerification(context.pool),
    ]);

    return {
      due: due.map((doc) => ({ ...doc, retentionUntil: doc.retentionUntil.toISOString() })),
      held: held.map((doc) => ({ ...doc, uploadedAt: doc.uploadedAt.toISOString() })),
    };
  });

  app.get('/v1/admin/retention/attention', auth, async () => {
    const attention = await listRetentionAttention(context.pool);

    return {
      attention: attention.map((doc) => ({
        ...doc,
        retentionUntil: doc.retentionUntil.toISOString(),
      })),
    };
  });

  app.post<{ Params: { id: string } }>(
    '/v1/admin/retention/documents/:id/delete',
    auth,
    async (request) => {
      const outcome = await deleteDocument(
        { pool: context.pool, storage: context.storage },
        request.params.id
      );

      if (!outcome.ok) throw new ApiError('invalid_request', outcome.reason);

      return { keysDeleted: outcome.keysDeleted };
    }
  );

  app.post('/v1/admin/retention/sweep', auth, async () => {
    const result = await sweepExpiredDocuments({ pool: context.pool, storage: context.storage });

    return result;
  });

  app.post('/v1/admin/retention/collect-unreachable', auth, async () => {
    const moved = await markUnreachableForReview(context.pool);

    return { moved };
  });
}
