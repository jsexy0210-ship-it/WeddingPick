import { randomUUID } from 'node:crypto';

import { isFeature } from '../ai-cost-admin';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { MarketingChannel, MarketingFormat } from '@weddingpick/api-contract';
import * as marketingContent from '../marketing/content';
import * as marketingStore from '../marketing/store';
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
type KillSwitch = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: string;
  lastChangedAt: string | null;
  lastChangedBy: string | null;
};

const killSwitches = new Map<string, KillSwitch>([
  ['ai-recommendations', { id: 'ai-recommendations', name: 'AI 추천', description: 'AI 기반 업체 추천 기능을 중지합니다', enabled: true, category: 'AI', lastChangedAt: null, lastChangedBy: null }],
  ['ai-verification', { id: 'ai-verification', name: 'AI 검증', description: '문서 AI 자동 검증을 중지합니다', enabled: true, category: 'AI', lastChangedAt: null, lastChangedBy: null }],
  ['ai-matching', { id: 'ai-matching', name: 'AI 매칭', description: '이메일 자동 매칭을 중지합니다', enabled: true, category: 'AI', lastChangedAt: null, lastChangedBy: null }],
  ['stats-update', { id: 'stats-update', name: '통계 반영', description: '가격 통계 자동 갱신을 중지합니다', enabled: true, category: '운영', lastChangedAt: null, lastChangedBy: null }],
  ['reward-payout', { id: 'reward-payout', name: '보상 지급', description: '친구 초대·홍보 보상 자동 지급을 중지합니다', enabled: true, category: '운영', lastChangedAt: null, lastChangedBy: null }],
  ['auto-publish', { id: 'auto-publish', name: '자동 게시', description: '후기·반론 자동 게시를 중지합니다', enabled: true, category: '운영', lastChangedAt: null, lastChangedBy: null }],
]);

/*
 * 수집 중단 스위치는 위 Map과 달리 DB(`structured.import_switches`)에 있다.
 * `public-data/sync.ts`가 임포트 직전에 이 값을 읽어 `SOURCE_DISABLED`로 거부하므로,
 * 여기서 끄면 배포 없이 그 출처의 수집이 실제로 멈춘다. 프로세스 메모리에 두면
 * 재시작에 사라지고, 별도 프로세스로 도는 임포트에는 보이지도 않는다.
 */
const IMPORT_SWITCH_PREFIX = 'import:';

type ImportSwitchRow = {
  source_key: string;
  enabled: boolean;
  reason: string | null;
  updated_at: Date | string | null;
};

function toImportKillSwitch(row: ImportSwitchRow): KillSwitch {
  return {
    id: `${IMPORT_SWITCH_PREFIX}${row.source_key}`,
    name: `수집 — ${row.source_key}`,
    description: row.reason ?? '이 출처의 공개 데이터 수집을 중지합니다',
    enabled: row.enabled,
    category: '수집',
    lastChangedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    lastChangedBy: null,
  };
}

function mapCopyrightBasis(
  basis: string
): 'licensed' | 'public_domain' | 'vendor_provided' | 'pending' | 'rejected' {
  if (basis === 'vendor_provided') return 'vendor_provided';
  if (basis === 'public_domain') return 'public_domain';
  if (basis === 'unknown') return 'pending';
  if (basis.startsWith('cc_') || basis.startsWith('kogl_')) return 'licensed';
  return 'pending';
}

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

  const supplementVerificationBodySchema = z.object({ reason: z.string().trim().min(1) });

  app.post<{ Params: { id: string } }>(
    '/v1/admin/verifications/:id/supplement',
    auth,
    async (request, reply) => {
      const body = supplementVerificationBodySchema.parse(request.body);
      await run(() =>
        verificationAdmin.requestSupplement(context.pool, request.params.id, currentUserId(request), body.reason)
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

  /**
   * 가격 이상치 탐지. 관리자 > 통계·이상치 화면(ADM-STATS).
   *
   * 카테고리별로 결제 금액의 평균·표준편차를 계산하고, 평균 + 3σ 초과 건을 이상치로
   * 분류한다. 건수가 적은 카테고리(n < 10)는 통계가 불안정하므로 제외한다.
   */
  app.get('/v1/admin/price-stats', auth, async () => {
    type StatsRow = {
      vendor_id: string;
      vendor_name: string;
      category: string;
      amount: string;
      mean: string;
      stddev: string;
      paid_at: Date;
    };

    const { rows } = await context.pool.query<StatsRow>(
      `WITH stats AS (
         SELECT
           p.vendor_id,
           v.name  AS vendor_name,
           v.category,
           p.paid_amount AS amount,
           p.paid_at,
           AVG(p.paid_amount)    OVER (PARTITION BY v.category) AS mean,
           STDDEV(p.paid_amount) OVER (PARTITION BY v.category) AS stddev,
           COUNT(*)              OVER (PARTITION BY v.category) AS cat_count
         FROM structured.usable_payment_proofs p
         JOIN structured.vendors v ON v.id = p.vendor_id
       )
       SELECT vendor_id, vendor_name, category, amount, mean, stddev, paid_at
       FROM stats
       WHERE cat_count >= 10
         AND stddev > 0
         AND amount > mean + 3 * stddev
       ORDER BY (amount - mean) / stddev DESC
       LIMIT 200`
    );

    const anomalies = rows.map((r) => ({
      vendorId: r.vendor_id,
      vendorName: r.vendor_name,
      category: r.category,
      amount: Number(r.amount),
      mean: Number(r.mean),
      stddev: Number(r.stddev),
      detectedAt: r.paid_at.toISOString(),
    }));

    return { total: anomalies.length, anomalies };
  });

  /**
   * 신고·VOC 접수 목록. 관리자 > 신고·VOC 화면(ADM-REPORT).
   *
   * 현재는 후기 신고만 있다. 다른 신고 유형이 생기면 UNION으로 확장한다.
   */
  app.get('/v1/admin/reports', auth, async (request) => {
    const query = (request.query as { status?: string; limit?: string; cursor?: string });
    const status = query.status ?? 'pending';
    const limit = Math.min(Number(query.limit ?? 20), 100);
    const cursor = query.cursor;

    type ReportRow = {
      id: string;
      report_type: string;
      reported_at: Date;
      status: string;
      reporter_count: string;
      summary: string | null;
    };

    const params: unknown[] = [status, limit + 1];
    let cursorClause = '';
    if (cursor) {
      cursorClause = `AND rr.received_at < $3`;
      params.push(cursor);
    }

    const { rows } = await context.pool.query<ReportRow>(
      `SELECT
         rr.id,
         'review' AS report_type,
         rr.received_at AS reported_at,
         CASE WHEN rr.decided_at IS NULL THEN 'pending' ELSE 'resolved' END AS status,
         COUNT(*) OVER (PARTITION BY rr.review_id) AS reporter_count,
         rr.reason::text AS summary
       FROM structured.review_reports rr
       WHERE (CASE WHEN rr.decided_at IS NULL THEN 'pending' ELSE 'resolved' END) = $1
       ${cursorClause}
       ORDER BY rr.received_at DESC
       LIMIT $2`,
      params
    );

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: items.map((r) => ({
        id: r.id,
        reportType: r.report_type,
        reportedAt: r.reported_at.toISOString(),
        status: r.status,
        reporterCount: Number(r.reporter_count),
        summary: r.summary ?? '',
      })),
      total: items.length,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]!.reported_at.toISOString() : null,
    };
  });

  // ─── Dashboard (WP-ADM-001) ───────────────────────────────────────────────
  app.get('/v1/admin/dashboard', auth, async () => {
    const [budgetStatus, briefing] = await Promise.all([
      aiCostAdmin.status(context.pool),
      decisionsAdmin.briefing(context.pool),
    ]);
    const failed = briefing.reduce((acc, b) => acc + b.failed, 0);
    const total = briefing.reduce((acc, b) => acc + b.decisions + b.failed, 0);
    const successRate = total === 0 ? 100 : ((total - failed) / total) * 100;
    const pendingActions = budgetStatus.reduce((acc, s) => acc + s.uncostedCount, 0);
    const healthy = !budgetStatus.some((s) => s.state === 'over_budget');
    const totalCost = briefing.reduce((acc, b) => acc + (b.costUsd ?? 0), 0);
    return {
      aiStatus: { healthy, successRate, pendingActions },
      reviewQueue: { total: 0, urgent: 0, oldest: '—' },
      revenue: { mrr: '₩0', aiCost: `$${totalCost.toFixed(2)}`, contributionMargin: '₩0' },
      recentActions: briefing.slice(0, 10).map((b) => ({
        time: new Date().toISOString(),
        action: b.workflow,
        result: b.failed === 0 ? '성공' : '실패',
      })),
      killSwitches: [
        { id: 'ai-recommendations', label: 'AI 추천', active: false },
        { id: 'ai-verification', label: 'AI 검증', active: false },
        { id: 'ai-matching', label: 'AI 매칭', active: false },
      ],
    };
  });

  // ─── Kill Switches ────────────────────────────────────────────────────────
  app.get('/v1/admin/kill-switches', auth, async () => {
    /*
     * 수집 스위치 조회가 실패해도 나머지는 보여준다 — 운영 DB에 0049가 아직 없을 수
     * 있고, 그때 화면 전체가 죽으면 끌 수단까지 같이 사라진다.
     */
    let importSwitches: KillSwitch[] = [];
    try {
      const { rows } = await context.pool.query<ImportSwitchRow>(
        `SELECT source_key, enabled, reason, updated_at
           FROM structured.import_switches
          ORDER BY source_key`
      );
      importSwitches = rows.map(toImportKillSwitch);
    } catch (error) {
      app.log.warn({ err: error }, 'import_switches 조회 실패 — 수집 스위치를 표시하지 못한다');
    }

    return { switches: [...killSwitches.values(), ...importSwitches] };
  });

  app.patch<{ Params: { id: string }; Body: { enabled?: boolean } }>('/v1/admin/kill-switches/:id', auth, async (req, reply) => {
    const operatorId = currentUserId(req);

    if (req.params.id.startsWith(IMPORT_SWITCH_PREFIX)) {
      const enabled = req.body.enabled;
      if (typeof enabled !== 'boolean') {
        return reply.status(400).send({ error: 'enabled_required' });
      }

      // 누가 언제 바꿨는지 남길 자리는 이 테이블의 reason·updated_at뿐이다.
      const { rowCount } = await context.pool.query(
        `UPDATE structured.import_switches
            SET enabled = $1, reason = $2, updated_at = now()
          WHERE source_key = $3`,
        [
          enabled,
          `${enabled ? '재개' : '중단'} — 관리자 ${operatorId ?? 'operator'}`,
          req.params.id.slice(IMPORT_SWITCH_PREFIX.length),
        ]
      );
      if (!rowCount) return reply.status(404).send({ error: 'not_found' });
      return reply.status(204).send();
    }

    const sw = killSwitches.get(req.params.id);
    if (!sw) return reply.status(404).send({ error: 'not_found' });
    sw.enabled = req.body.enabled ?? sw.enabled;
    sw.lastChangedAt = new Date().toISOString();
    sw.lastChangedBy = operatorId ?? 'operator';
    return reply.status(204).send();
  });

  // ─── FAQ ──────────────────────────────────────────────────────────────────
  app.get('/v1/admin/faq', auth, async () => {
    return { items: [] as { id: string; question: string; answer: string; visible: boolean }[] };
  });
  app.post('/v1/admin/faq', auth, async () => {
    return { id: randomUUID() };
  });
  app.patch<{ Params: { id: string } }>('/v1/admin/faq/:id', auth, async (_req, reply) => {
    return reply.status(204).send();
  });
  app.put<{ Params: { id: string } }>('/v1/admin/faq/:id', auth, async (_req, reply) => {
    return reply.status(204).send();
  });
  app.delete<{ Params: { id: string } }>('/v1/admin/faq/:id', auth, async (_req, reply) => {
    return reply.status(204).send();
  });

  // ─── Users ────────────────────────────────────────────────────────────────
  /*
   * 계정 목록. **탈퇴를 접수한 계정도 보인다** — 이 화면의 첫 번째 쓰임이
   * «탈퇴했는데 회원정보가 남았는가»를 확인하는 것이라, 탈퇴 계정을 숨기면 그
   * 질문에 답할 수 없다(2026-09-08 · 0080 트리거 버그가 그렇게 묻혔다).
   * 삭제가 끝난 계정은 행 자체가 없어 여기 없다 — 그것이 정상이다.
   *
   * 이메일·닉네임은 identity.identities에서 온다(structured.users에는 식별자만).
   * 상태는 withdrawal-admin과 같은 기준으로 센다 — 두 화면이 다른 말을 하지
   * 않게.
   */
  app.get('/v1/admin/users', auth, async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const search = (q['search'] ?? '').trim();
    const filter = q['status'];
    const cursor = q['cursor'];
    const limit = 25;

    const clauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filter === 'withdrawn') clauses.push('u.deleted_at IS NOT NULL');
    else if (filter === 'active') clauses.push('u.deleted_at IS NULL');

    if (search) {
      clauses.push(
        `(u.display_name ILIKE $${idx} OR u.id::text = $${idx + 1}
          OR EXISTS (
            SELECT 1 FROM identity.identities i
            WHERE i.user_id = u.id AND (i.email ILIKE $${idx} OR i.nickname ILIKE $${idx})
          ))`
      );
      params.push(`%${search}%`, search);
      idx += 2;
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows: countRows } = await context.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM structured.users u ${where}`,
      params
    );
    const total = Number(countRows[0]?.count ?? 0);

    const pageClauses = [...clauses];
    const pageParams = [...params];
    if (cursor) {
      pageClauses.push(`u.created_at < $${idx}`);
      pageParams.push(cursor);
      idx++;
    }
    pageParams.push(limit + 1);

    const { rows } = await context.pool.query<{
      id: string;
      display_name: string | null;
      activated_at: Date | null;
      created_at: Date;
      deleted_at: Date | null;
      is_operator: boolean;
      pick_verified: boolean;
      provider: string | null;
      email: string | null;
      nickname: string | null;
      last_login_at: Date | null;
      withdrawal_status: string | null;
      failure_message: string | null;
      failure_attempts: number | null;
    }>(
      `SELECT
         u.id, u.display_name, u.activated_at, u.created_at, u.deleted_at, u.is_operator,
         EXISTS (
           SELECT 1 FROM structured.usable_payment_proofs p WHERE p.reporter_user_id = u.id
         ) AS pick_verified,
         i.provider::text AS provider, i.email, i.nickname, i.last_login_at,
         CASE
           WHEN u.deleted_at IS NULL THEN NULL
           WHEN EXISTS (
             SELECT 1 FROM structured.withdrawal_holds h
             WHERE h.user_id = u.id AND h.resolved_at IS NULL AND h.hold_until > now()
           ) THEN 'hold'
           WHEN f.user_id IS NOT NULL THEN 'failed'
           WHEN EXISTS (
             SELECT 1 FROM originals.raw_documents d
             WHERE d.owner_user_id = u.id AND d.status <> 'deleted'
           ) THEN 'pending'
           ELSE 'deletion_pending'
         END AS withdrawal_status,
         f.error_message AS failure_message,
         f.attempt_count AS failure_attempts
       FROM structured.users u
       LEFT JOIN LATERAL (
         SELECT provider, email, nickname, last_login_at
         FROM identity.identities
         WHERE user_id = u.id
         ORDER BY last_login_at DESC
         LIMIT 1
       ) i ON true
       LEFT JOIN structured.withdrawal_deletion_failures f ON f.user_id = u.id
       ${pageClauses.length > 0 ? `WHERE ${pageClauses.join(' AND ')}` : ''}
       ORDER BY u.created_at DESC
       LIMIT $${idx}`,
      pageParams
    );
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      users: items.map((r) => ({
        id: r.id,
        displayName: r.display_name ?? '',
        provider: r.provider,
        email: r.email,
        nickname: r.nickname,
        createdAt: r.created_at.toISOString(),
        activatedAt: r.activated_at?.toISOString() ?? null,
        lastLoginAt: r.last_login_at?.toISOString() ?? null,
        deletedAt: r.deleted_at?.toISOString() ?? null,
        isOperator: r.is_operator,
        pickVerified: r.pick_verified,
        withdrawal: r.withdrawal_status
          ? {
              status: r.withdrawal_status,
              failure: r.failure_message
                ? { message: r.failure_message, attemptCount: r.failure_attempts ?? 1 }
                : null,
            }
          : null,
      })),
      total,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]!.created_at.toISOString() : null,
    };
  });

  // ─── Vendors ──────────────────────────────────────────────────────────────
  app.get('/v1/admin/vendors', auth, async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const cursor = q['cursor'];
    const category = q['category'];
    const limit = 25;
    const params: unknown[] = [];
    let idx = 1;
    const clauses: string[] = [];
    if (category) {
      clauses.push(`v.category = $${idx}`);
      params.push(category);
      idx++;
    }
    if (cursor) {
      clauses.push(`v.created_at < $${idx}`);
      params.push(cursor);
      idx++;
    }
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    params.push(limit + 1);
    const { rows } = await context.pool.query<{
      id: string;
      category: string;
      name: string;
      region: string | null;
      source: string;
      last_verified_at: Date | null;
      created_at: Date;
      proof_count: string;
    }>(
      `SELECT v.id, v.category, v.name, v.region, v.source,
              v.last_verified_at, v.created_at,
              COUNT(p.id)::text AS proof_count
       FROM structured.vendors v
       LEFT JOIN structured.usable_payment_proofs p ON p.vendor_id = v.id
       ${where}
       GROUP BY v.id
       ORDER BY v.created_at DESC
       LIMIT $${idx}`,
      params
    );
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: items.map((r) => ({
        id: r.id,
        category: r.category,
        name: r.name,
        region: r.region ?? '',
        source: r.source,
        lastVerifiedAt: r.last_verified_at?.toISOString() ?? null,
        createdAt: r.created_at.toISOString(),
        proofCount: Number(r.proof_count),
      })),
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]!.created_at.toISOString() : null,
    };
  });

  // ─── Revenue ──────────────────────────────────────────────────────────────
  app.get('/v1/admin/revenue', auth, async () => {
    return {
      mrr: 0,
      arr: 0,
      activeSubscriptions: 0,
      churnRate: 0,
      planBreakdown: [] as { plan: string; count: number; revenue: number }[],
    };
  });

  // ─── Ads ──────────────────────────────────────────────────────────────────
  app.get('/v1/admin/ads', auth, async () => {
    return { items: [] as unknown[], total: 0 };
  });
  app.post('/v1/admin/ads', auth, async () => {
    return { id: randomUUID() };
  });
  app.patch<{ Params: { id: string } }>('/v1/admin/ads/:id', auth, async (_req, reply) => {
    return reply.status(204).send();
  });
  app.delete<{ Params: { id: string } }>('/v1/admin/ads/:id', auth, async (_req, reply) => {
    return reply.status(204).send();
  });

  // ─── Ads Gate ─────────────────────────────────────────────────────────────
  app.get('/v1/admin/ads-gate', auth, async () => {
    return { enabled: false, rules: [] as unknown[] };
  });
  app.patch('/v1/admin/ads-gate', auth, async (_req, reply) => {
    return reply.status(204).send();
  });

  // ─── AI Usage ─────────────────────────────────────────────────────────────
  app.get('/v1/admin/ai-usage', auth, async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const months = Number(q['months'] ?? '3');
    const [usage, budgetStatus] = await Promise.all([
      aiCostAdmin.usage(context.pool, months),
      aiCostAdmin.status(context.pool),
    ]);
    return { usage, budgetStatus };
  });

  // ─── Automation ───────────────────────────────────────────────────────────
  app.get('/v1/admin/automation', auth, async () => {
    return { rules: [] as unknown[], enabled: true };
  });
  app.patch('/v1/admin/automation', auth, async (_req, reply) => {
    return reply.status(204).send();
  });

  // ─── Biz Queue ────────────────────────────────────────────────────────────
  app.get('/v1/admin/biz-queue', auth, async () => {
    return { items: [] as unknown[], total: 0 };
  });

  // ─── Briefing ─────────────────────────────────────────────────────────────
  app.get('/v1/admin/briefing', auth, async () => {
    const [briefing, budgetStatus] = await Promise.all([
      decisionsAdmin.briefing(context.pool),
      aiCostAdmin.status(context.pool),
    ]);
    return { briefing, budgetStatus };
  });

  // ─── Campaigns ────────────────────────────────────────────────────────────
  app.get('/v1/admin/campaigns', auth, async () => {
    return { items: [] as unknown[], total: 0 };
  });
  app.post('/v1/admin/campaigns', auth, async () => {
    return { id: randomUUID() };
  });

  // ─── Data / Pipeline ──────────────────────────────────────────────────────
  app.get('/v1/admin/data/pipeline', auth, async () => {
    return { stages: [] as unknown[], lastRunAt: null as string | null };
  });

  // ─── Data / Email Matching ────────────────────────────────────────────────
  app.get('/v1/admin/data/email-matching', auth, async () => {
    return { items: [] as unknown[], total: 0 };
  });

  // ─── Data / Images ────────────────────────────────────────────────────────
  app.get('/v1/admin/data/images', auth, async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const status = q['status'] ?? 'pending';
    const cursor = q['cursor'];
    const limit = 20;
    const params: unknown[] = [status];
    let idx = 2;
    let cursorClause = '';
    if (cursor) {
      cursorClause = ` AND vi.created_at < $${idx}`;
      params.push(cursor);
      idx++;
    }
    params.push(limit + 1);
    const { rows } = await context.pool.query<{
      id: string;
      vendor_id: string;
      vendor_name: string;
      storage_key: string;
      source_url: string | null;
      copyright_basis: string;
      match_confidence: string | null;
      status: string;
      created_at: Date;
    }>(
      `SELECT vi.id, vi.vendor_id, v.name AS vendor_name,
              vi.storage_key, vi.source_url,
              vi.copyright_basis, vi.match_confidence::text,
              vi.status, vi.created_at
       FROM structured.vendor_images vi
       JOIN structured.vendors v ON v.id = vi.vendor_id
       WHERE vi.status = $1${cursorClause}
       ORDER BY vi.created_at DESC
       LIMIT $${idx}`,
      params
    );
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: items.map((r) => ({
        id: r.id,
        vendorId: r.vendor_id,
        vendorName: r.vendor_name,
        storageKey: r.storage_key,
        sourceUrl: r.source_url ?? null,
        copyrightBasis: mapCopyrightBasis(r.copyright_basis),
        matchConfidence: r.match_confidence !== null ? Number(r.match_confidence) : null,
        status: r.status,
        createdAt: r.created_at.toISOString(),
      })),
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]!.created_at.toISOString() : null,
    };
  });

  app.patch<{ Params: { id: string } }>(
    '/v1/admin/data/images/:id/approve',
    auth,
    async (request, reply) => {
      await context.pool.query(
        `UPDATE structured.vendor_images SET status = 'approved' WHERE id = $1`,
        [request.params.id]
      );
      return reply.status(204).send();
    }
  );

  app.patch<{ Params: { id: string } }>(
    '/v1/admin/data/images/:id/reject',
    auth,
    async (request, reply) => {
      await context.pool.query(
        `UPDATE structured.vendor_images SET status = 'quality_rejected' WHERE id = $1`,
        [request.params.id]
      );
      return reply.status(204).send();
    }
  );

  // ─── Marketing ────────────────────────────────────────────────────────────
  app.get('/v1/admin/marketing', auth, async () => {
    try {
      const [items, summary] = await Promise.all([
        marketingStore.listJobs(context.pool, 50),
        marketingStore.getSummary(context.pool),
      ]);
      return { summary, items };
    } catch {
      // DB 없을 때 빈 응답 (개발 환경)
      return {
        summary: { generated: 0, simulated: 0, failed: 0, failRate: 0 },
        items: [],
      };
    }
  });

  app.post('/v1/admin/marketing/sources', auth, async (request) => {
    const body = request.body as {
      id: string; factIds: string[]; reviewed?: boolean;
      expiresAt?: string; nextVerifyAt?: string; note?: string;
    };
    await marketingStore.registerSource(context.pool, {
      id: body.id,
      factIds: body.factIds,
      reviewed: body.reviewed ?? false,
      reviewedAt: body.reviewed ? new Date().toISOString() : null,
      expiresAt: body.expiresAt ?? null,
      nextVerifyAt: body.nextVerifyAt ?? null,
      active: true,
      note: body.note,
    });
    return { ok: true };
  });

  app.delete<{ Params: { sourceId: string } }>(
    '/v1/admin/marketing/sources/:sourceId',
    auth,
    async (request) => {
      const { sourceId } = request.params;
      await marketingStore.deactivateSource(context.pool, sourceId);
      return { ok: true };
    },
  );

  app.post('/v1/admin/marketing/generate', auth, async (request, reply) => {
    const body = request.body as {
      sourceId: string; channel: string; format: string; scheduledAt?: string;
    };
    const source = await marketingStore.getSource(context.pool, body.sourceId);
    if (!source) return reply.status(404).send({ error: '소재를 찾을 수 없습니다.' });

    const jobKey = `job_${Date.now()}`;
    const result = marketingContent.generateContent(
      source,
      body.channel as MarketingChannel,
      body.format as MarketingFormat,
      jobKey,
    );
    if (!result.ok) return reply.status(400).send({ error: result.error });

    const job = await marketingStore.createJob(context.pool, {
      sourceId: body.sourceId,
      channel: body.channel as MarketingChannel,
      format: body.format as MarketingFormat,
      title: result.title,
      body: result.body,
      utmUrl: result.utmUrl,
      scheduledAt: body.scheduledAt,
    });
    return { job };
  });

  app.post<{ Params: { jobId: string } }>(
    '/v1/admin/marketing/:jobId/simulate',
    auth,
    async (_request) => {
      const r = await marketingStore.processScheduled(context.pool);
      return { ok: true, result: r };
    },
  );

  app.post<{ Params: { jobId: string } }>(
    '/v1/admin/marketing/:jobId/retry',
    auth,
    async (request) => {
      const { jobId } = request.params;
      await marketingStore.retryJob(context.pool, jobId);
      return { ok: true };
    },
  );

  app.get<{ Params: { jobId: string } }>(
    '/v1/admin/marketing/:jobId/events',
    auth,
    async (request) => {
      const { jobId } = request.params;
      const jobEvents = await marketingStore.listJobEvents(context.pool, jobId);
      return { events: jobEvents };
    },
  );

  app.get('/v1/admin/marketing/plan-prompt', auth, async (request, reply) => {
    const { sourceId, channel, format } = request.query as {
      sourceId?: string; channel?: string; format?: string;
    };
    if (!sourceId || !channel || !format) {
      return reply.status(400).send({ error: 'sourceId, channel, format 필수' });
    }
    const source = await marketingStore.getSource(context.pool, sourceId);
    if (!source) return reply.status(404).send({ error: '소재 없음' });
    const result = marketingContent.generateContent(
      source,
      channel as MarketingChannel,
      format as MarketingFormat,
      'prompt_preview',
    );
    if (!result.ok) return reply.status(400).send({ error: result.error });
    return { prompt: result.planningPrompt };
  });

  // ─── Policy Engine ────────────────────────────────────────────────────────
  app.get('/v1/admin/policy-engine', auth, async () => {
    return { policies: [] as unknown[], version: 0 };
  });
  app.patch('/v1/admin/policy-engine', auth, async (_req, reply) => {
    return reply.status(204).send();
  });

  // ─── Rollback ─────────────────────────────────────────────────────────────
  app.get('/v1/admin/rollback', auth, async () => {
    return { snapshots: [] as unknown[] };
  });

  // ─── Terms ────────────────────────────────────────────────────────────────
  app.get('/v1/admin/terms', auth, async () => {
    return { items: [] as unknown[] };
  });
  app.post('/v1/admin/terms', auth, async () => {
    return { id: randomUUID() };
  });

  // ─── Audit Log ────────────────────────────────────────────────────────────
  app.get('/v1/admin/audit-log', auth, async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const cursor = q['cursor'];
    const workflow = q['workflow'];
    const limit = 50;
    const params: unknown[] = [];
    let idx = 1;
    const clauses: string[] = [];
    if (workflow) {
      clauses.push(`workflow = $${idx}`);
      params.push(workflow);
      idx++;
    }
    if (cursor) {
      clauses.push(`created_at < $${idx}`);
      params.push(cursor);
      idx++;
    }
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    params.push(limit + 1);
    const { rows } = await context.pool.query<{
      id: string;
      workflow: string;
      step: string | null;
      subject_kind: string;
      subject_id: string;
      decider: string;
      decision: string;
      reason_code: string | null;
      execution_status: string;
      cost_usd: string | null;
      created_at: Date;
    }>(
      `SELECT id, workflow, step, subject_kind, subject_id,
              decider, decision, reason_code, execution_status,
              cost_usd::text, created_at
       FROM structured.decisions
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx}`,
      params
    );
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: items.map((r) => ({
        id: r.id,
        workflow: r.workflow,
        step: r.step ?? null,
        subjectKind: r.subject_kind,
        subjectId: r.subject_id,
        decider: r.decider,
        decision: r.decision,
        reasonCode: r.reason_code ?? null,
        executionStatus: r.execution_status,
        costUsd: r.cost_usd !== null ? Number(r.cost_usd) : null,
        createdAt: r.created_at.toISOString(),
      })),
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]!.created_at.toISOString() : null,
    };
  });

  // ─── Data / Price Stats (WP-ADM-PRICE) ────────────────────────────────────
  app.get('/v1/admin/data/price-stats', auth, async () => {
    type StatRow = {
      vendor_id: string;
      vendor_name: string;
      data_count: string;
      anomaly_count: string;
    };
    const { rows } = await context.pool.query<StatRow>(
      `SELECT
         p.vendor_id,
         v.name AS vendor_name,
         COUNT(*) AS data_count,
         SUM(CASE WHEN p.paid_amount > stats.mean + 3 * stats.stddev THEN 1 ELSE 0 END) AS anomaly_count
       FROM structured.usable_payment_proofs p
       JOIN structured.vendors v ON v.id = p.vendor_id
       JOIN LATERAL (
         SELECT AVG(paid_amount) AS mean, STDDEV(paid_amount) AS stddev
         FROM structured.usable_payment_proofs
         WHERE vendor_id = p.vendor_id
       ) stats ON true
       GROUP BY p.vendor_id, v.name
       ORDER BY data_count DESC
       LIMIT 200`
    );

    const vendors = rows.map((r) => {
      const count = Number(r.data_count);
      const stage: 0 | 1 | 2 | 3 = count >= 10 ? 3 : count >= 5 ? 2 : count >= 3 ? 1 : 0;
      return {
        vendorId: r.vendor_id,
        vendorName: r.vendor_name,
        dataCount: count,
        publicStage: stage,
        anomalyCandidates: Number(r.anomaly_count),
        statsVersion: '1',
        lastRecalcAt: new Date().toISOString(),
      };
    });

    const summary = {
      totalVendors: vendors.length,
      stage0: vendors.filter((v) => v.publicStage === 0).length,
      stage1: vendors.filter((v) => v.publicStage === 1).length,
      stage2: vendors.filter((v) => v.publicStage === 2).length,
      stage3plus: vendors.filter((v) => v.publicStage === 3).length,
    };

    return { summary, vendors };
  });

  app.post<{ Params: { vendorId: string } }>('/v1/admin/data/price-stats/:vendorId/recalc', auth, async (_req, reply) => {
    return reply.status(202).send({ queued: true });
  });
}
