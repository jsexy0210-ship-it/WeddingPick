/**
 * 화면 캡처용 가짜 응답(`scripts/fixtures/api.cjs`)이 계약을 만족하는가.
 *
 * **왜 시험으로 두는가.** 앱은 계약에 어긋난 응답과 서버 장애를 구별하지 않는다 —
 * `apps/mobile/src/api/client.ts`가 zod 실패를 「서버 응답을 이해하지 못했습니다」
 * 하나로 묶어 던지고, 화면에는 「연결이 불안정해요」만 뜬다. 칸 하나가 빠진 것을
 * 찍는 사람은 네트워크 문제로 읽고, 화면은 영영 안 찍힌다.
 *
 * 계약이 바뀌면 여기가 먼저 빨개진다. 그때 `scripts/fixtures/api.cjs`를 고친다.
 */
import { z, type ZodType } from 'zod';

import { appBootstrapResponseSchema } from './app';
import { authProvidersResponseSchema } from './auth';
import { candidateListResponseSchema, decisionListResponseSchema } from './candidates';
import { expoListResponseSchema } from './expos';
import { faqListResponseSchema } from './faq';
import { consultationListResponseSchema } from './consultations';
import { inquiryListResponseSchema } from './inquiries';
import { myReportListResponseSchema } from './my-reports';
import { publicHolidayListResponseSchema, weddingForecastResponseSchema } from './public-calendar';
import { categoryRecommendationsResponseSchema } from './recommendations';
import { myMonthlyDrawResponseSchema, myRewardPayoutResponseSchema, myRewardsResponseSchema } from './rewards';
import { loungeReviewListResponseSchema, reportReasonListResponseSchema, reviewCommentListResponseSchema, reviewListResponseSchema } from './reviews';
import { settingsSchema } from './settings';
import { signupStateSchema } from './signup';
import {
  adminWeddingFeedResponseSchema,
  adminWeddingFeedTaxonomySchema,
  weddingFeedDetailSchema,
  weddingFeedListResponseSchema,
} from './wedding-feed';
import { weddingEventListResponseSchema } from './wedding-events';
import { expenseSummaryResponseSchema, weddingTaskListResponseSchema } from './wedding-plan';
import {
  vendorComparisonResponseSchema,
  conditionStatsSchema,
  vendorDetailSchema,
  vendorPhotosResponseSchema,
  vendorRegionsResponseSchema,
  vendorSearchResponseSchema,
} from './vendors';
import { currentUserSchema, weddingInviteListResponseSchema } from './weddings';
import { ENDPOINTS } from './endpoints';
import { withdrawalNoticeSchema } from './withdrawal';

/*
 * fixture는 캡처 도구(ESM)와 이 시험(ts-jest·CJS)이 같이 읽어야 해서 `.cjs`다.
 * 이 패키지의 tsconfig에는 node 타입이 없으므로 쓰는 만큼만 여기서 알려 준다 —
 * 패키지 전체의 타입 범위를 캡처 도구 사정으로 넓히지 않는다.
 */
declare const require: (id: string) => { routes: Record<string, unknown> };

const { routes } = require('../../../scripts/fixtures/api.cjs');

/** 경로 → 그 경로가 지켜야 할 계약. 새 fixture를 더하면 여기에도 한 줄 더한다. */
const CONTRACTS = new Map<string, ZodType>([
  ['GET /v1/me/signup', signupStateSchema],
  ['GET /v1/me', currentUserSchema],
  ['GET /v1/app/bootstrap', appBootstrapResponseSchema],
  ['GET /v1/me/recommendations', categoryRecommendationsResponseSchema],
  ['GET /v1/auth/providers', authProvidersResponseSchema],
  ['GET /v1/weddings/:weddingId/candidates', candidateListResponseSchema],
  ['GET /v1/weddings/:weddingId/decisions', decisionListResponseSchema],
  ['POST /v1/weddings/:weddingId/candidates', ENDPOINTS.addCandidate.response],
  ['DELETE /v1/weddings/:weddingId/candidates/:candidateId', ENDPOINTS.removeCandidate.response],
  ['GET /v1/me/monthly-draw', myMonthlyDrawResponseSchema],
  ['POST /v1/weddings/:weddingId/comparisons', z.null()],
  ['GET /v1/review-report-reasons', reportReasonListResponseSchema],
  ['GET /v1/reviews', loungeReviewListResponseSchema],
  ['GET /v1/reviews/:reviewId/comments', reviewCommentListResponseSchema],
  ['GET /v1/expos', expoListResponseSchema],
  ['GET /v1/me/reports', myReportListResponseSchema],
  ['GET /v1/inquiries', inquiryListResponseSchema],
  ['GET /v1/me/rewards', myRewardsResponseSchema],
  ['GET /v1/me/rewards/payout', myRewardPayoutResponseSchema],
  ['GET /v1/me/settings', settingsSchema],
  ['GET /v1/me/withdrawal', withdrawalNoticeSchema],
  ['GET /v1/weddings/:weddingId/invites', weddingInviteListResponseSchema],
  ['GET /v1/weddings/:weddingId/consultations', consultationListResponseSchema],
  ['GET /v1/weddings/:weddingId/events', weddingEventListResponseSchema],
  ['GET /v1/weddings/:weddingId/forecast', weddingForecastResponseSchema],
  ['GET /v1/public-holidays', publicHolidayListResponseSchema],
  ['GET /v1/weddings/:weddingId/expenses', expenseSummaryResponseSchema],
  ['GET /v1/weddings/:weddingId/tasks', weddingTaskListResponseSchema],
  ['GET /v1/vendors/regions', vendorRegionsResponseSchema],
  ['GET /v1/vendors', vendorSearchResponseSchema],
  ['GET /v1/vendors/compare', vendorComparisonResponseSchema],
  ['GET /v1/vendors/:vendorId', vendorDetailSchema],
  ['GET /v1/vendors/:vendorId/images', vendorPhotosResponseSchema],
  ['GET /v1/vendors/:vendorId/conditions', conditionStatsSchema],
  ['GET /v1/vendors/:vendorId/reviews', reviewListResponseSchema],
  ['GET /v1/faq', faqListResponseSchema],
  ['GET /v1/wedding-feed', weddingFeedListResponseSchema],
  ['GET /v1/wedding-feed/:id', weddingFeedDetailSchema],
  ['GET /v1/admin/wedding-feed', adminWeddingFeedResponseSchema],
  ['GET /v1/admin/wedding-feed/taxonomy', adminWeddingFeedTaxonomySchema],
]);

/**
 * 계약이 없는 경로. 관리자 콘솔 응답은 `packages/api-contract`가 아니라
 * `apps/api`의 타입이 정하므로 여기서 검사할 스키마가 없다 — 그래도 **적어는
 * 둔다.** 빠뜨린 것과 일부러 뺀 것을 구별하려고.
 *
 * `candidates/removed`는 응답 스키마가 `apps/mobile/src/api/client.ts`에
 * 인라인으로만 있고 `api-contract`가 내보내지 않는다 — 이 패키지가 앱 쪽
 * 타입을 끌어오면 반대 방향 의존이 생긴다.
 */
const NO_CONTRACT = new Set([
  'GET /v1/admin/ads-gate',
  'GET /v1/admin/ad-tiers',
  'GET /v1/admin/accounts',
  'GET /v1/admin/dashboard',
  'GET /v1/admin/members-trend',
  'GET /v1/admin/briefing',
  /* 박람회 관리(0410) — 관리자 전용이라 사용자 계약이 없다. 위 admin 넷과 같은 자리다. */
  'GET /v1/admin/expos',
  'POST /v1/admin/expos/collect',
  'GET /v1/admin/expos/deletion-preview',
  /*
   * 관리자 화면 전수 조사(2026-09-16)에서 더한 일곱. 위 admin 항목과 같은 자리다 —
   * 응답 모양을 정하는 것은 `apps/api`의 타입이라 여기서 검사할 스키마가 없다.
   * 그전까지 이 일곱은 fixture가 없어서 화면 본문이 「API … → 404」로만 찍혔다.
   */
  'GET /v1/admin/faq',
  'GET /v1/admin/marketing',
  'GET /v1/admin/data/images',
  'GET /v1/admin/vendors',
  'GET /v1/admin/data/pipeline',
  'GET /v1/admin/pii-reviews',
  'GET /v1/admin/policy-engine',
  /* 문의(2026-09-23 새 화면) — 관리자 전용이라 사용자 계약이 없다. 위 admin과 같은 자리다. */
  'GET /v1/admin/inquiries',
  'GET /v1/admin/inquiries/:id',
  /* 회원 상세 360뷰(2026-09-23 새 화면) — 관리자 전용, 같은 자리다. */
  'GET /v1/admin/users/:id',
  'GET /v1/weddings/:weddingId/candidates/removed',
]);

/**
 * 함수 fixture는 한 번 불러 본다 — 조건 없이 부른 결과가 기본 응답이다.
 *
 * 질의 문자열은 비워서 넘긴다. 찾는 칸이 없을 때 무엇을 돌려주는지가 여기서 볼 값이다.
 */
function bodyOf(key: string): unknown {
  const entry = routes[key];

  if (typeof entry !== 'function') return entry;

  const call = entry as (input: { url: { searchParams: { get: () => null } } }) => unknown;

  return call({ url: { searchParams: { get: () => null } } });
}

describe('캡처용 가짜 응답', () => {
  it('광고 자리를 비워 두지 않는다', () => {
    /*
     * 비워 두면 광고 칸이 없는 화면만 찍히고, 「코드에 자리가 있다」와 「실제로
     * 그려진다」가 구별되지 않는다 — 2026-09-11에 그 차이로 하루를 썼다.
     */
    const search = bodyOf('GET /v1/vendors') as { sponsored: unknown[] };

    expect(search.sponsored.length).toBeGreaterThan(0);
  });


  it.each([...CONTRACTS.keys()])('%s 가 계약을 만족한다', (key) => {
    const schema = CONTRACTS.get(key);

    if (!schema) throw new Error(`계약이 없다: ${key}`);

    const parsed = schema.safeParse(bodyOf(key));

    expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
  });

  it('계약을 적어두지 않은 fixture를 남기지 않는다', () => {
    expect(
      Object.keys(routes).filter((key) => !CONTRACTS.has(key) && !NO_CONTRACT.has(key))
    ).toEqual([]);
  });
});
