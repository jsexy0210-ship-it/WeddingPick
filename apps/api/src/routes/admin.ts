import { isFeature } from '../ai-cost-admin';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import * as adAdmin from '../ad-admin';
import * as aiCostAdmin from '../ai-cost-admin';
import { currentUserId, requireOperatorUser } from '../auth/plugin';
import type { AppContext } from '../context';
import * as decisionsAdmin from '../decisions-admin';
import { NotAnOperator } from '../decisions';
import { ApiError, forbidden, notFound } from '../errors';
import * as inquiryAdmin from '../inquiry-admin';
import { holdReview, resolveObjection } from '../objection-decide';
import * as objectionAdmin from '../objection-admin';
import * as paymentProofAdmin from '../payment-proof-admin';
import * as piiAdmin from '../pii-admin';
import { decideRebuttal } from '../rebuttal-decide';
import * as rebuttalAdmin from '../rebuttal-admin';
import * as retentionWorker from '../retention/worker';
import * as rewardAdmin from '../reward-admin';
import * as vendorClaimAdmin from '../vendor-claim-admin';
import * as verificationAdmin from '../verification-admin';
import * as withdrawalAdmin from '../withdrawal-admin';

/**
 * 관리자 콘솔 라우트. 최종통합정책 v2.0 H장.
 *
 * 13개의 CLI 전용 운영 도구(`*-admin.ts`)를 그대로 HTTP 위에 올린다. 로직은
 * 이미 각 도구에 있다 — 여기서는 요청을 그 함수 호출로 바꾸고, 응답을 사람이
 * 아니라 화면이 읽는 JSON으로 바꿀 뿐이다.
 *
 * **관문은 라우트 맨 앞, 대상을 찾기도 전이다**(`requireOperatorUser`). CLI
 * 시절에는 조회(`list`/`show`)가 권한을 보지 않았다 — 서버에 접근할 수 있는
 * 사람만 CLI를 돌릴 수 있다는 것이 유일한 통제였다. HTTP로 옮기면 그 암묵적
 * 경계가 사라지므로, 조회든 결정이든 이 라우트는 전부 같은 관문을 지난다.
 *
 * 도구 함수가 던지는 일반 `Error`(예: "없는 신청이다.", "이미 처리된 상태다.")는
 * 사람이 읽으라고 쓴 말이다. `invalid_request`로 그대로 보낸다 — 안쪽 사정을
 * 감출 이유가 없다.
 *
 * **`retention --operator` 부트스트랩은 여기 없다.** 최초의 운영자를 만드는
 * 길이고, 운영자만 쓸 수 있는 라우트 안에 두면 최초의 운영자를 만들 수 없다.
 * CLI로만 남겨둔다.
 */
export function registerAdminRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireOperatorUser(context) };

  /** 도구 함수의 일반 Error를 사람이 읽는 400으로 바꾼다. */
  async function run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof NotAnOperator) throw forbidden();
      if (error instanceof Error) throw new ApiError('invalid_request', error.message);
      throw error;
    }
  }

  // ── 결정 브리핑 ──────────────────────────────────────────────
  app.get('/v1/admin/decisions/briefing', auth, async () => ({
    rows: await decisionsAdmin.briefing(context.pool),
  }));

  app.get('/v1/admin/decisions/open', auth, async () => ({
    rows: await decisionsAdmin.openDecisions(context.pool),
  }));

  app.get<{ Params: { eventId: string } }>(
    '/v1/admin/decisions/events/:eventId',
    auth,
    async (request) => {
      const rows = await decisionsAdmin.eventTimeline(context.pool, request.params.eventId);
      if (rows.length === 0) throw notFound('사건');
      return { rows };
    }
  );

  // ── 반론 ────────────────────────────────────────────────────
  app.get('/v1/admin/rebuttals', auth, async () => ({
    rebuttals: await rebuttalAdmin.list(context.pool),
  }));

  app.get<{ Params: { id: string } }>('/v1/admin/rebuttals/:id', auth, async (request) => {
    const found = await rebuttalAdmin.show(context.pool, request.params.id);
    if (!found) throw notFound('반론');
    return found;
  });

  const rebuttalDecisionBodySchema = z.object({
    note: z.string().trim().min(1),
    withoutClaim: z.boolean().optional(),
  });

  app.post<{ Params: { id: string } }>(
    '/v1/admin/rebuttals/:id/publish',
    auth,
    async (request, reply) => {
      const body = rebuttalDecisionBodySchema.parse(request.body);

      await run(() =>
        decideRebuttal(context.pool, {
          id: request.params.id,
          to: 'published',
          by: currentUserId(request),
          note: body.note,
          withoutClaim: body.withoutClaim,
        })
      );

      return reply.status(204).send();
    }
  );

  app.post<{ Params: { id: string } }>(
    '/v1/admin/rebuttals/:id/reject',
    auth,
    async (request, reply) => {
      const body = rebuttalDecisionBodySchema.parse(request.body);

      await run(() =>
        decideRebuttal(context.pool, {
          id: request.params.id,
          to: 'rejected',
          by: currentUserId(request),
          note: body.note,
        })
      );

      return reply.status(204).send();
    }
  );

  // ── 후기 이의 ────────────────────────────────────────────────
  app.get('/v1/admin/objections', auth, async () => ({
    objections: await objectionAdmin.list(context.pool),
  }));

  const holdObjectionBodySchema = z.object({
    note: z.string().trim().min(1),
    days: z.number().int().positive().optional(),
  });

  app.post<{ Params: { reviewId: string } }>(
    '/v1/admin/objections/:reviewId/hold',
    auth,
    async (request, reply) => {
      const body = holdObjectionBodySchema.parse(request.body);

      await run(() =>
        holdReview(context.pool, {
          reviewId: request.params.reviewId,
          by: currentUserId(request),
          note: body.note,
          days: body.days,
        })
      );

      return reply.status(204).send();
    }
  );

  const resolveObjectionBodySchema = z.object({ note: z.string().trim().min(1) });

  for (const [path, to] of [
    ['restore', 'restore'],
    ['remove', 'remove'],
  ] as const) {
    app.post<{ Params: { reviewId: string } }>(
      `/v1/admin/objections/:reviewId/${path}`,
      auth,
      async (request, reply) => {
        const body = resolveObjectionBodySchema.parse(request.body);

        await run(() =>
          resolveObjection(context.pool, {
            reviewId: request.params.reviewId,
            to,
            by: currentUserId(request),
            note: body.note,
          })
        );

        return reply.status(204).send();
      }
    );
  }

  // ── 인증 심사 ────────────────────────────────────────────────
  app.get('/v1/admin/verifications', auth, async () => ({
    requests: await verificationAdmin.list(context.pool),
  }));

  app.get('/v1/admin/verifications/backlog', auth, async () => ({
    requests: await verificationAdmin.backlog(context.pool),
  }));

  app.get<{ Params: { id: string } }>('/v1/admin/verifications/:id', auth, async (request) => {
    const found = await verificationAdmin.show(context.pool, request.params.id);
    if (!found) throw notFound('인증 신청');
    return found;
  });

  app.post<{ Params: { id: string } }>(
    '/v1/admin/verifications/:id/review',
    auth,
    async (request, reply) => {
      await run(() => verificationAdmin.startReview(context.pool, request.params.id, currentUserId(request)));
      return reply.status(204).send();
    }
  );

  const approveVerificationBodySchema = z.object({ note: z.string().trim().min(1).nullable().optional() });

  app.post<{ Params: { id: string } }>(
    '/v1/admin/verifications/:id/approve',
    auth,
    async (request, reply) => {
      const body = approveVerificationBodySchema.parse(request.body ?? {});

      await run(() =>
        verificationAdmin.approve(context.pool, request.params.id, currentUserId(request), body.note ?? null)
      );

      return reply.status(204).send();
    }
  );

  const rejectVerificationBodySchema = z.object({ reason: z.string().trim().min(1) });

  app.post<{ Params: { id: string } }>(
    '/v1/admin/verifications/:id/reject',
    auth,
    async (request, reply) => {
      const body = rejectVerificationBodySchema.parse(request.body);

      await run(() =>
        verificationAdmin.reject(context.pool, request.params.id, currentUserId(request), body.reason)
      );

      return reply.status(204).send();
    }
  );

  // ── 업체 관계자 인증 ─────────────────────────────────────────
  app.get('/v1/admin/vendor-claims', auth, async () => ({
    claims: await vendorClaimAdmin.list(context.pool),
  }));

  app.get<{ Params: { id: string } }>('/v1/admin/vendor-claims/:id', auth, async (request) => {
    const found = await vendorClaimAdmin.show(context.pool, request.params.id);
    if (!found) throw notFound('신청');
    return found;
  });

  const vendorClaimDecisionBodySchema = z.object({ note: z.string().trim().min(1) });

  for (const [path, to] of [
    ['approve', 'approved'],
    ['reject', 'rejected'],
  ] as const) {
    app.post<{ Params: { id: string } }>(
      `/v1/admin/vendor-claims/:id/${path}`,
      auth,
      async (request, reply) => {
        const body = vendorClaimDecisionBodySchema.parse(request.body);

        await run(() =>
          vendorClaimAdmin.decide(context.pool, request.params.id, to, currentUserId(request), body.note)
        );

        return reply.status(204).send();
      }
    );
  }

  // ── 문의 ────────────────────────────────────────────────────
  app.get('/v1/admin/inquiries', auth, async () => ({
    inquiries: await inquiryAdmin.list(context.pool),
  }));

  app.get<{ Params: { id: string } }>('/v1/admin/inquiries/:id', auth, async (request) => {
    const found = await inquiryAdmin.show(context.pool, request.params.id);
    if (!found) throw notFound('문의');
    return found;
  });

  app.post<{ Params: { id: string } }>(
    '/v1/admin/inquiries/:id/review',
    auth,
    async (request, reply) => {
      await run(() =>
        inquiryAdmin.moveStatus(context.pool, request.params.id, 'in_review', currentUserId(request), null, false, null)
      );

      return reply.status(204).send();
    }
  );

  const answerInquiryBodySchema = z.object({
    resolution: z.string().trim().min(1),
    withdrawPlanner: z.boolean().optional(),
    listPlanner: z.boolean().optional(),
  });

  app.post<{ Params: { id: string } }>(
    '/v1/admin/inquiries/:id/answer',
    auth,
    async (request, reply) => {
      const body = answerInquiryBodySchema.parse(request.body);

      await run(() =>
        inquiryAdmin.moveStatus(
          context.pool,
          request.params.id,
          'answered',
          currentUserId(request),
          body.resolution,
          body.withdrawPlanner ?? false,
          null,
          body.listPlanner ?? false
        )
      );

      return reply.status(204).send();
    }
  );

  // ── 개인정보 재검토 ──────────────────────────────────────────
  app.get('/v1/admin/pii-reviews', auth, async () => ({
    reviews: await piiAdmin.list(context.pool),
  }));

  app.get<{ Params: { quoteId: string } }>(
    '/v1/admin/pii-reviews/:quoteId',
    auth,
    async (request) => {
      const found = await piiAdmin.show(context.pool, request.params.quoteId);
      if (!found) throw notFound('문서');
      return found;
    }
  );

  app.post<{ Params: { quoteId: string } }>(
    '/v1/admin/pii-reviews/:quoteId/clean',
    auth,
    async (request, reply) => {
      await run(() => piiAdmin.conclude(context.pool, request.params.quoteId, currentUserId(request), 'clean'));
      return reply.status(204).send();
    }
  );

  const redactPiiBodySchema = z.object({
    field: z.string().trim().min(1),
    kind: z.string().trim().min(1),
  });

  app.post<{ Params: { quoteId: string } }>(
    '/v1/admin/pii-reviews/:quoteId/redact',
    auth,
    async (request, reply) => {
      const body = redactPiiBodySchema.parse(request.body);

      await run(() =>
        piiAdmin.redact(context.pool, request.params.quoteId, currentUserId(request), body.field, body.kind)
      );

      return reply.status(204).send();
    }
  );

  // ── 결제인증 잇기 ────────────────────────────────────────────
  app.get('/v1/admin/payment-proofs', auth, async () => ({
    proofs: await paymentProofAdmin.list(context.pool),
  }));

  app.get<{ Params: { id: string } }>('/v1/admin/payment-proofs/:id', auth, async (request) => {
    const found = await paymentProofAdmin.show(context.pool, request.params.id);
    if (!found) throw notFound('결제인증');
    return found;
  });

  const linkPaymentProofBodySchema = z.object({ vendorId: z.string().trim().min(1) });

  app.post<{ Params: { id: string } }>(
    '/v1/admin/payment-proofs/:id/link',
    auth,
    async (request, reply) => {
      const body = linkPaymentProofBodySchema.parse(request.body);

      await run(() =>
        paymentProofAdmin.link(context.pool, request.params.id, body.vendorId, currentUserId(request))
      );

      return reply.status(204).send();
    }
  );

  // ── 보상 지급 ───────────────────────────────────────────────
  const rewardStatusQuerySchema = z.object({ status: z.enum(['earned', 'held']).default('earned') });

  app.get('/v1/admin/rewards', auth, async (request) => {
    const query = rewardStatusQuerySchema.parse(request.query ?? {});
    return { rewards: await rewardAdmin.list(context.pool, query.status) };
  });

  const rewardDecisionBodySchema = z.object({ note: z.string().trim().min(1) });

  for (const [path, to] of [
    ['pay', 'paid'],
    ['block', 'blocked'],
  ] as const) {
    app.post<{ Params: { id: string } }>(
      `/v1/admin/rewards/:id/${path}`,
      auth,
      async (request, reply) => {
        const body = rewardDecisionBodySchema.parse(request.body);

        await run(() =>
          rewardAdmin.decide(context.pool, request.params.id, to, currentUserId(request), body.note)
        );

        return reply.status(204).send();
      }
    );
  }

  // ── 회원탈퇴 운영자 개입 ─────────────────────────────────────
  app.get('/v1/admin/withdrawals', auth, async () => ({
    accounts: await withdrawalAdmin.list(context.pool),
  }));

  const holdWithdrawalBodySchema = z.object({
    reason: z.string().trim().min(1),
    until: z.iso.datetime(),
  });

  app.post<{ Params: { userId: string } }>(
    '/v1/admin/withdrawals/:userId/hold',
    auth,
    async (request, reply) => {
      const body = holdWithdrawalBodySchema.parse(request.body);

      await run(() =>
        withdrawalAdmin.hold(
          context.pool,
          request.params.userId,
          currentUserId(request),
          body.reason,
          new Date(body.until)
        )
      );

      return reply.status(204).send();
    }
  );

  const resumeWithdrawalBodySchema = z.object({ reason: z.string().trim().min(1) });

  app.post<{ Params: { userId: string } }>(
    '/v1/admin/withdrawals/:userId/resume',
    auth,
    async (request, reply) => {
      const body = resumeWithdrawalBodySchema.parse(request.body);

      await run(() =>
        withdrawalAdmin.resume(context.pool, request.params.userId, currentUserId(request), body.reason)
      );

      return reply.status(204).send();
    }
  );

  app.post<{ Params: { userId: string } }>(
    '/v1/admin/withdrawals/:userId/retry',
    auth,
    async (request) =>
      run(() =>
        withdrawalAdmin.retry(
          { pool: context.pool, storage: context.storage },
          request.params.userId,
          currentUserId(request)
        )
      )
  );

  // ── 보관 점검 ───────────────────────────────────────────────
  app.get('/v1/admin/retention/due', auth, async () => ({
    documents: await retentionWorker.listDueDocuments(context.pool),
  }));

  app.get('/v1/admin/retention/attention', auth, async () => ({
    documents: await retentionWorker.listRetentionAttention(context.pool),
  }));

  app.get('/v1/admin/retention/held', auth, async () => ({
    documents: await retentionWorker.listHeldForVerification(context.pool),
  }));

  app.get('/v1/admin/retention/failed', auth, async () => ({
    documents: await retentionWorker.listFailedDeletions(context.pool),
  }));

  app.post<{ Params: { documentId: string } }>(
    '/v1/admin/retention/:documentId/delete',
    auth,
    async (request) =>
      run(async () => {
        const outcome = await retentionWorker.deleteDocument(
          { pool: context.pool, storage: context.storage },
          request.params.documentId,
          currentUserId(request)
        );

        if (!outcome.ok) throw new Error(outcome.reason);

        return { keysDeleted: outcome.keysDeleted };
      })
  );

  app.post('/v1/admin/retention/sweep', auth, async () =>
    retentionWorker.sweepExpiredDocuments({ pool: context.pool, storage: context.storage })
  );

  app.post('/v1/admin/retention/collect-unreachable', auth, async () => ({
    moved: await retentionWorker.markUnreachableForReview(context.pool),
  }));

  // ── 광고 지면 ───────────────────────────────────────────────
  app.get('/v1/admin/ad-placements', auth, async () => ({
    placements: await adAdmin.list(context.pool),
  }));

  app.get('/v1/admin/ad-placements/firewall', auth, async () => adAdmin.firewallNotice());

  const addPlacementBodySchema = z.object({
    vendorId: z.string().trim().min(1),
    surface: z.string().trim().min(1),
    tier: z.string().trim().min(1),
    category: z.string().trim().min(1).optional(),
    region: z.string().trim().min(1).optional(),
    from: z.string().trim().min(1),
    to: z.string().trim().min(1),
  });

  app.post('/v1/admin/ad-placements', auth, async (request, reply) => {
    const body = addPlacementBodySchema.parse(request.body);
    const placementId = await run(() => adAdmin.add(context.pool, body, currentUserId(request)));

    return reply.status(201).send({ placementId });
  });

  app.delete<{ Params: { id: string } }>(
    '/v1/admin/ad-placements/:id',
    auth,
    async (request, reply) => {
      const removed = await run(() => adAdmin.remove(context.pool, request.params.id, currentUserId(request)));

      if (!removed) throw notFound('광고 자리');

      return reply.status(204).send();
    }
  );

  // ── AI 사용량과 예산 ────────────────────────────────────────
  app.get('/v1/admin/ai-budget/status', auth, async () => ({
    status: await aiCostAdmin.status(context.pool),
  }));

  const aiUsageQuerySchema = z.object({ months: z.coerce.number().int().positive().default(3) });

  app.get('/v1/admin/ai-budget/usage', auth, async (request) => {
    const query = aiUsageQuerySchema.parse(request.query ?? {});
    return { usage: await aiCostAdmin.usage(context.pool, query.months) };
  });

  const setBudgetBodySchema = z.object({ amount: z.number().positive() });

  app.post<{ Params: { feature: string } }>(
    '/v1/admin/ai-budget/:feature',
    auth,
    async (request, reply) => {
      const { feature } = request.params;
      if (!isFeature(feature)) throw new ApiError('invalid_request', '없는 기능이다.');

      const body = setBudgetBodySchema.parse(request.body);

      await run(() => aiCostAdmin.setBudget(context.pool, feature, body.amount, currentUserId(request)));

      return reply.status(204).send();
    }
  );

  app.delete<{ Params: { feature: string } }>(
    '/v1/admin/ai-budget/:feature',
    auth,
    async (request, reply) => {
      const { feature } = request.params;
      if (!isFeature(feature)) throw new ApiError('invalid_request', '없는 기능이다.');

      await run(() => aiCostAdmin.clearBudget(context.pool, feature, currentUserId(request)));

      return reply.status(204).send();
    }
  );
}
