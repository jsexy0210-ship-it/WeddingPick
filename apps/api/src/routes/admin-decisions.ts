import type { FastifyInstance } from 'fastify';

import { requireOperator } from '../auth/plugin';
import type { AppContext } from '../context';
import { getBriefing, getEventDecisions, listOpenDecisions } from '../decisions-admin';
import { notFound } from '../errors';

/**
 * 자동 결정 조회 API. `decisions-admin.ts`를 그대로 연다 — 여기서는 아무것도
 * 처리하지 않는다. 처리는 각 도구(rebuttals·inquiries·verifications)가 하고,
 * 이건 어디를 봐야 하는지만 말한다(v2.0 H장).
 */
export function registerAdminDecisionRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireOperator(context) };

  app.get('/v1/admin/decisions/briefing', auth, async () => {
    const briefing = await getBriefing(context.pool);

    return { briefing };
  });

  app.get('/v1/admin/decisions/open', auth, async () => {
    const open = await listOpenDecisions(context.pool);

    return {
      open: open.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    };
  });

  app.get<{ Params: { eventId: string } }>(
    '/v1/admin/decisions/events/:eventId',
    auth,
    async (request) => {
      const steps = await getEventDecisions(context.pool, request.params.eventId);

      if (steps.length === 0) throw notFound('사건');

      return {
        eventId: request.params.eventId,
        steps: steps.map((step) => ({ ...step, createdAt: step.createdAt.toISOString() })),
      };
    }
  );
}
