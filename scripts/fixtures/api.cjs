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
 * WP-VEND-001 업체 상세용 fixture. `VENDORS[0]`(강남 A 웨딩홀)의 id를 그대로 쓴다 —
 * 검색 결과 카드와 상세가 같은 업체를 가리키게 두는 편이 캡처를 볼 때 헷갈리지 않는다.
 *
 * `vendorDetailSchema`는 목록 스키마에서 `paidPrice`를 덜어내고 `prices`·`usageScore`를
 * 더한 모양이다 — `VENDORS[0]`를 그대로 펼치지 않고 새로 짠다(스칠 정도로 다르다).
 */
const VENDOR_DETAIL = {
  id: VENDORS[0].id,
  name: VENDORS[0].name,
  category: VENDORS[0].category,
  region: VENDORS[0].region,
  coordinates: null,
  sourceNote: null,
  imageUrl: null,
  comparableQuoteCount: 12,
  styleTags: ['URBAN'],
  guidePrice: null,
  lastVerifiedAt: '2026-08-12',
  prices: {
    products: [
      {
        productLabel: '스탠다드 패키지',
        docType: 'contract',
        stat: {
          sampleCount: 12,
          periodStart: '2026-01-01',
          periodEnd: '2026-08-01',
          median: 1_680_000,
          p25: 1_580_000,
          p75: 1_780_000,
          p90: 1_840_000,
          minVerificationLevel: 'L2',
        },
      },
    ],
    paidPrice: disclosed(12, 1_520_000, 1_840_000, 1_680_000),
    reportedPrice: { available: false, reason: '아직 문서 없이 적어준 금액이 없어요', count: 0 },
    deepData: true,
    deepDataNote: null,
  },
  usageScore: {
    available: true,
    average: 4.6,
    count: 18,
    aspects: [{ key: 'kindness', label: '친절도', average: 4.7 }],
    checklist: [],
    caption: null,
  },
};

const VENDOR_REVIEWS = [
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    role: 'contractor',
    roleLabel: '계약자',
    overall: 5,
    title: '만족스러웠어요',
    body: '상담부터 진행까지 설명이 꼼꼼했어요.',
    pros: '응대가 빨라요',
    cons: null,
    verification: 'contract',
    verificationLabel: '계약 확인',
    aspects: [],
    createdAt: '2026-07-01T00:00:00.000Z',
    mine: false,
    rebuttal: null,
  },
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

/*
 * 캡처 대상 20개(A조 — /capture/* · /my/*, 2026-09-15)를 위한 고정 id.
 * 기존 관례(VENDOR_DETAIL·weddingId 등)를 따라 새 UUID를 정해 여기 등록한다.
 */
const CAPTURE_ANALYSIS_ID = '77777777-7777-4777-8777-777777777777';
const CAPTURE_QUOTE_ID = '88888888-8888-4888-8888-888888888888';
const CAPTURE_VERIFY_REQUEST_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const MY_REVIEW_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
/** `ME.weddingId`와 같은 값 — 아래에서 `ME`보다 먼저 쓰여 여기 따로 둔다. */
const ME_WEDDING_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** A-08 분석 결과 + A-07 확인 + A-09 가격 비교 캡처용 — 확인까지 마친 상태로 둔다. */
const QUOTE = {
  id: CAPTURE_QUOTE_ID,
  weddingId: ME_WEDDING_ID,
  docType: 'quote',
  vendor: { id: VENDORS[0].id, name: VENDORS[0].name, sourceNote: null },
  planner: { id: 'f1111111-1111-4111-8111-111111111111', name: '이수진' },
  productName: '프리미엄 패키지',
  totalAmount: 18_500_000,
  discountAmount: 500_000,
  contractDate: '2026-08-01',
  weddingDate: '2027-04-17',
  depositAmount: 2_000_000,
  balanceAmount: 16_500_000,
  hallName: '그랜드홀',
  guaranteedGuests: 220,
  mealPricePerPerson: 65_000,
  subVendors: [],
  verificationLevel: 'L0',
  source: 'ai_extraction',
  lineItems: [
    {
      id: 'f2222222-2222-4222-8222-222222222222',
      kind: 'included',
      label: '대관료',
      amount: 8_000_000,
      amountMin: null,
      amountMax: null,
      standardNote: null,
    },
    {
      id: 'f3333333-3333-4333-8333-333333333333',
      kind: 'included',
      label: '식대 (65,000원 × 220명)',
      amount: 14_300_000,
      amountMin: null,
      amountMax: null,
      standardNote: null,
    },
    {
      id: 'f4444444-4444-4444-8444-444444444444',
      kind: 'excluded',
      label: '본식 스냅 및 영상',
      amount: null,
      amountMin: 1_500_000,
      amountMax: null,
      note: '1,500,000원부터',
      standardNote: null,
    },
    {
      id: 'f5555555-5555-4555-8555-555555555555',
      kind: 'additional_candidate',
      label: '보증인원 초과분',
      amount: null,
      amountMin: null,
      amountMax: null,
      note: '1인당 65,000원',
      standardNote: null,
    },
  ],
  terms: [
    {
      id: 'f6666666-6666-4666-8666-666666666667',
      category: 'refund',
      body: '계약금은 어떠한 경우에도 환불되지 않습니다.',
      flagged: true,
      daysBeforeWedding: null,
      penaltyRate: null,
      standardNote: null,
    },
    {
      id: 'f7777777-7777-4777-8777-777777777778',
      category: 'schedule',
      body: '예식일 변경은 1회에 한하여 가능합니다.',
      flagged: false,
      daysBeforeWedding: null,
      penaltyRate: null,
      standardNote: null,
    },
  ],
  extractionFields: [
    { path: 'totalAmount', value: '18500000', confidence: 0.96, requiresConfirmation: true, confirmedByUser: true },
    { path: 'contractDate', value: '2026-08-01', confidence: 0.92, requiresConfirmation: true, confirmedByUser: true },
    {
      path: 'refundTerms',
      value: '계약금은 어떠한 경우에도 환불되지 않습니다.',
      confidence: 1,
      requiresConfirmation: true,
      confirmedByUser: true,
    },
  ],
  documents: [
    {
      rawDocumentId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      pageCount: 2,
      uploadedAt: '2026-09-01T02:00:00.000Z',
      retentionUntil: null,
      awaitingVerification: true,
      deletedAt: null,
    },
  ],
  createdAt: '2026-09-01T02:00:00.000Z',
  confirmedAt: '2026-09-01T02:05:00.000Z',
};

const ME = {
  userId: '99999999-9999-4999-8999-999999999999',
  weddingId: ME_WEDDING_ID,
  displayName: null,
  weddingDate: '2027-04-17',
  region: '서울',
  preparedCategories: [],
  budgetBracket: null,
  budgetAmount: null,
  setupComplete: true,
  styleTags: ['URBAN'],
  /* Pick 화면 캡처(배지·배너·가격 제보 링크)가 배우자 연결 상태를 필요로 한다. */
  spouseLinked: true,
  partnerDisplayName: '준호',
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
  /* `FIXTURE_SETUP_COMPLETE=false`면 온보딩(`/setup`)을 찍을 수 있다 — 그때만 setupComplete가 false다. */
  'GET /v1/me': () => ({ ...ME, setupComplete: process.env.FIXTURE_SETUP_COMPLETE !== 'false' }),
  'GET /v1/app/bootstrap': {
    member: ME,
    notifications: null,
    popularVendors: VENDORS.slice(0, 2),
    candidates: null,
    recommendations: VENDORS.slice(0, 3),
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
  /*
   * 상담기록. **저장 전(확인 필요) 한 장과 저장 후 한 장**을 함께 둔다 — 화면이
   * 갈리는 자리라 한쪽만 두면 나머지 절반을 못 본다.
   *
   * 금액의 `evidence`는 40자 이내다. 그 한도가 화면에서도 지켜지는지 보인다.
   */
  'GET /v1/weddings/:weddingId/consultations': {
    records: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        weddingId: '22222222-2222-4222-8222-222222222222',
        vendorId: null,
        vendorLabel: '강남 A 웨딩홀',
        status: 'SUPPORTED_WEDDING_CONSULTATION',
        category: 'hall',
        confidence: 0.94,
        common: {
          vendorName: '강남 A 웨딩홀',
          finalAmount: {
            value: 16_800_000,
            confidence: 0.97,
            evidence: '최종 1680만원으로 해드릴게요',
          },
          included: ['기본 꽃장식', '주차 2시간', '신부대기실'],
        },
        categoryData: {
          mealPrice: { value: 78_000, confidence: 0.97, evidence: '식대는 인당 7만 8천원입니다' },
          guaranteedGuests: 250,
        },
        after: {
          summary: '토요일 12시 홀로 보고 왔고, 보증인원 250명 기준으로 안내받았어요.',
          additionalCosts: ['생화 장식 업그레이드 80만원', '주차 3시간부터 대당 2천원'],
          benefits: ['당일 계약 시 대관료 20% 할인'],
          warnings: ['할인 적용 기한이 대화에서 확인되지 않았어요'],
          missingInformation: [
            '주류 비용은 확인되지 않았어요',
            '보증인원을 마지막으로 바꿀 수 있는 날을 확인해보세요',
          ],
        },
        confirmedAt: null,
        audioDeletedAt: null,
        createdAt: '2026-09-14T02:10:00.000Z',
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        weddingId: '22222222-2222-4222-8222-222222222222',
        vendorId: null,
        vendorLabel: '청담 B 스튜디오',
        status: 'SUPPORTED_WEDDING_CONSULTATION',
        category: 'studio',
        confidence: 0.88,
        common: {
          vendorName: '청담 B 스튜디오',
          finalAmount: { value: 1_680_000, confidence: 0.91, evidence: '168만원에 원본 포함이에요' },
          included: ['원본 전체', '보정본 30장', '의상 3벌'],
        },
        categoryData: { retouchedCount: 30, originalsIncluded: true },
        after: {
          summary: '원본 포함이고 야외촬영은 별도라고 들었어요.',
          additionalCosts: ['야외촬영 장소비 30만원'],
          benefits: [],
          warnings: [],
          missingInformation: ['사진 고르는 일정을 확인해보세요'],
        },
        confirmedAt: '2026-09-13T08:00:00.000Z',
        audioDeletedAt: '2026-09-13T08:00:01.000Z',
        createdAt: '2026-09-13T07:40:00.000Z',
      },
    ],
  },

  /*
   * 웨딩노트 캘린더 · 예산현황. 일정은 **오늘** 둘(하나는 지난 시각 = done)과 열흘 뒤 하나 —
   * 오늘이 기본 선택일이라 오늘에 일정이 없으면 목록 자리가 빈 상태로만 찍힌다.
   */
  'GET /v1/weddings/:weddingId/events': (() => {
    const today = new Date();
    const at = (dayOffset, hour) => {
      const value = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset, hour, 0, 0);
      return value.toISOString();
    };
    const event = (id, title, startsAt, status, extra = {}) => ({
      id,
      title,
      startsAt,
      location: null,
      vendorId: null,
      vendorLabel: null,
      memo: null,
      notifyEnabled: true,
      source: 'manual',
      status,
      ...extra,
    });
    return {
      events: [
        event('31111111-1111-4111-8111-111111111111', '청첩장 인쇄', at(0, 9), 'done'),
        event('32222222-2222-4222-8222-222222222222', '드레스 피팅', at(0, 14), 'upcoming', { location: '청담' }),
        event('33333333-3333-4333-8333-333333333333', '스튜디오 상담', at(10, 11), 'upcoming'),
      ],
    };
  })(),
  'GET /v1/weddings/:weddingId/expenses': {
    paidTotal: 12000000,
    scheduledTotal: 0,
    scheduledNote: '예정된 지출이 없어요',
    buckets: [
      { bucket: 'hall', label: '웨딩홀', amount: 10000000, ratio: 0.83 },
      { bucket: 'sdm', label: '스드메', amount: 2000000, ratio: 0.17 },
    ],
    budget: { set: true, budget: 30000000, spent: 12000000, remaining: 18000000, over: false },
    budgetBracket: null,
    expenses: [],
  },
  'GET /v1/weddings/:weddingId/candidates': {
    /* 웨딩홀 두 곳 — 배우자도 같이 담아 «둘 다 고른 곳» 비교 배너를 찍을 수 있게 한다. */
    groups: [
      {
        category: 'hall',
        categoryLabel: '웨딩홀',
        candidates: [
          {
            id: 'c1111111-1111-4111-8111-111111111111',
            vendorId: '11111111-1111-4111-8111-111111111111',
            vendorName: '강남 A 웨딩홀',
            category: 'hall',
            region: '서울',
            imageUrl: null,
            note: null,
            addedAt: '2026-08-01T00:00:00.000Z',
            addedByPartner: true,
          },
          {
            id: 'c2222222-2222-4222-8222-222222222222',
            vendorId: '22222222-2222-4222-8222-222222222222',
            vendorName: '강남 B 웨딩홀',
            category: 'hall',
            region: '서울',
            imageUrl: null,
            note: null,
            addedAt: '2026-08-02T00:00:00.000Z',
            addedByPartner: true,
          },
        ],
        comparable: true,
        state: 'picking',
        stateLabel: '후보 Pick 중',
        decidedVendorId: null,
      },
    ],
    total: 2,
    limit: 5,
    progress: { decided: 0, total: 13, label: '0/13 완료' },
    nextCategory: 'makeup',
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
  'GET /v1/vendors': ({ url }) => {
    const category = url.searchParams.get('category');
    const vendors = category ? VENDORS.filter((v) => v.category === category) : VENDORS;

    return { vendors, sponsored: SPONSORED, nextCursor: null, total: vendors.length };
  },
  /*
   * A-17 업체 비교 — search/compare.tsx 캡처용. VENDORS 목록을 vendorDetail 꼴로 늘린다.
   * `ids`가 없으면(계약 시험의 기본 호출처럼) 웨딩홀 두 곳으로 대신한다 — 계약은
   * `vendors`가 최소 둘이라, 빈 배열을 기본값으로 두면 시험이 항상 빨개진다.
   */
  'GET /v1/vendors/compare': ({ url }) => {
    const requested = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean);
    const ids = requested.length > 0 ? requested : [VENDORS[0].id, VENDORS[1].id];
    const vendors = ids
      .map((id) => VENDORS.find((v) => v.id === id))
      .filter(Boolean)
      .map(({ paidPrice, ...summary }) => ({
        ...summary,
        lastVerifiedAt: '2026-09-01T00:00:00.000Z',
        prices: {
          products: [],
          paidPrice,
          reportedPrice: { available: false, reason: '아직 제보가 모자라요', count: 0 },
          deepData: false,
          deepDataNote: '결제내역을 한 건 등록하면 열려요',
        },
        usageScore: { available: false, reason: '아직 후기가 모자라요', count: 0 },
      }));

    return { vendors, caveats: ['같은 조건이 아니라면 금액만으로 견주지 마세요'] };
  },

  /* WP-VEND-001 업체 상세 및 하위 화면(이미지·조건별 사례·후기). id는 무엇이 와도 같은 fixture를 낸다 — 캡처는 실제 DB를 보지 않는다. */
  'GET /v1/vendors/:vendorId': VENDOR_DETAIL,
  'GET /v1/vendors/:vendorId/images': { photos: [] },
  'GET /v1/vendors/:vendorId/conditions': {
    available: false,
    note: '조건이 비슷한 사례를 더 모으고 있어요',
  },
  'GET /v1/vendors/:vendorId/reviews': {
    reviews: VENDOR_REVIEWS,
    nextCursor: null,
    usageScore: VENDOR_DETAIL.usageScore,
    caveat: '한 사람의 경험이에요. 업체를 고르는 유일한 기준으로 삼지 마세요.',
  },

  /*
   * ── A조(2026-09-15) — /capture/* · /my/* 3Depth+ 캡처용 ──────────────────
   */

  /*
   * 결제인증 · 견적서 정리 동의 화면(WP-RPT-002 앞단)이 진입 시 부른다. 실패해도
   * 화면을 막지 않지만(캡처가 「fixture 없음」만 적고 화면은 그대로 뜬다), 없는 채로
   * 두면 캡처마다 404 콘솔 오류가 남는다 — 이미 동의하지 않은 상태로 채운다.
   */
  'GET /v1/me/settings': {
    userId: ME.userId,
    pushEnabled: true,
    priceChangeEnabled: true,
    marketingEnabled: false,
    marketingConsentAt: null,
    nightPushEnabled: false,
    paymentConsent: false,
    paymentConsentAt: null,
    documentConsent: false,
    documentConsentAt: null,
    weddingDate: ME.weddingDate,
    region: ME.region,
    spouseLinked: ME.spouseLinked,
    displayName: ME.displayName,
  },
  /* A-06 분석 중(WP-RPT-003) — «읽는 중» 단계에 세워둔다. 성공/실패는 다른 상태라 여기 안 둔다. */
  'GET /v1/analyses/:analysisId': {
    id: CAPTURE_ANALYSIS_ID,
    status: 'running',
    startedAt: '2026-09-15T01:00:00.000Z',
  },
  /* A-08 분석 결과 + A-07 확인 + A-13 자료 확인 신청(WP-RPT-004 · verify) 공용. */
  'GET /v1/quotes/:quoteId': QUOTE,
  'GET /v1/quotes/:quoteId/comparison': {
    available: true,
    docType: 'quote',
    myAmount: QUOTE.totalAmount,
    stat: {
      sampleCount: 9,
      periodStart: '2026-01-01',
      periodEnd: '2026-08-01',
      median: 17_800_000,
      p25: 16_900_000,
      p75: 18_900_000,
      p90: 19_800_000,
      minVerificationLevel: 'L2',
    },
    judgement: 'similar',
  },
  /* WP-RPT-008 인증 결과 — approved로 둔다: 처리 단계 4행 + 「반영된 곳」 + 삭제 안내까지 한 화면에서 본다. */
  'GET /v1/verification-requests/:requestId': {
    requestId: CAPTURE_VERIFY_REQUEST_ID,
    quoteId: QUOTE.id,
    targetLevel: 'L2',
    status: 'approved',
    receivedAt: '2026-09-10T01:00:00.000Z',
    decidedAt: '2026-09-12T05:00:00.000Z',
  },

  /* WP-EVT-003 친구 초대 · WP-EVT-002 미션 · WP-EVT-005 웨딩지원금 · WP-EVT-006 Npay 수령 공용. */
  'GET /v1/me/rewards': {
    referralCode: 'ABC234',
    invitedCount: 3,
    qualifiedCount: 2,
    grants: [
      {
        id: 'f8888888-8888-4888-8888-888888888889',
        kind: 'mission',
        kindLabel: '미션 완주',
        amountKrw: 5_000,
        status: 'paid',
        statusLabel: '지급 완료',
        statusNote: '2026-09-01에 보내드렸어요',
        decisionNote: null,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'f9999999-9999-4999-8999-999999999998',
        kind: 'referral',
        kindLabel: '친구초대',
        amountKrw: 3_000,
        status: 'held',
        statusLabel: '확인 중',
        statusNote: '지급을 준비하고 있어요',
        decisionNote: null,
        createdAt: '2026-09-10T00:00:00.000Z',
      },
      {
        id: 'fa111111-1111-4111-8111-111111111112',
        kind: 'referral',
        kindLabel: '친구초대',
        amountKrw: 3_000,
        status: 'earned',
        statusLabel: '조건 충족',
        statusNote: '곧 지급 대상이 돼요',
        decisionNote: null,
        createdAt: '2026-09-12T00:00:00.000Z',
      },
      {
        id: 'fb222222-2222-4222-8222-222222222223',
        kind: 'promotion',
        kindLabel: '홍보인증',
        amountKrw: 2_000,
        status: 'blocked',
        statusLabel: '반영 안 됨',
        statusNote: '조건에 맞지 않아요',
        decisionNote: '게시물이 비공개로 확인됐어요',
        createdAt: '2026-09-05T00:00:00.000Z',
      },
    ],
  },
  'GET /v1/me/monthly-draw': {
    drawMonth: '2026-09',
    status: 'entered',
    statusLabel: '응모 완료',
    statusNote: '발표 전이에요. 결과가 나오면 알려드려요.',
    amountKrw: 50_000,
    winnersPerMonth: 1,
    conditions: [
      { key: 'wedding_set', label: '예식일 · 지역 등록', done: true },
      { key: 'payment_proof', label: 'Pick 인증 1건', done: false },
      { key: 'partner', label: '배우자 연결', done: true },
    ],
    remaining: 1,
  },
  'GET /v1/me/rewards/payout': {
    receivableKrw: 5_000,
    receivableGrantIds: ['fa111111-1111-4111-8111-111111111112'],
    recipientNameDefault: '김웨딩',
    open: null,
    history: [
      {
        id: 'fc333333-3333-4333-8333-333333333334',
        amountKrw: 3_000,
        recipientName: '김웨딩',
        phoneMasked: '010-****-5678',
        status: 'sent',
        statusLabel: '지급 완료',
        statusNote: 'Npay로 보내드렸어요',
        failureReason: null,
        requestedAt: '2026-09-02T00:00:00.000Z',
        settledAt: '2026-09-03T00:00:00.000Z',
      },
      {
        id: 'fd444444-4444-4444-8444-444444444445',
        amountKrw: 2_000,
        recipientName: '김웨딩',
        phoneMasked: '010-****-5678',
        status: 'failed',
        statusLabel: '지급 실패',
        statusNote: '받는 분 번호를 다시 확인해주세요',
        failureReason: '수신 번호 오류',
        requestedAt: '2026-08-20T00:00:00.000Z',
        settledAt: null,
      },
    ],
  },
  /*
   * ── B조(2026-09-15) — /search/* · /wedding/* · /pick/* 3Depth+ 캡처용 ──────
   */

  /* WP-SRCH 웨딩박람회 목록·상세·캘린더(search/expo · expo/[expoId] · expo/[expoId]/calendar). */
  'GET /v1/expos': {
    items: [
      {
        id: 'ea111111-1111-4111-8111-111111111111',
        title: '2026 가을 강남 웨딩박람회',
        organizer: '웨딩픽',
        startsAt: '2026-10-10T02:00:00.000Z',
        endsAt: '2026-10-10T08:00:00.000Z',
        venue: '코엑스 3층 그랜드볼룸',
        region: '서울',
        status: 'upcoming',
        isDeadlineSoon: true,
        sourceNote: '주최사 안내',
        lastVerifiedAt: '2026-09-10',
      },
      {
        id: 'ea222222-2222-4222-8222-222222222222',
        title: '분당 결혼준비 박람회',
        organizer: '웨딩픽',
        startsAt: '2026-09-20T01:00:00.000Z',
        endsAt: '2026-09-20T07:00:00.000Z',
        venue: '분당 컨벤션센터',
        region: '경기',
        status: 'ongoing',
        isDeadlineSoon: false,
        sourceNote: '주최사 안내',
        lastVerifiedAt: '2026-09-14',
      },
    ],
    nextCursor: null,
  },
  'GET /v1/expos/:expoId': {
    id: 'ea111111-1111-4111-8111-111111111111',
    title: '2026 가을 강남 웨딩박람회',
    organizer: '웨딩픽',
    startsAt: '2026-10-10T02:00:00.000Z',
    endsAt: '2026-10-10T08:00:00.000Z',
    venue: '코엑스 3층 그랜드볼룸',
    region: '서울',
    status: 'upcoming',
    isDeadlineSoon: true,
    sourceNote: '주최사 안내',
    lastVerifiedAt: '2026-09-10',
    address: '서울 강남구 영동대로 513',
    registrationDeadline: '2026-10-08',
    benefits: ['방문 예약 시 스타벅스 기프티콘', '현장 계약 시 대관료 5% 할인'],
    description: '스드메·웨딩홀 30개 업체가 한자리에 모입니다. 사전 예약하면 입장 대기 없이 들어갈 수 있어요.',
    notifyEnabled: false,
  },

  /* WP-SRCH 웨딩정보(search/wedding-info · wedding-info/[infoId]). */
  'GET /v1/wedding-info': {
    items: [
      {
        id: 'eb111111-1111-4111-8111-111111111111',
        title: '결정사 상담 전 확인할 다섯 가지',
        summary: '계약서에 꼭 넣어야 하는 문구를 정리했어요',
        stage: 'early',
        category: 'planning',
        publishedAt: '2026-09-01T00:00:00.000Z',
        thumbnailUrl: null,
      },
      {
        id: 'eb222222-2222-4222-8222-222222222222',
        title: '웨딩홀 계약 전 체크리스트',
        summary: '보증인원과 식대 인상 조항을 먼저 확인하세요',
        stage: 'mid',
        category: 'venue',
        publishedAt: '2026-08-20T00:00:00.000Z',
        thumbnailUrl: null,
      },
    ],
    nextCursor: null,
  },
  'GET /v1/wedding-info/:infoId': {
    id: 'eb111111-1111-4111-8111-111111111111',
    title: '결정사 상담 전 확인할 다섯 가지',
    summary: '계약서에 꼭 넣어야 하는 문구를 정리했어요',
    stage: 'early',
    category: 'planning',
    publishedAt: '2026-09-01T00:00:00.000Z',
    thumbnailUrl: null,
    body: '결정사와 상담할 때는 견적서에 포함 항목과 별도 비용을 분리해서 받아야 해요. 특히 헤어변형·본식스냅 추가 비용은 계약서에 명시된 것만 인정돼요.',
    checklist: [
      { id: 'c1', label: '포함 항목과 별도 비용을 나눠 받았나요', done: false },
      { id: 'c2', label: '환불 규정을 확인했나요', done: false },
    ],
    relatedVendors: [{ id: VENDORS[0].id, name: VENDORS[0].name, category: VENDORS[0].category }],
  },

  /* WP-VEND 후기 쓰기 폼(write-review) · 신고 사유(reviews). */
  'GET /v1/vendors/:vendorId/review-form': {
    vendorId: VENDORS[0].id,
    vendorName: VENDORS[0].name,
    evaluationMode: 'rating',
    checklist: [],
    roles: [
      {
        value: 'contractor',
        label: '계약자',
        aspects: [
          { key: 'kindness', label: '친절도' },
          { key: 'value', label: '가격 대비 만족도' },
        ],
      },
      { value: 'couple', label: '신랑신부', aspects: [{ key: 'kindness', label: '친절도' }] },
      { value: 'guest', label: '하객', aspects: [] },
    ],
    verification: { value: 'reported', label: '작성형', note: '결제·계약 인증 없이 쓴 후기예요' },
    alreadyWritten: false,
    minimumBodyLength: 50,
    packageSiblings: [],
  },
  'GET /v1/review-report-reasons': {
    reasons: [
      { value: 'false_content', label: '허위·거짓 내용' },
      { value: 'abusive', label: '욕설·비방' },
      { value: 'spam', label: '광고·스팸' },
      { value: 'personal_info', label: '개인정보 노출' },
      { value: 'other', label: '기타' },
    ],
  },

  /* WP-PICK-007 제거된 후보(pick/removed). */
  'GET /v1/weddings/:weddingId/candidates/removed': {
    groups: [
      {
        category: 'hall',
        categoryLabel: '웨딩홀',
        items: [
          {
            id: 'ec111111-1111-4111-8111-111111111111',
            vendorName: '송파 D 웨딩홀',
            removedAt: '2026-08-20T00:00:00.000Z',
          },
        ],
      },
    ],
  },

  /* WP-OUR-010 지출 상세(wedding/[id]/expenses/[expenseId]). */
  'GET /v1/weddings/:weddingId/expenses/:expenseId': {
    id: 'ed111111-1111-4111-8111-111111111111',
    label: '웨딩홀 계약금',
    amount: 3_000_000,
    category: 'hall',
    bucket: 'hall',
    status: 'paid',
    statusLabel: '결제 완료',
    spentOn: '2026-08-01',
    source: 'payment_proof',
    sourceLabel: 'Pick 인증',
    refundStatus: 'normal',
    refundStatusLabel: '정상',
    bucketLabel: '웨딩홀',
    registeredByPartner: false,
    registeredAt: '2026-08-01T02:00:00.000Z',
    splitPayments: [],
  },

  /* 업체 반론(디자인 핸드오프 20번) — 이미 낸 반론이 있는 상태로 캡처한다(고치기 폼). */
  'GET /v1/me/rebuttals': {
    rebuttals: [
      {
        id: 'fe555555-5555-4555-8555-555555555556',
        status: 'pending',
        statusLabel: '확인 중',
        statusNote: '담당자가 확인하고 있어요',
        claimedRole: '매니저',
        body: '문의 주신 금액은 안내드린 견적과 같습니다. 확인 부탁드려요.',
        decisionNote: null,
        createdAt: '2026-09-11T00:00:00.000Z',
        review: {
          id: MY_REVIEW_ID,
          vendorId: VENDORS[0].id,
          vendorName: VENDORS[0].name,
          title: '친절했지만 안내와 달랐어요',
          body: '상담은 친절했는데 실제 견적이 안내와 조금 달랐어요.',
          overall: 3,
          createdAt: '2026-09-08T00:00:00.000Z',
        },
      },
    ],
  },

  /*
   * ── C조(2026-09-15) — 뎁스=2 사용자 화면 49개 캡처용 ──────────────────────
   */

  /* WP-RPT-008 내가 낸 자료(MY 홈·프로필·내 반론·내 후기가 함께 부른다). */
  'GET /v1/me/reports': {
    reports: [
      {
        id: 'ee111111-1111-4111-8111-111111111111',
        kind: 'payment_proof',
        kindLabel: '결제인증',
        use: '가격 비교에 쓰이고 있어요',
        subject: VENDORS[0].name,
        vendorId: VENDORS[0].id,
        amount: 16_800_000,
        reportedAt: '2026-08-01T02:00:00.000Z',
        inUse: true,
        needsCheck: false,
        note: null,
      },
      {
        id: 'ee222222-2222-4222-8222-222222222222',
        kind: 'price_report',
        kindLabel: '가격 제보',
        use: '아직 업체를 못 찾았어요',
        subject: '강남 어느 스튜디오',
        vendorId: null,
        amount: 1_200_000,
        reportedAt: '2026-08-20T05:00:00.000Z',
        inUse: false,
        needsCheck: true,
        note: null,
      },
    ],
  },

  /* WP-CS-002 문의 내역(고객지원·업체 관계자 문의가 함께 부른다). */
  'GET /v1/inquiries': {
    inquiries: [
      {
        id: 'ee333333-3333-4333-8333-333333333333',
        category: 'data_correction',
        body: '실 제보는 어디서 온 금액인가요?',
        status: 'answered',
        subject: null,
        receivedAt: '2026-09-01T02:00:00.000Z',
        decidedAt: '2026-09-02T02:00:00.000Z',
        resolution: '실제 결제한 사용자가 낸 금액이에요.',
      },
    ],
  },

  /* 알림함(WP-NOTI 계열) — 읽음/안읽음 섞어서 배지·정렬을 함께 볼 수 있게 한다. */
  'GET /v1/me/notifications': {
    notifications: [
      {
        id: 'ee444444-4444-4444-8444-444444444444',
        kind: 'verification',
        kindLabel: '자료 확인',
        title: '자료 확인이 끝났어요',
        body: '올려주신 결제인증이 반영됐어요.',
        targetId: null,
        createdAt: '2026-09-14T02:00:00.000Z',
        readAt: null,
      },
      {
        id: 'ee555555-5555-4555-8555-555555555555',
        kind: 'partner',
        kindLabel: '배우자 연결',
        title: '배우자가 연결됐어요',
        body: '이제 함께 준비할 수 있어요.',
        targetId: null,
        createdAt: '2026-09-10T02:00:00.000Z',
        readAt: '2026-09-10T03:00:00.000Z',
      },
    ],
    unread: 1,
    total: 2,
  },

  /* 내가 낸 업체 관계자 인증 신청(WP-BIZ 계열). */
  'GET /v1/me/vendor-claims': {
    claims: [
      {
        id: 'ee666666-6666-4666-8666-666666666666',
        vendorId: VENDORS[0].id,
        vendorName: VENDORS[0].name,
        claimedRole: '매니저',
        method: 'listed_email',
        methodLabel: '공개된 이메일',
        status: 'pending',
        statusLabel: '확인 중',
        statusNote: '담당자가 확인하고 있어요',
        decisionNote: null,
        createdAt: '2026-09-11T02:00:00.000Z',
      },
    ],
  },

  /* 최종 결정 목록(웨딩노트 결정 완료). 웨딩홀 한 곳만 정한 상태로 둔다. */
  'GET /v1/weddings/:weddingId/decisions': {
    decisions: [
      {
        category: 'hall',
        categoryLabel: '웨딩홀',
        vendor: { id: VENDORS[0].id, name: VENDORS[0].name, region: VENDORS[0].region },
        decidedAt: '2026-08-15T02:00:00.000Z',
        decidedByPartner: false,
        events: [
          {
            id: 'ee777777-7777-4777-8777-777777777777',
            title: '웨딩홀 계약',
            startsAt: '2026-08-15T05:00:00.000Z',
            location: null,
          },
        ],
        expenses: {
          bucket: 'hall',
          bucketLabel: '웨딩홀',
          paidTotal: 10_000_000,
          paidCount: 1,
          scheduledTotal: 0,
          scheduledCount: 0,
        },
      },
    ],
  },

  /* 웨딩 단건(내 웨딩 진입 화면). */
  'GET /v1/weddings/:weddingId': {
    id: ME_WEDDING_ID,
    weddingDate: ME.weddingDate,
    partnerLinked: true,
    preparedCategories: ['hall'],
    createdAt: '2026-06-01T02:00:00.000Z',
    members: [
      { role: 'owner', joinedAt: '2026-06-01T02:00:00.000Z', isMe: true },
      { role: 'partner', joinedAt: '2026-06-02T02:00:00.000Z', isMe: false },
    ],
  },

  /* 웨딩노트 메모. */
  'GET /v1/weddings/:weddingId/notes': {
    notes: [
      {
        id: 'ee888888-8888-4888-8888-888888888888',
        vendorId: VENDORS[0].id,
        vendorLabel: VENDORS[0].name,
        body: '보증인원 250명 기준으로 안내받았어요.',
        authoredByPartner: false,
        edited: false,
        editedByPartner: null,
        createdAt: '2026-08-10T02:00:00.000Z',
        updatedAt: '2026-08-10T02:00:00.000Z',
        version: 1,
      },
    ],
  },

  /* 견적서 목록(웨딩노트 견적). */
  'GET /v1/weddings/:weddingId/quotes': {
    quotes: [QUOTE],
    nextCursor: null,
  },

  /* 준비 체크리스트(웨딩노트 할 일). */
  'GET /v1/weddings/:weddingId/tasks': {
    tasks: [
      {
        id: 'ee999999-9999-4999-8999-999999999999',
        label: '청첩장 인쇄',
        dueDate: '2026-09-20',
        vendorId: null,
        vendorLabel: null,
        state: 'done',
        stateLabel: '완료',
        manualState: false,
      },
      {
        id: 'eeaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        label: '드레스 피팅',
        dueDate: '2026-10-01',
        vendorId: null,
        vendorLabel: '청담 B 스튜디오',
        state: 'upcoming',
        stateLabel: '예정',
        manualState: false,
      },
    ],
    progress: { done: 1, total: 2 },
  },

  /* 방문노트. */
  'GET /v1/weddings/:weddingId/visit-notes': {
    notes: [
      {
        id: 'eebbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        vendorId: VENDORS[0].id,
        vendorLabel: VENDORS[0].name,
        visitedOn: '2026-08-05',
        quotedAmount: 16_500_000,
        memo: '토요일 12시 홀로 보고 왔어요.',
      },
    ],
    caveat: '그 자리에서 들은 금액이라 실제 계약가와 다를 수 있어요.',
  },

  /* 배우자 초대 현황(초대 링크 화면). 살아 있는 초대가 없는 상태로 둔다. */
  'GET /v1/weddings/:weddingId/invites': { invite: null },

  /* TOP3 추천. */
  'GET /v1/recommendations/top3': {
    region: '서울',
    category: 'hall',
    items: [
      {
        vendorId: VENDORS[0].id,
        name: VENDORS[0].name,
        category: 'hall',
        region: VENDORS[0].region,
        imageUrl: null,
        reasons: ['many_confirmed'],
        confirmedCount: 12,
        paidPrice: VENDORS[0].paidPrice,
        styleTags: VENDORS[0].styleTags,
        guidePrice: null,
      },
    ],
    note: null,
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
