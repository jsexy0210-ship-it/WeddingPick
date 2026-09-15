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
  /** 홈 아래쪽 웨딩피드 — 공개된 글만. 홈은 두 장만 보여준다(`HOME_FEED_PREVIEW_COUNT`). */
  'GET /v1/wedding-feed': {
    items: [
      {
        id: '00000000-0000-4000-8000-0000000000f1',
        categoryLabel: '예산',
        title: '예산을 넘기지 않는 스드메 조합 3가지',
        summary: '항목별로 먼저 상한을 정해두면 흔들리지 않아요.',
        imageUrl: null,
      },
      {
        id: '00000000-0000-4000-8000-0000000000f2',
        categoryLabel: '웨딩홀',
        title: '웨딩홀 투어에서 꼭 물어볼 것',
        summary: '보증인원과 식대 인상 조건을 먼저 확인하세요.',
        imageUrl: null,
      },
    ],
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
  'GET /v1/weddings/:weddingId/candidates/removed': {
    groups: [],
  },
  /* 응답 본문이 없다(z.null()) — Pick 비교 로그. */
  'POST /v1/weddings/:weddingId/comparisons': null,
  'GET /v1/me/rewards/payout': {
    receivableKrw: 300000,
    receivableGrantIds: ['a1111111-1111-4111-8111-111111111111'],
    recipientNameDefault: '우리',
    open: null,
    history: [],
  },
  'GET /v1/me/reports': { reports: [] },
  /*
   * 문의 목록(WP-MY 문의하기). **빈 목록으로 둔다** — 이 화면에서 찍어 볼 것은
   * FAQ 아코디언과 분류 칩이고, 둘 다 문의 이력 없이 그려진다. 가짜 문의를
   * 지어내면 그 문구까지 시안과 맞는지를 다시 따져야 한다.
   */
  'GET /v1/inquiries': { inquiries: [] },
  'GET /v1/me/rewards': {
    referralCode: 'ABC123',
    invitedCount: 0,
    qualifiedCount: 0,
    grants: [],
  },
  'GET /v1/me/settings': {
    userId: 'u1111111-1111-4111-8111-111111111111',
    pushEnabled: true,
    priceChangeEnabled: true,
    marketingEnabled: false,
    marketingConsentAt: null,
    nightPushEnabled: false,
    paymentConsent: true,
    paymentConsentAt: '2026-08-01T00:00:00.000Z',
    documentConsent: false,
    documentConsentAt: null,
    weddingDate: '2027-04-17',
    region: '서울',
    spouseLinked: true,
    displayName: '우리',
  },
  'GET /v1/me/withdrawal': {
    lead: '배우자와 함께 만든 기록도 함께 사라져요',
    hasPartner: true,
    deleted: [
      { label: '계정 정보', value: '이메일 · 로그인 정보' },
      { label: 'Pick 목록', value: '2건' },
    ],
    separated: [{ label: '작성한 후기', note: '작성자 정보만 지워지고 후기는 남아요', anonymous: true }],
    done: ['계정이 삭제됐어요', '로그인 정보가 지워졌어요'],
  },
  'GET /v1/weddings/:weddingId/invites': { invite: null },
  'GET /v1/expos': {
    items: [
      {
        id: 'e1111111-1111-4111-8111-111111111111',
        title: '2026 가을 웨딩 박람회',
        organizer: '웨딩픽',
        startsAt: '2026-09-26T01:00:00.000Z',
        endsAt: '2026-09-27T09:00:00.000Z',
        venue: '서울 코엑스',
        region: '서울',
        status: 'upcoming',
        isDeadlineSoon: true,
        sourceNote: '주최사 공지 기준',
        lastVerifiedAt: '2026-09-10T00:00:00.000Z',
      },
    ],
    nextCursor: null,
  },
  'GET /v1/review-report-reasons': {
    reasons: [
      { value: 'false_content', label: '사실과 달라요' },
      { value: 'abusive', label: '욕설·비방이에요' },
      { value: 'spam', label: '광고·스팸이에요' },
      { value: 'personal_info', label: '개인정보가 담겼어요' },
      { value: 'other', label: '기타' },
    ],
  },
  'GET /v1/me/monthly-draw': {
    drawMonth: '2026-09',
    status: 'not_entered',
    statusLabel: '응모 전',
    statusNote: '두 가지만 더 하면 이번 달 응모가 완료돼요',
    amountKrw: 300000,
    winnersPerMonth: 5,
    conditions: [
      { key: 'wedding_set', label: '예식일과 지역 설정', done: true },
      { key: 'payment_proof', label: 'Pick 인증 1건 이상', done: false },
      { key: 'partner', label: '배우자와 연결', done: false },
    ],
    remaining: 2,
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
  /*
   * 관리자 계정. 뷰어가 표에 저장된 진짜 슈퍼(`viewerAccountId`가 자기 자신)인
   * 상태로 찍는다 — 「나머지 전체를 뷰어로」 단추가 보이는 화면이 이 상태다.
   */
  'GET /v1/admin/accounts': {
    accounts: [
      {
        id: 'aaaaaaaa-0000-4000-8000-000000000001',
        loginId: 'jsexy0210',
        role: 'super',
        disabled: false,
        createdBy: null,
        createdAt: '2026-09-10T00:00:00.000Z',
      },
      {
        id: 'aaaaaaaa-0000-4000-8000-000000000002',
        loginId: 'ops-team',
        role: 'operator',
        disabled: false,
        createdBy: 'jsexy0210',
        createdAt: '2026-09-12T00:00:00.000Z',
      },
      {
        id: 'aaaaaaaa-0000-4000-8000-000000000003',
        loginId: 'qa-checker',
        role: 'viewer',
        disabled: false,
        createdBy: 'jsexy0210',
        createdAt: '2026-09-13T00:00:00.000Z',
      },
    ],
    viewerIsStored: true,
    viewerAccountId: 'aaaaaaaa-0000-4000-8000-000000000001',
  },
  /*
   * 대시보드 + 일일 브리핑(2026-09-15 대표 확정으로 한 화면). 브리핑은 대시보드
   * 아래 절반이라 이 파일에서는 셋을 나란히 둔다 — 화면을 찍으면 위아래가 한 번에 보인다.
   */
  'GET /v1/admin/dashboard': {
    humanQueue: [
      { key: 'queue', label: '확인 필요', why: '실 제보 인증 대기', count: 3, tone: 'caution' },
      { key: 'rebuttal', label: '후기 · 반론', why: '관계자 인증 확인 필요', count: 1, tone: 'danger' },
    ],
    humanTotal: 4,
    dashCards: [
      { key: 'ai-usage', label: '분석 비용', mode: '비용', value: '12,400', unit: '원', note: '오늘 사용분' },
      { key: 'price-stats', label: '가격 통계', mode: '지표', value: '128', unit: '건', note: '이번 주 신규' },
      { key: 'campaigns', label: '캠페인 참여', mode: '지표', value: '56', unit: '명', note: '이번 회차' },
      { key: 'automation1', label: '자동 처리', mode: '자동', value: '312', unit: '건', note: '최근 24시간' },
      { key: 'automation2', label: '자동 성공률', mode: '자동', value: '98.2', unit: '%', note: '최근 24시간' },
      { key: 'automation3', label: '자동 복구', mode: '자동', value: '2', unit: '건', note: '최근 24시간' },
    ],
    auto: {
      ratePct: 92,
      segments: [
        { key: 'concluded', label: '자동 종결', count: 288 },
        { key: 'failed', label: '실패', count: 6 },
        { key: 'human', label: '사람에게 넘김', count: 18 },
      ],
      keepRatePct: 96,
      revertedCount: 2,
      medianLatencyMs: 4200,
      byWorkflow: [
        { workflow: 'verification-review', concluded: 210, failed: 4, human: 12, reverted: 1, autoPct: 93 },
      ],
    },
    autoLog: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        decision: '승인',
        subject: '강남 A 웨딩홀',
        reasonCode: 'auto_verified',
        confidence: 0.94,
        decidedAt: '2026-09-15T02:00:00.000Z',
        tone: 'ok',
      },
    ],
  },
  'GET /v1/admin/members-trend': {
    bucket: 'month',
    points: [
      { at: '2026-07-01T00:00:00.000Z', signups: 120, total: 1200 },
      { at: '2026-08-01T00:00:00.000Z', signups: 150, total: 1350 },
      { at: '2026-09-01T00:00:00.000Z', signups: 90, total: 1440 },
    ],
    current: 1440,
  },
  'GET /v1/admin/briefing': {
    date: '2026-09-15',
    autoProcessed: 312,
    successRate: 0.982,
    autoRecovered: 2,
    unresolvedRisks: [],
    aiCostToday: '12,400원',
    revenueToday: '0원',
    anomalies: [],
    summary: '오늘 처리한 312건 중 사람이 볼 것은 없어요.',
  },
  'GET /v1/admin/ad-tiers': {
    tiers: [
      { tier: 'light', state: 'live', decidedAt: '2026-09-11T00:00:00.000Z', placements: 2 },
      { tier: 'standard', state: 'test', decidedAt: null, placements: 1 },
      { tier: 'premium', state: 'withheld', decidedAt: '2026-09-10T00:00:00.000Z', placements: 0 },
    ],
  },
  /** 관리자 — 웨딩피드(WP-ADM-053). 검토 대기 초안 하나 · 공개 하나 · 자동 작성 한 바퀴. */
  'GET /v1/admin/wedding-feed': {
    posts: [
      {
        id: '00000000-0000-4000-8000-0000000000f1',
        categoryLabel: '예산',
        title: '스드메 예산을 넘기지 않게 짜는 방법',
        summary: '항목별로 먼저 상한을 정해두면 흔들리지 않아요.',
        body: '스드메 예산을 짤 때는…',
        imageKey: null,
        imageUrl: null,
        status: 'draft',
        source: 'generated',
        model: 'gemini-2.5-flash-lite',
        topic: 'budget-sdm',
        sortOrder: 0,
        publishedAt: null,
        createdAt: '2026-09-15T01:00:00.000Z',
        updatedAt: '2026-09-15T01:00:00.000Z',
      },
      {
        id: '00000000-0000-4000-8000-0000000000f2',
        categoryLabel: '웨딩홀',
        title: '웨딩홀 투어에서 꼭 물어볼 것',
        summary: '보증인원과 식대 인상 조건을 먼저 확인하세요.',
        body: '웨딩홀 투어에서는…',
        imageKey: null,
        imageUrl: null,
        status: 'published',
        source: 'manual',
        model: null,
        topic: null,
        sortOrder: 1,
        publishedAt: '2026-09-14T09:00:00.000Z',
        createdAt: '2026-09-14T09:00:00.000Z',
        updatedAt: '2026-09-14T09:00:00.000Z',
      },
    ],
    runs: [
      {
        id: '00000000-0000-4000-8000-0000000000f9',
        startedAt: '2026-09-15T01:00:00.000Z',
        finishedAt: '2026-09-15T01:00:20.000Z',
        createdCount: 1,
        model: 'gemini-2.5-flash-lite',
        inputTokens: 512,
        outputTokens: 640,
        error: null,
        trigger: 'schedule',
      },
    ],
    remainingTopics: 16,
  },
  /* WP-ADM 박람회 관리(admin/expos.tsx) — 검수 대기 한 건 · 정상 한 건을 함께 둔다. */
  'GET /v1/admin/expos': {
    expos: [
      {
        id: 'f1111111-1111-4111-8111-111111111111',
        title: '2026 서울 웨딩페어(확인 필요)',
        organizer: '확인되지 않음',
        host: null,
        startsAt: '2026-10-10',
        endsAt: '2026-10-12',
        venue: '코엑스 A홀',
        address: '서울 강남구 영동대로 513',
        region: '서울',
        city: null,
        district: null,
        registrationDeadline: null,
        reservationUrl: null,
        officialWebsiteUrl: null,
        benefits: [],
        description: '',
        eventCategories: ['종합 웨딩박람회'],
        status: 'UPCOMING',
        confidence: 'SOCIAL_ONLY',
        confidenceScore: 55,
        adminReviewRequired: true,
        reviewReason: ['SNS 한 곳에서만 발견', '주최사를 확인할 수 없음'],
        sourceNote: '인스타그램 게시물 1건',
        lastVerifiedAt: '2026-09-14',
      },
      {
        id: 'f2222222-2222-4222-8222-222222222222',
        title: '2026 경기 웨딩박람회',
        organizer: '웨딩픽 박람회 운영팀',
        host: null,
        startsAt: '2026-09-20',
        endsAt: '2026-09-21',
        venue: '킨텍스 제2전시장',
        address: '경기 고양시 일산서구 킨텍스로 217-60',
        region: '경기',
        city: '고양시',
        district: null,
        registrationDeadline: '2026-09-18',
        reservationUrl: 'https://example.com/apply',
        officialWebsiteUrl: 'https://example.com',
        benefits: ['현장 예약 시 계약금 할인'],
        description: '경기권 예비부부 대상 종합 웨딩박람회예요.',
        eventCategories: ['종합 웨딩박람회'],
        status: 'ONGOING',
        confidence: 'OFFICIAL_CONFIRMED',
        confidenceScore: 95,
        adminReviewRequired: false,
        reviewReason: [],
        sourceNote: '주최사 공식 홈페이지',
        lastVerifiedAt: '2026-09-14',
      },
    ],
  },
  'GET /v1/admin/expos/deletion-preview': {
    expos: [
      {
        id: 'f3333333-3333-4333-8333-333333333333',
        title: '2026 인천 웨딩박람회',
        startsAt: '2026-09-08',
        endsAt: '2026-09-15',
        venue: '송도컨벤시아',
      },
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
