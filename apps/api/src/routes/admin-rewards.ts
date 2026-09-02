import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { currentUserId, requireOperator } from '../auth/plugin';
import type { AppContext } from '../context';
import { NotAnOperator } from '../decisions';
import { ApiError, forbidden } from '../errors';
import { decideReward, listRewardGrants } from '../reward-admin';

const decisionRequestSchema = z.object({
  note: z.string(),
});

/**
 * 보상 지급 확인 API. `reward-admin.ts`의 조회·결정을 그대로 연다. 최종통합정책
 * v2.0 I장 — 돈을 보내는 것은 이 도구가 아니다. 사람이 NPay로 보내고, 보냈다는
 * 사실을 여기 적는다.
 */
export function registerAdminRewardRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireOperator(context) };

  app.get('/v1/admin/rewards', auth, async () => {
    const grants = await listRewardGrants(context.pool, 'earned');

    return { grants: grants.map(serialize) };
  });

  app.get('/v1/admin/rewards/held', auth, async () => {
    const grants = await listRewardGrants(context.pool, 'held');

    return { grants: grants.map(serialize) };
  });

  app.post<{ Params: { id: string } }>('/v1/admin/rewards/:id/paid', auth, async (request) => {
    const by = currentUserId(request);
    const body = decisionRequestSchema.parse(request.body);

    await runAsOperator(() => decideReward(context.pool, request.params.id, 'paid', by, body.note));

    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/v1/admin/rewards/:id/block', auth, async (request) => {
    const by = currentUserId(request);
    const body = decisionRequestSchema.parse(request.body);

    await runAsOperator(() =>
      decideReward(context.pool, request.params.id, 'blocked', by, body.note)
    );

    return { ok: true };
  });
}

function serialize(grant: Awaited<ReturnType<typeof listRewardGrants>>[number]) {
  return {
    id: grant.id,
    kind: grant.kind,
    amountKrw: grant.amountKrw,
    reasonCode: grant.reasonCode,
    createdAt: grant.createdAt.toISOString(),
    url: grant.url,
  };
}

/**
 * `reward-admin.ts`의 `decideReward`는 잘못된 상태 전이를 평범한 `Error`로
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
