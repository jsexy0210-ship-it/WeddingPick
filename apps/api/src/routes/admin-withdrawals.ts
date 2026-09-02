import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { currentUserId, requireOperator } from '../auth/plugin';
import type { AppContext } from '../context';
import { NotAnOperator } from '../decisions';
import { ApiError, forbidden } from '../errors';
import { hold, list, resume, retry, type WithdrawalAccountSummary } from '../withdrawal-admin';

const holdRequestSchema = z.object({
  reason: z.string(),
  until: z.string().datetime(),
});

const resumeRequestSchema = z.object({
  reason: z.string(),
});

function serialize(account: WithdrawalAccountSummary) {
  return {
    userId: account.userId,
    requestedAt: account.requestedAt.toISOString(),
    status: account.status,
    hold: account.hold && {
      reason: account.hold.reason,
      by: account.hold.by,
      until: account.hold.until.toISOString(),
    },
    failure: account.failure && {
      message: account.failure.message,
      attemptCount: account.failure.attemptCount,
      failedAt: account.failure.failedAt.toISOString(),
    },
  };
}

/**
 * 회원탈퇴 운영자 개입 API. `withdrawal-admin.ts`가 이미 가진 조회·보류·해제·
 * 재시도를 그대로 HTTP로 연다 — 새 권한 체계나 새 규칙을 여기서 만들지 않는다.
 *
 * 각 동작이 내부에서도 `requireOperator`를 다시 확인한다(CLI에서도 쓰이므로).
 * 여기서 또 확인하는 건 중복이 아니라 **HTTP 상태코드를 맞게 내려주기 위해서다**
 * — 관문에서 막으면 403, 안에서 막히면 이 값이 무엇으로 새는지 라우트가 모른다.
 */
export function registerAdminWithdrawalRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireOperator(context) };

  app.get('/v1/admin/withdrawals', auth, async () => {
    const accounts = await list(context.pool);

    return { accounts: accounts.map(serialize) };
  });

  app.post<{ Params: { userId: string } }>(
    '/v1/admin/withdrawals/:userId/hold',
    auth,
    async (request) => {
      const by = currentUserId(request);
      const body = holdRequestSchema.parse(request.body);

      await runAsOperator(() =>
        hold(context.pool, request.params.userId, by, body.reason, new Date(body.until))
      );

      return { ok: true };
    }
  );

  app.post<{ Params: { userId: string } }>(
    '/v1/admin/withdrawals/:userId/resume',
    auth,
    async (request) => {
      const by = currentUserId(request);
      const body = resumeRequestSchema.parse(request.body);

      await runAsOperator(() => resume(context.pool, request.params.userId, by, body.reason));

      return { ok: true };
    }
  );

  app.post<{ Params: { userId: string } }>(
    '/v1/admin/withdrawals/:userId/retry',
    auth,
    async (request) => {
      const by = currentUserId(request);

      return await runAsOperator(() =>
        retry({ pool: context.pool, storage: context.storage }, request.params.userId, by)
      );
    }
  );
}

/**
 * `withdrawal-admin.ts`의 동작들은 잘못된 상태 전이를 평범한 `Error`로 던진다
 * (CLI에서는 메시지만 찍으면 됐다). HTTP에서는 이걸 400으로 바꾼다 — 전부
 * 운영자가 읽고 고칠 수 있는 상태 설명이라 그대로 노출해도 된다.
 */
async function runAsOperator<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof NotAnOperator) throw forbidden();
    if (error instanceof Error) throw new ApiError('invalid_request', error.message);

    throw error;
  }
}
