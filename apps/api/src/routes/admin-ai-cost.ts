import { AI_FEATURES } from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { clearBudget, getBudgetStatus, getUsage, isFeature, setBudget } from '../ai-cost-admin';
import { currentUserId, requireOperator } from '../auth/plugin';
import type { AppContext } from '../context';
import { NotAnOperator } from '../decisions';
import { ApiError, forbidden } from '../errors';

const featureSchema = z.string().refine(isFeature, {
  message: `기능을 골라라: ${AI_FEATURES.join(' | ')}`,
});

const setBudgetRequestSchema = z.object({
  feature: featureSchema,
  amountUsd: z.number().positive(),
});

/**
 * AI 사용량·예산 API. `ai-cost-admin.ts`의 조회·한도 설정/해제를 그대로 연다.
 * 화면데이터구조 스펙 7.3 — 재는 것을 만들어 놓고 볼 방법이 없으면 재지 않은
 * 것과 같다.
 */
export function registerAdminAiCostRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireOperator(context) };

  app.get('/v1/admin/ai-cost/status', auth, async () => {
    const status = await getBudgetStatus(context.pool);

    return { status };
  });

  app.get<{ Querystring: { months?: string } }>(
    '/v1/admin/ai-cost/usage',
    auth,
    async (request) => {
      const parsedMonths = Number(request.query.months);
      const months = Number.isFinite(parsedMonths) && parsedMonths > 0 ? parsedMonths : 3;
      const usage = await getUsage(context.pool, months);

      return {
        usage: usage.map((row) => ({ ...row, month: row.month.toISOString().slice(0, 7) })),
      };
    }
  );

  app.post('/v1/admin/ai-cost/budget', auth, async (request) => {
    const by = currentUserId(request);
    const body = setBudgetRequestSchema.parse(request.body);

    await runAsOperator(() => setBudget(context.pool, body.feature, body.amountUsd, by));

    return { ok: true };
  });

  app.delete<{ Params: { feature: string } }>(
    '/v1/admin/ai-cost/budget/:feature',
    auth,
    async (request) => {
      const by = currentUserId(request);
      const feature = request.params.feature;

      if (!isFeature(feature)) {
        throw new ApiError('invalid_request', `기능을 골라라: ${AI_FEATURES.join(' | ')}`);
      }

      await runAsOperator(() => clearBudget(context.pool, feature, by));

      return { ok: true };
    }
  );
}

/**
 * `ai-cost-admin.ts`의 동작들은 잘못된 상태를 평범한 `Error`로 던진다
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
