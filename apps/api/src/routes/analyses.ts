import type { FastifyInstance } from 'fastify';

import { assertWeddingAccess } from '../access';
import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { notFound } from '../errors';

type AnalysisRow = {
  id: string;
  wedding_id: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  quote_id: string | null;
  failure_reason: 'unreadable' | 'not_a_document' | 'internal' | null;
  started_at: Date | null;
  finished_at: Date | null;
};

export function registerAnalysisRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  app.get<{ Params: { analysisId: string } }>('/v1/analyses/:analysisId', auth, async (request) => {
    const userId = currentUserId(request);

    const { rows } = await context.pool.query<AnalysisRow>(
      `SELECT id, wedding_id, status, quote_id, failure_reason, started_at, finished_at
       FROM structured.analyses WHERE id = $1`,
      [request.params.analysisId]
    );

    const analysis = rows[0];

    if (!analysis) {
      throw notFound('분석');
    }

    await assertWeddingAccess(context.pool, analysis.wedding_id, userId);

    switch (analysis.status) {
      case 'pending':
        return { id: analysis.id, status: 'pending', startedAt: null };
      case 'running':
        return { id: analysis.id, status: 'running', startedAt: analysis.started_at!.toISOString() };
      case 'succeeded':
        return {
          id: analysis.id,
          status: 'succeeded',
          startedAt: analysis.started_at!.toISOString(),
          finishedAt: analysis.finished_at!.toISOString(),
          quoteId: analysis.quote_id!,
        };
      case 'failed':
        return {
          id: analysis.id,
          status: 'failed',
          startedAt: analysis.started_at!.toISOString(),
          finishedAt: analysis.finished_at!.toISOString(),
          reason: analysis.failure_reason!,
        };
    }
  });
}
