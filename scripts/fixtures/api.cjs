/**
 * 화면 캡처용 가짜 서버 응답.
 *
 * **운영 API로는 나가지 않는다.** `scripts/screenshot-screens.mjs`가 브라우저 안에서
 * `/v1/**` 요청을 전부 가로채 여기 적힌 것으로 답한다 — 컨테이너가 운영 서버에 닿지
 * 못하기도 하고, 닿더라도 운영 자료를 찍으면 안 된다.
 *
 * 화면이 늘어나면 **이 파일만 고친다.** 여기 없는 경로를 부르면 캡처가
 * 「fixture 없음」과 그 경로를 적어 주므로 무엇을 더 써야 하는지는 돌려보면 안다.
 *
 * **CommonJS인 이유.** 캡처 도구(ESM)와 계약 시험(`scripts/fixtures/api.test.ts`,
 * ts-jest·CJS) 양쪽이 같은 파일을 읽어야 한다. `.cjs`는 둘 다 읽는다.
 *
 * **값은 계약을 만족해야 한다.** 한 칸만 어긋나도 앱은 그것을 서버 장애와 구별하지
 * 않는다 — `client.ts`가 zod 실패를 「서버 응답을 이해하지 못했습니다」 하나로 묶어
 * 던지고, 화면에는 「연결이 불안정해요」만 뜬다. 무엇이 틀렸는지는 화면으로 알 수
 * 없으므로 `api.test.ts`가 대신 잡는다. **고쳤으면 그 시험을 돌린다.**
 */

/** 실제 상호와 실제 금액을 쓰지 않는다 — 가명이다(CLAUDE.md 「예시 데이터」의 웹 기준). */
const vendor = (id, name, category, region, opts = {}) => ({
  id,
  name,
  category,
  region,
  coordinates: null,
  sourceNote: null,
  imageUrl: null,
  comparableQuoteCount: opts.reports ?? 0,
  paidPrice: opts.paidPrice ?? { stage: 'collecting', count: 0, caption: '수집 중' },
  styleTags: opts.styleTags ?? [],
  guidePrice: opts.guideFrom ? { fromKrw: opts.guideFrom, sourceLabel: '업체 안내' } : null,
});

/** 실 제보가 충분한 업체. 금액 한 줄이 구간으로 뜬다. */
const disclosed = (count, low, high, median) => ({
  stage: median === undefined ? 'normal' : 'detailed',
  count,
  caption: `실 제보 ${count}건 · 최근 12개월`,
  low,
  high,
  ...(median === undefined ? {} : { median }),
});

const VENDORS = [
  vendor('11111111-1111-4111-8111-111111111111', '강남 A 웨딩홀', 'hall', '서울', {
    reports: 12,
    paidPrice: disclosed(12, 1_520_000, 1_840_000, 1_680_000),
    styleTags: ['URBAN'],
  }),
  vendor('22222222-2222-4222-8222-222222222222', '강남 B 웨딩홀', 'hall', '서울', {
    reports: 5,
    paidPrice: disclosed(5, 1_900_000, 2_400_000),
    styleTags: ['GLAMOROUS'],
  }),
  vendor('33333333-3333-4333-8333-333333333333', '분당 C 웨딩홀', 'hall', '경기', {
    reports: 1,
    paidPrice: { stage: 'collecting', count: 1, caption: '수집 중' },
    guideFrom: 1_500_000,
    styleTags: ['NATURAL'],
  }),
  vendor('44444444-4444-4444-8444-444444444444', '송파 D 웨딩홀', 'hall', '서울', {
    styleTags: ['ROMANTIC'],
  }),
  vendor('55555555-5555-4555-8555-555555555555', '강남 E 스튜디오', 'studio', '서울', {
    reports: 8,
    paidPrice: disclosed(8, 980_000, 1_240_000, 1_100_000),
    styleTags: ['NATURAL'],
  }),
];

/**
 * 광고 자리. **자연 결과와 섞지 않는다**(계약 E-1) — 화면이 목록 위에 따로 그린다.
 *
 * 비워 두지 않는 이유는 **광고가 그려지는지 눈으로 볼 수 없기 때문**이다. 빈 배열로
 * 찍으면 광고 칸이 없는 화면만 나오고, 「코드에 자리가 있다」와 「실제로 그려진다」가
 * 구별되지 않는다 — 2026-09-11에 그 차이로 하루를 썼다.
 *
 * `label`은 계약이 `SPONSORED_LABEL`(«광고») 하나로 못 박았다. 애매한 말을 쓰지 않는다.
 */
const SPONSORED = [
  {
    vendorId: '66666666-6666-4666-8666-666666666666',
    name: '강남 F 웨딩홀',
    category: 'hall',
    region: '서울',
    imageUrl: null,
    label: '광고',
  },
];

const ME = {
  userId: '99999999-9999-4999-8999-999999999999',
  weddingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  displayName: null,
  weddingDate: '2027-04-17',
  region: '서울',
  preparedCategories: [],
  budgetBracket: null,
  budgetAmount: null,
  setupComplete: true,
  styleTags: ['URBAN'],
  spouseLinked: false,
  partnerDisplayName: null,
  hasPaymentProof: false,
  hasPick: false,
  hasCompared: false,
  tier: 'guest',
  tierLabel: '게스트',
};

/**
 * 경로 → 응답. 키는 `METHOD /경로`이고 질의 문자열은 떼고 맞춘다.
 *
 * 경로에 `:이름`을 쓰면 그 한 칸은 무엇이든 맞는다 —
 * `GET /v1/weddings/:weddingId/candidates`처럼.
 *
 * 값이 함수면 `({ url, method, params })`를 받아 본문을 돌려준다.
 */
const routes = {
  'GET /v1/me/signup': {
    activated: true,
    ageVerified: true,
    minimumAge: 14,
    items: [],
    missingRequired: [],
  },
  'GET /v1/me': ME,
  'GET /v1/app/bootstrap': {
    member: ME,
    notifications: null,
    popularVendors: VENDORS.slice(0, 2),
    candidates: null,
    recommendations: [],
  },
  'GET /v1/vendors/regions': {
    regions: [
      { name: '서울', vendorCount: 128 },
      { name: '경기', vendorCount: 84 },
      { name: '인천', vendorCount: 21 },
    ],
  },
  'GET /v1/auth/providers': {
    providers: [{ provider: 'kakao', isDevelopmentStandIn: false }],
  },
  'GET /v1/weddings/:weddingId/candidates': {
    groups: [],
    total: 0,
    limit: 5,
    progress: { decided: 0, total: 13, label: '0/13 완료' },
    nextCategory: 'hall',
  },
  /*
   * 관리자 — 광고 실운영 관문과 상품별 상태(WP-ADM-034).
   *
   * 「승인은 끝났고 아직 안 켠」 상태로 둔다. 그 자리가 단추 셋을 한꺼번에
   * 보여준다 — 켜기 · 상품별 실운영 · 되돌리기.
   */
  'GET /v1/admin/ads-gate': {
    currentPhase: 5,
    steps: [
      {
        id: 'test_open',
        label: '테스트 전체 오픈',
        description: '모든 상품 등급을 테스트로 열어 자리를 판매합니다',
        status: 'done',
        completedAt: null,
        detail: '광고 자리 3건',
        requiresAction: false,
      },
      {
        id: 'decision',
        label: '최종 결정',
        description: '사람이 실운영 전환을 확정합니다',
        status: 'done',
        completedAt: '2026-09-11T00:00:00.000Z',
        detail: '승인됨',
        requiresAction: false,
      },
      {
        id: 'production',
        label: '실운영 오픈',
        description: '승인과 별개로 한 번 더 켜야 광고가 나갑니다',
        status: 'in_progress',
        completedAt: null,
        detail: '켜면 광고가 나갑니다',
        requiresAction: true,
      },
    ],
    readyForProduction: false,
    activated: false,
    canActivate: true,
    /* 막고 있는 것이 없다. 「켜면 나갑니다」는 안내라 여기 넣지 않는다. */
    blockers: [],
  },
  'GET /v1/admin/ad-tiers': {
    tiers: [
      { tier: 'light', state: 'live', decidedAt: '2026-09-11T00:00:00.000Z', placements: 2 },
      { tier: 'standard', state: 'test', decidedAt: null, placements: 1 },
      { tier: 'premium', state: 'withheld', decidedAt: '2026-09-10T00:00:00.000Z', placements: 0 },
    ],
  },
  /*
   * 관리자 — 회원 활동 원장과 집계(0280).
   *
   * 두 층이 한 화면에 있다는 것이 요점이라 양쪽에 값을 넣는다. 집계 쪽 «사람»
   * 칸은 전부 최소 인원(10) 이상이다 — 미달인 묶음은 애초에 그 표에 없다.
   */
  'GET /v1/admin/activity': {
    ledger: {
      rows: [
        { id: 'a1', userId: '7f3c9a21-0000-4000-8000-000000000001', eventName: 'search_submitted', surface: 'search', occurredAt: '2026-09-14T02:11:00.000Z', target: null, category: 'studio', region: '서울', searchText: '강남 스튜디오', itemCount: null, step: null, corrected: false },
        { id: 'a2', userId: '7f3c9a21-0000-4000-8000-000000000001', eventName: 'vendor_viewed', surface: 'vendor', occurredAt: '2026-09-14T02:10:20.000Z', target: 'vendor#3d1f', category: 'studio', region: null, searchText: null, itemCount: null, step: null, corrected: false },
        { id: 'a3', userId: '2b80cc14-0000-4000-8000-000000000002', eventName: 'compare_started', surface: 'pick', occurredAt: '2026-09-14T01:58:00.000Z', target: null, category: null, region: null, searchText: null, itemCount: 3, step: null, corrected: false },
        { id: 'a4', userId: '2b80cc14-0000-4000-8000-000000000002', eventName: 'pick_added', surface: 'pick', occurredAt: '2026-09-14T01:57:10.000Z', target: 'vendor#9c72', category: null, region: null, searchText: null, itemCount: null, step: null, corrected: false },
        { id: 'a5', userId: '91d4e7b8-0000-4000-8000-000000000003', eventName: 'screen_view', surface: 'wedding_note', occurredAt: '2026-09-14T01:40:05.000Z', target: null, category: null, region: null, searchText: null, itemCount: null, step: null, corrected: true },
        { id: 'a6', userId: '91d4e7b8-0000-4000-8000-000000000003', eventName: 'onboarding_step', surface: 'onboarding', occurredAt: '2026-09-13T23:02:00.000Z', target: null, category: null, region: '경기', searchText: null, itemCount: null, step: 4, corrected: false },
        { id: 'a7', userId: '55ab02fe-0000-4000-8000-000000000004', eventName: 'report_submitted', surface: 'report', occurredAt: '2026-09-13T22:31:00.000Z', target: 'report#1a4e', category: 'hall', region: null, searchText: null, itemCount: null, step: null, corrected: false },
        { id: 'a8', userId: '55ab02fe-0000-4000-8000-000000000004', eventName: 'visit_note_written', surface: 'wedding_note', occurredAt: '2026-09-13T22:04:00.000Z', target: 'visit_note#77c1', category: 'dress', region: null, searchText: null, itemCount: null, step: null, corrected: false },
      ],
      total: 48213,
      subjects: 1204,
      firstAt: '2026-09-01T00:12:00.000Z',
      lastAt: '2026-09-14T02:11:00.000Z',
      droppedInProcess: 0,
    },
    rollup: {
      rows: [
        { periodStart: '2026-09-08', periodDays: 7, eventName: 'vendor_viewed', surface: 'vendor', region: null, category: null, budgetBracket: null, subjectCount: 902, eventCount: 7411 },
        { periodStart: '2026-09-08', periodDays: 7, eventName: 'vendor_viewed', surface: 'vendor', region: '서울', category: 'studio', budgetBracket: null, subjectCount: 214, eventCount: 1580 },
        { periodStart: '2026-09-08', periodDays: 7, eventName: 'search_submitted', surface: 'search', region: '경기', category: null, budgetBracket: null, subjectCount: 137, eventCount: 690 },
        { periodStart: '2026-09-08', periodDays: 7, eventName: 'compare_started', surface: 'pick', region: null, category: 'hall', budgetBracket: '20m_30m', subjectCount: 41, eventCount: 96 },
        { periodStart: '2026-09-01', periodDays: 7, eventName: 'pick_added', surface: 'pick', region: '부산', category: null, budgetBracket: null, subjectCount: 22, eventCount: 58 },
        { periodStart: '2026-09-01', periodDays: 7, eventName: 'report_submitted', surface: 'report', region: null, category: null, budgetBracket: 'unknown', subjectCount: 13, eventCount: 15 },
      ],
      total: 312,
      lastRun: {
        periodStart: '2026-09-08',
        builtAt: '2026-09-14T00:05:00.000Z',
        rowsWritten: 312,
        rowsSuppressed: 148,
        kThreshold: 10,
        foldRule: 'fold/v1',
      },
    },
    policy: { minSubjects: 10, maxAxes: 2, foldRule: 'fold/v1' },
  },
  'GET /v1/vendors': ({ url }) => {
    const category = url.searchParams.get('category');
    const vendors = category ? VENDORS.filter((v) => v.category === category) : VENDORS;

    return { vendors, sponsored: SPONSORED, nextCursor: null, total: vendors.length };
  },
};

/**
 * 들어온 경로에 맞는 응답을 고른다. `:이름` 칸은 무엇이든 맞는다.
 *
 * 없으면 `null` — 부르는 쪽이 「fixture 없음」으로 적고 404를 돌려준다.
 */
function matchRoute(method, pathname) {
  const exact = routes[`${method} ${pathname}`];

  if (exact !== undefined) return { value: exact, params: {} };

  const parts = pathname.split('/');

  for (const key of Object.keys(routes)) {
    const [keyMethod, keyPath] = key.split(' ');

    if (keyMethod !== method || !keyPath.includes(':')) continue;

    const keyParts = keyPath.split('/');

    if (keyParts.length !== parts.length) continue;

    const params = {};
    const matched = keyParts.every((part, i) => {
      if (part.startsWith(':')) {
        params[part.slice(1)] = parts[i];

        return true;
      }

      return part === parts[i];
    });

    if (matched) return { value: routes[key], params };
  }

  return null;
}

module.exports = { routes, matchRoute, VENDORS, SPONSORED, ME };
