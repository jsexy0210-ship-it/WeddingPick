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
  /*
   * 별점. **일부러 없는 곳을 섞어 둔다** — 확인된 후기 5건에 못 미치거나 체크리스트
   * 업종(결정사)이면 null이고, 그때 카드가 별점 줄을 안 그린다. 캡처에서 두 꼴이 같이
   * 보여야 「없는 카드」의 생김새를 눈으로 확인할 수 있다.
   */
  rating: opts.rating ?? null,
  reasons: opts.reasons ?? [],
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
    rating: { average: 4.7, count: 18 },
    reasons: ['고른 사진이랑 가장 비슷해요', '생각한 예산 안에 들어와요', '찾던 조건이 가장 많이 맞아요'],
  }),
  vendor('22222222-2222-4222-8222-222222222222', '강남 B 웨딩홀', 'hall', '서울', {
    reports: 5,
    paidPrice: disclosed(5, 1_900_000, 2_400_000),
    styleTags: ['GLAMOROUS'],
    rating: { average: 4.3, count: 7 },
    reasons: ['원하는 날에 가능해요', '실 제보가 충분히 모였어요'],
  }),
  vendor('33333333-3333-4333-8333-333333333333', '분당 C 웨딩홀', 'hall', '경기', {
    reports: 1,
    paidPrice: { stage: 'collecting', count: 1, caption: '수집 중' },
    guideFrom: 1_500_000,
    styleTags: ['NATURAL'],
    reasons: ['좋아하는 분위기와 비슷해요'],
  }),
  vendor('44444444-4444-4444-8444-444444444444', '송파 D 웨딩홀', 'hall', '서울', {
    styleTags: ['ROMANTIC'],
  }),
  vendor('55555555-5555-4555-8555-555555555555', '강남 E 스튜디오', 'studio', '서울', {
    reports: 8,
    paidPrice: disclosed(8, 980_000, 1_240_000, 1_100_000),
    styleTags: ['NATURAL'],
    rating: { average: 4.9, count: 11 },
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
    media: [],
    helpful: { count: 3, mine: false },
    comments: {
      count: 1,
      items: [
        {
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          body: '상담 일정은 어느 정도 여유를 두고 잡으셨나요?',
          createdAt: '2026-07-02T00:00:00.000Z',
          mine: false,
        },
      ],
    },
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
  hasPaymentProof: process.env.FIXTURE_HAS_PAYMENT_PROOF === 'true',
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
    /* 히어로 «남은 예산 3,000만원 · 27% 사용». */
    budget: { total: 41_000_000, spent: 11_000_000, remaining: 30_000_000 },
    bracketAnswered: true,
    partnerInvitePending: false,
  },
  /**
   * 자주 묻는 것 — MY 지원 · 문의하기 · 안내 · 질문 상세 넷이 읽는다.
   *
   * **2026-09-16부터 서버에서 온다**(대표 지시 — 운영자가 직접 고치고 지운다).
   * 그전에는 코드에 든 배열이라 가짜 응답이 필요 없었다.
   *
   * 답은 **이미 채워진 글**이다 — 서버가 `{{limited}}` 같은 자리를 공개 기준
   * 건수로 바꿔 내보낸다. 여기에 괄호를 그대로 두면 찍은 화면에 괄호가 나온다.
   */
  'GET /v1/faq': {
    items: [
      {
        key: 'price-source',
        category: '자주 묻는 것',
        question: '실 제보는 어디서 온 금액인가요',
        answer:
          '이용자가 등록한 결제내역에서 읽은 금액이에요. 실 제보가 3건 모이면 구간을 보여드리고, 10건부터 기준금액까지 보여드려요. 그 아래에서는 숫자를 만들지 않고 모으는 중이라고 알려드려요.',
      },
      {
        key: 'why-locked',
        category: '자주 묻는 것',
        question: '가격을 보려면 결제내역을 등록해야 하나요',
        answer:
          '아니요. 실 제보는 로그인하지 않아도 보실 수 있어요. 결제내역을 등록하시면 조건이 비슷한 결제 사례를 함께 보실 수 있어요.',
      },
      {
        key: 'original-image',
        category: '자주 묻는 것',
        question: '올린 이미지는 어떻게 되나요',
        answer:
          '금액과 가맹점 이름 같은 필요한 정보만 읽고, 원본 이미지는 24시간 안에 지워요. 카드번호처럼 함께 찍힌 번호는 있었다는 것만 남기고 값은 저장하지 않아요.',
      },
      {
        key: 'who-sees',
        category: '자주 묻는 것',
        question: '제가 올린 금액이 다른 사람에게 그대로 보이나요',
        answer: '개별 금액은 보이지 않아요. 여럿을 묶은 구간과 기준금액으로만 보여드려요.',
      },
      {
        key: 'review-hidden',
        category: '자주 묻는 것',
        question: '쓴 후기가 갑자기 안 보여요',
        answer:
          '전화번호나 계좌번호처럼 위험한 정보가 들어 있으면 잠시 가려요. 알림으로 알려드리고, 그 부분을 지워 고치시면 다시 보여요.',
      },
      {
        key: 'vendor-rebuttal',
        category: '자주 묻는 것',
        question: '업체가 제 후기에 반론을 달 수 있나요',
        answer:
          '업체 관계자임이 확인되면 후기 아래에 반론이 함께 표시돼요. 반론이 달려도 원래 후기는 지워지지 않아요.',
      },
      {
        key: 'spouse',
        category: '자주 묻는 것',
        question: '배우자와 어디까지 함께 보나요',
        answer:
          '연결하면 지출내역, 웨딩 스케줄, Pick한 곳을 함께 보실 수 있어요. 연결을 끊으면 그때부터 서로 보이지 않아요.',
      },
    ],
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
    /*
     * 탭은 글과 «같은 응답»으로 온다(2026-09-16 대표 지시 — 「탭별 카테고리별로 다
     * 설정 가능해야한다」). 값은 관리자가 표에서 고치고, 여기 있는 것은 0420의
     * 씨앗값 그대로다. 「전체」는 표에 없고 언제나 맨 앞이다.
     */
    tabs: [
      { key: 'all', label: '전체', categories: [] },
      {
        key: '00000000-0000-4000-8000-0000000000a1',
        label: '준비·예산',
        categories: ['예산', '체크리스트', '준비 순서', '하객'],
      },
      {
        key: '00000000-0000-4000-8000-0000000000a2',
        label: '업체·서비스',
        categories: [
          '웨딩홀',
          '스튜디오',
          '드레스',
          '메이크업',
          '본식스냅',
          '헤어변형',
          '결정사',
        ],
      },
      {
        key: '00000000-0000-4000-8000-0000000000a3',
        label: '계약·여행',
        categories: ['계약', '허니문'],
      },
    ],
  },

  /*
   * 글 하나 — 카드를 눌러 들어간 자리. 목록의 첫 글과 같은 id · 제목이라야
   * 캡처에서 「눌러서 들어왔다」가 이어져 보인다. 본문은 목록에 없는 값이다.
   */
  'GET /v1/wedding-feed/:id': {
    id: '00000000-0000-4000-8000-0000000000f1',
    categoryLabel: '예산',
    title: '예산을 넘기지 않는 스드메 조합 3가지',
    summary: '항목별로 먼저 상한을 정해두면 흔들리지 않아요.',
    body: '스드메는 세 가지를 한 번에 정하는 자리라 한쪽이 늘면 다른 쪽이 줄어요.\n\n먼저 항목별 상한을 적어두면 상담에서 흔들리지 않아요. 스튜디오는 원본 제공 조건, 드레스는 피팅 횟수와 추가 비용, 메이크업은 리허설 포함 여부를 함께 확인하세요.\n\n계약 전에 총액이 아니라 항목별 금액으로 받아 적으면 나중에 무엇이 늘었는지 바로 보여요.',
    imageUrl: null,
    bodyImageUrl: null,
    publishedAt: '2026-09-15T02:00:00.000Z',
  },
  /** 라운지 후기 — 07-lounge-my의 Pick 인증 + 3축 populated 상태를 캡처한다. */
  'GET /v1/reviews': {
    reviews: [
      {
        ...VENDOR_REVIEWS[0],
        verification: 'contract',
        verificationLabel: 'Pick 인증',
        aspects: [
          { key: 'progress', label: '진행', rating: 5 },
          { key: 'result', label: '결과물', rating: 4 },
          { key: 'extra_cost', label: '추가비용', rating: 5 },
        ],
        media: [
          {
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            url: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3',
            mimeType: 'image/jpeg',
          },
        ],
        vendor: {
          id: VENDORS[4].id,
          name: VENDORS[4].name,
          category: VENDORS[4].category,
        },
      },
    ],
    nextCursor: null,
    caveat: 'Pick 인증이 있는 후기는 인증 배지가 함께 보여요.',
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
  'GET /v1/weddings/:weddingId/decisions': { decisions: [] },
  /*
   * 웨딩일정(홈 「웨딩일정」 · 웨딩노트 체크리스트) — GET /v1/weddings/:id/tasks.
   * 날짜 셋을 **오늘 기준 상대값**으로 둔다 — 고정 과거 날짜면 홈의 `scheduleRows`가
   * (지난 일정은 뺀다) 전부 걸러내 빈 목록만 찍힌다.
   */
  'GET /v1/weddings/:weddingId/tasks': (() => {
    const today = new Date();
    const day = (offset) => {
      const value = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    };
    const task = (id, label, dueDate, vendorLabel) => ({
      id, label, dueDate, vendorId: null, vendorLabel, state: 'upcoming', stateLabel: '예정', manualState: false,
    });
    return {
      tasks: [
        task('41111111-1111-4111-8111-111111111111', '드레스 피팅', day(2), '그레이스 드레스'),
        task('42222222-2222-4222-8222-222222222222', '스튜디오 촬영', day(10), '블루밍 스튜디오'),
        task('43333333-3333-4333-8333-333333333333', '본식 리허설', day(24), '더채플 청담'),
      ],
      progress: { done: 3, total: 14 },
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
    /* 출처 셋을 한 줄씩 — v3.28 웨딩노트 「금액 출처」(2026-09-23): 상담 정리도 같은 목록에 들어온다. */
    expenses: [
      {
        id: 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1',
        label: '청담 E 웨딩홀',
        amount: 10000000,
        category: 'hall',
        bucket: 'hall',
        status: 'paid',
        statusLabel: '지출완료',
        spentOn: '2026-09-05',
        source: 'payment_proof',
        sourceLabel: 'Pick 인증 자료',
        refundStatus: 'normal',
        refundStatusLabel: '정상',
      },
      {
        id: 'e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2',
        label: '드레스 예약금',
        amount: 500000,
        category: 'dress',
        bucket: 'sdm',
        status: 'paid',
        statusLabel: '지출완료',
        spentOn: '2026-09-10',
        source: 'manual',
        sourceLabel: '직접 입력',
        refundStatus: 'normal',
        refundStatusLabel: '정상',
      },
      {
        id: 'e3e3e3e3-e3e3-4e3e-8e3e-e3e3e3e3e3e3',
        label: '블루밍 스튜디오',
        amount: 1500000,
        category: 'studio',
        bucket: 'sdm',
        status: 'paid',
        statusLabel: '지출완료',
        spentOn: '2026-09-14',
        source: 'consultation',
        sourceLabel: '상담 정리',
        refundStatus: 'normal',
        refundStatusLabel: '정상',
      },
    ],
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
            /* 별점(v3.28 2026-09-23 복원) — 확인된 후기가 충분한 쪽. */
            rating: { average: 4.7, count: 18 },
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
            /* 일부러 null을 섞는다 — 카드가 별점 줄을 안 그리는 꼴도 캡처로 봐야 한다. */
            rating: null,
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
  /*
   * Pick DLG-F 캡처가 실제 삭제 → 되돌리기 흐름을 타도록 mutation도 성공시킨다.
   * 캡처 스크립트는 프로덕션 API를 절대 호출하지 않으므로 이 fixture가 없으면
   * 제품 오류가 아니라 fixture 404를 찍게 된다.
   */
  'DELETE /v1/weddings/:weddingId/candidates/:candidateId': null,
  'POST /v1/weddings/:weddingId/candidates': {
    candidateId: 'c1111111-1111-4111-8111-111111111111',
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
  /* MY 「문의하기」 꼬리 · 라운지 — 문의가 없는 상태가 기본이다. */
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
  /*
   * Pick 추천 — 홈 아코디언과 「웨딩픽 추천」 전체 페이지가 같이 쓴다. 상태를 셋 다 다르게
   * 둬서 캡처 한 장에 «비교» · «보기» · «추천»이 같이 보이게 한다. `limit`은 무시한다 —
   * 캡처에서는 홈도 전체 페이지도 같은 셋을 그린다.
   */
  'GET /v1/me/recommendations': {
    groups: [
      {
        category: 'hall',
        categoryLabel: '웨딩홀',
        state: 'COMPARING',
        pickCount: 2,
        vendors: VENDORS.filter((v) => v.category === 'hall').slice(0, 3),
      },
      {
        category: 'studio',
        categoryLabel: '스튜디오',
        state: 'SHORTLISTED',
        pickCount: 1,
        vendors: VENDORS.filter((v) => v.category === 'studio'),
      },
      {
        category: 'dress',
        categoryLabel: '드레스',
        state: 'NOT_STARTED',
        pickCount: 0,
        vendors: [],
      },
    ],
    remaining: 7,
    remainingCategories: ['hall', 'studio', 'dress', 'makeup', 'hair', 'goods', 'honeymoon'],
  },
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
        thumbnailUrl: 'https://example.com/expo-poster.jpg',
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
      { at: '2026-07-01T00:00:00.000Z', signups: 120, withdrawals: 8, total: 1200 },
      { at: '2026-08-01T00:00:00.000Z', signups: 150, withdrawals: 11, total: 1350 },
      { at: '2026-09-01T00:00:00.000Z', signups: 90, withdrawals: 6, total: 1440 },
    ],
    current: 1440,
  },
  'GET /v1/admin/briefing': {
    briefing: [
      { workflow: '결제인증', decider: 'rule', decisions: 312, failed: 0, costUsd: 0.28 },
      { workflow: '후기 검토', decider: 'model', decisions: 48, failed: 2, costUsd: 0.34 },
    ],
    budgetStatus: [],
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
        bodyImageKey: null,
        bodyImageUrl: null,
        status: 'draft',
        source: 'generated',
        model: 'gemini-3.5-flash-lite',
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
        bodyImageKey: null,
        bodyImageUrl: null,
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
        model: 'gemini-3.5-flash-lite',
        inputTokens: 512,
        outputTokens: 640,
        error: null,
        trigger: 'schedule',
      },
    ],
    remainingTopics: 16,
    nextSortOrder: 2,
    automation: {
      manualReady: true,
      scheduledEnabled: false,
    },
  },
  'GET /v1/admin/wedding-feed/taxonomy': {
    groups: [
      { id: '00000000-0000-4000-8000-0000000000a1', name: '준비 가이드', sortOrder: 0, active: true },
    ],
    categories: [
      {
        id: '00000000-0000-4000-8000-0000000000b1',
        name: '예산',
        groupId: '00000000-0000-4000-8000-0000000000a1',
        sortOrder: 0,
        active: true,
        postCount: 1,
      },
      {
        id: '00000000-0000-4000-8000-0000000000b2',
        name: '웨딩홀',
        groupId: '00000000-0000-4000-8000-0000000000a1',
        sortOrder: 1,
        active: true,
        postCount: 1,
      },
    ],
    ungrouped: [],
  },
  /* WP-ADM 박람회 관리(admin/expos.tsx) — 검수 대기 한 건 · 정상 한 건을 함께 둔다. */
  'GET /v1/admin/expos': {
    collection: {
      enabled: true,
      ready: true,
      lastRun: {
        status: 'success',
        startedAt: '2026-09-21T00:10:00.000Z',
        finishedAt: '2026-09-21T00:10:20.000Z',
        discovered: 2,
        created: 1,
        updated: 1,
        duplicates: 0,
        reviewRequired: 1,
        errorMessage: null,
      },
    },
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
        thumbnailUrl: null,
        thumbnailCandidateUrl: 'https://example.com/expo-review-poster.jpg',
        thumbnailSourceUrl: 'https://example.com/expo-review',
        thumbnailRights: null,
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
        thumbnailUrl: 'https://example.com/expo-poster.jpg',
        thumbnailCandidateUrl: null,
        thumbnailSourceUrl: 'https://example.com',
        thumbnailRights: 'OFFICIAL_PUBLIC',
        lastVerifiedAt: '2026-09-14',
      },
    ],
  },
  'POST /v1/admin/expos/collect': {
    runId: 'f4444444-4444-4444-8444-444444444444',
    skipped: false,
    discovered: 2,
    created: 1,
    updated: 1,
    duplicates: 0,
    reviewRequired: 1,
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
  'GET /v1/reviews/:reviewId/comments': {
    comments: VENDOR_REVIEWS[0].comments.items,
    nextCursor: null,
    count: VENDOR_REVIEWS[0].comments.count,
  },
  'GET /v1/vendors/:vendorId/reviews': {
    reviews: VENDOR_REVIEWS,
    nextCursor: null,
    usageScore: VENDOR_DETAIL.usageScore,
    caveat: '한 사람의 경험이에요. 업체를 고르는 유일한 기준으로 삼지 마세요.',
  },

  /*
   * ─── 관리자 콘솔 ──────────────────────────────────────────────────────────
   *
   * 위쪽에 이미 여덟(대시보드 · 일일 브리핑 · 광고 · 박람회 · 웨딩피드 · 관리자
   * 계정 · 회원 추이)이 있었다. 아래 일곱은 2026-09-16 관리자 화면 전수 조사에서
   * 더했다 — 그전까지 FAQ · 업체 · 이미지 · 제보 처리 · 개인정보 검토 · 정책 규칙 ·
   * 마케팅 발송을 찍으면 본문 자리에 「API … → 404」 한 줄만 나왔다. 껍데기는
   * 보이지만 본문은 한 번도 찍힌 적이 없었다는 뜻이다.
   *
   * 값은 **가명·가짜 수치**다(CLAUDE.md 「예시 데이터」). 천단위 쉼표가 실제로
   * 걸리는지 보려고 네 자리가 넘는 수를 일부러 섞어 뒀다.
   */
  'GET /v1/admin/faq': {
    items: [
      {
        id: '00000000-0000-4000-8000-00000000fa01',
        category: '예약',
        question: '예약은 언제부터 할 수 있나요?',
        answer: '예식일 12개월 전부터 예약할 수 있어요.',
        order: 0,
        published: true,
        editable: true,
      },
      {
        id: '00000000-0000-4000-8000-00000000fa02',
        category: '예약',
        question: '예약을 취소하면 어떻게 되나요?',
        answer: '취소 규정은 업체마다 달라요. 계약서를 확인해주세요.',
        order: 1,
        published: false,
        editable: true,
      },
      {
        id: '00000000-0000-4000-8000-00000000fa03',
        category: '제보',
        question: 'Pick 인증은 어떻게 하나요?',
        answer: '계약서나 결제 증빙을 올리면 돼요.',
        order: 0,
        published: true,
        editable: true,
      },
      {
        id: 'spec:price-basis',
        category: '코드에 있는 항목',
        question: '기준금액은 어떻게 정해지나요?',
        answer: '실 제보의 중앙값이에요.',
        order: 0,
        published: true,
        editable: false,
      },
    ],
    categories: ['예약', '제보', '코드에 있는 항목'],
  },
  'GET /v1/admin/marketing': {
    summary: { generated: 1284, simulated: 1180, failed: 104, failRate: 0.081 },
    items: [
      {
        id: '00000000-0000-4000-8000-0000000bb001',
        title: '9월 박람회 안내 소재',
        channel: '알림톡',
        status: 'failed',
        createdAt: '2026-09-15T02:10:00.000Z',
        simulatedAt: null,
        failReason: '템플릿 심사 대기',
      },
      {
        id: '00000000-0000-4000-8000-0000000bb002',
        title: '가을 스냅 기획 소재',
        channel: '푸시',
        status: 'queued',
        createdAt: '2026-09-15T05:40:00.000Z',
        simulatedAt: null,
        failReason: null,
      },
      {
        id: '00000000-0000-4000-8000-0000000bb003',
        title: '드레스 투어 안내 소재',
        channel: '푸시',
        status: 'simulated',
        createdAt: '2026-09-14T23:05:00.000Z',
        simulatedAt: '2026-09-15T01:00:00.000Z',
        failReason: null,
      },
    ],
  },
  'GET /v1/admin/data/images': {
    summary: { total: 12480, licensed: 11902, pending: 431, rejected: 147 },
    items: [
      {
        id: '00000000-0000-4000-8000-0000000cc001',
        vendorName: '강남 A 스튜디오',
        source: '업체 공식 채널',
        rightsStatus: 'pending',
        matchConfidence: 0.92,
        createdAt: '2026-09-15T04:00:00.000Z',
        url: null,
      },
      {
        id: '00000000-0000-4000-8000-0000000cc002',
        vendorName: '분당 C 웨딩홀',
        source: '크롤링',
        rightsStatus: 'pending',
        matchConfidence: 0.41,
        createdAt: '2026-09-15T04:20:00.000Z',
        url: null,
      },
    ],
  },
  'GET /v1/admin/vendors': {
    total: 3,
    vendors: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: '강남 A 웨딩홀',
        category: 'hall',
        status: 'active',
        dataCount: 1284,
        mergedInto: null,
        history: [],
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: '강남 B 웨딩홀',
        category: 'hall',
        status: 'suspended',
        dataCount: 96,
        mergedInto: null,
        history: [{ at: '2026-09-14T00:00:00.000Z', action: '정지', note: '제보 검증 중' }],
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: '분당 C 웨딩홀',
        category: 'hall',
        status: 'merged',
        dataCount: 0,
        mergedInto: '강남 A 웨딩홀',
        history: [],
      },
    ],
  },
  'GET /v1/admin/data/pipeline': {
    today: { received: 3120, autoProcessed: 2894, manualRequired: 182, failed: 44 },
    stages: [
      { stage: '수집', count: 3120, avgWaitMin: 1 },
      { stage: '판독', count: 2980, avgWaitMin: 4 },
      { stage: '대조', count: 2894, avgWaitMin: 7 },
    ],
    failedQueue: [
      {
        id: '00000000-0000-4000-8000-00000000dd01',
        stage: '판독',
        error: '증빙 이미지를 읽지 못했어요',
        failedAt: '2026-09-15T06:10:00.000Z',
        retryCount: 2,
      },
    ],
  },
  'GET /v1/admin/pii-reviews': {
    reviews: [
      {
        id: '00000000-0000-4000-8000-00000000pp01',
        createdAt: '2026-09-15T03:30:00.000Z',
        detectedKinds: ['휴대폰 번호'],
        hintCount: 1284,
      },
      {
        id: '00000000-0000-4000-8000-00000000pp02',
        createdAt: '2026-09-15T05:15:00.000Z',
        detectedKinds: ['이메일', '계좌번호'],
        hintCount: 12,
      },
    ],
  },
  /*
   * 문의(WP-ADM 「── 문의 ──」, 2026-09-23 관리자-프론트 연결 재검증에서 화면을
   * 새로 이었다). 「확인 필요」 한 건 + 「답변 완료」 한 건을 함께 둔다 — 두 가지
   * 상세 꼴(진행 중인 것에는 답변 입력창, 끝난 것에는 보낸 답변)이 다 찍혀야 한다.
   */
  'GET /v1/admin/inquiries': {
    inquiries: [
      {
        id: 'ii111111-1111-4111-8111-111111111111',
        category: 'planner_listing',
        status: 'received',
        receivedAt: '2026-09-22T04:10:00.000Z',
        subjectKind: 'planner',
        subjectId: 'pp111111-1111-4111-8111-111111111111',
      },
      {
        id: 'ii222222-2222-4222-8222-222222222222',
        category: 'data_correction',
        status: 'answered',
        receivedAt: '2026-09-20T01:00:00.000Z',
        subjectKind: null,
        subjectId: null,
      },
    ],
  },
  'GET /v1/admin/inquiries/:id': {
    id: 'ii111111-1111-4111-8111-111111111111',
    category: 'planner_listing',
    status: 'received',
    body: '저희 플래너를 검색에 올려주세요. 소속 업체 공식 홈페이지에 이름이 있어요.',
    contact: 'planner@example.com',
    receivedAt: '2026-09-22T04:10:00.000Z',
    subjectKind: 'planner',
    subjectId: 'pp111111-1111-4111-8111-111111111111',
    resolution: null,
    events: [],
  },
  /*
   * 회원 상세(360뷰, 2026-09-23 관리자-프론트 연결 재검증). 웨딩·Pick·후기·결제
   * 제보·업체 소유 확인·문의·리워드 각 칸에 한 건씩 채워 «표가 있다는 것»과
   * «실제로 그려진다는 것»을 함께 찍는다 — 위 「광고 자리」 규칙과 같은 이유다.
   */
  'GET /v1/admin/users/:id': {
    id: '99999999-9999-4999-8999-999999999999',
    displayName: '김웨딩',
    provider: 'kakao',
    email: 'wedding@example.com',
    nickname: '웨딩픽',
    createdAt: '2026-06-01T00:00:00.000Z',
    activatedAt: '2026-06-01T00:05:00.000Z',
    lastLoginAt: '2026-09-22T09:00:00.000Z',
    deletedAt: null,
    isOperator: false,
    withdrawal: null,
    weddings: [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        role: 'owner',
        weddingDate: '2027-04-17',
        createdAt: '2026-06-01T00:10:00.000Z',
      },
    ],
    candidateCount: 2,
    candidates: [
      {
        id: 'c1111111-1111-4111-8111-111111111111',
        vendorName: '강남 A 웨딩홀',
        category: 'hall',
        addedAt: '2026-08-01T00:00:00.000Z',
        addedByThisMember: true,
      },
    ],
    decisions: [{ category: 'hall', vendorName: '강남 A 웨딩홀', decidedAt: '2026-09-10T05:00:00.000Z' }],
    reviews: [
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        vendorName: '강남 E 스튜디오',
        overall: 5,
        status: 'published',
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ],
    paymentProofs: [
      {
        id: 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1',
        merchantName: '청담 E 웨딩홀',
        vendorName: '강남 A 웨딩홀',
        paidAmount: 10000000,
        paidAt: '2026-09-05T00:00:00.000Z',
      },
    ],
    vendorClaims: [],
    consultationCount: 2,
    inquiries: [
      {
        id: 'ii111111-1111-4111-8111-111111111111',
        category: 'data_correction',
        status: 'answered',
        receivedAt: '2026-09-20T01:00:00.000Z',
      },
    ],
    referral: { code: 'ABC123', invitedCount: 2, qualifiedCount: 1 },
    rewardGrants: [
      {
        id: 'g1111111-1111-4111-8111-111111111111',
        kind: 'referral',
        amountKrw: 300000,
        status: 'paid',
        createdAt: '2026-08-15T00:00:00.000Z',
      },
    ],
    rewardPayouts: [],
  },
  'GET /v1/admin/policy-engine': {
    policies: [
      {
        id: '00000000-0000-4000-8000-00000000po01',
        key: 'report.min_count',
        label: '금액 공개 최소 제보 수',
        description: '이 수보다 적으면 업체 안내가를 대신 보여줘요.',
        category: '제보',
        type: 'number',
        value: '3',
        defaultValue: '3',
        lastChangedAt: null,
        lastChangedBy: null,
        readOnlyReason: null,
      },
      {
        id: '00000000-0000-4000-8000-00000000po02',
        key: 'notify.daily_cap',
        label: '하루 알림 최대 건수',
        description: '한 사람에게 하루에 보낼 수 있는 알림 수예요.',
        category: '알림',
        type: 'number',
        value: '2',
        defaultValue: '2',
        lastChangedAt: '2026-09-12T02:00:00.000Z',
        lastChangedBy: '운영자',
        readOnlyReason: null,
      },
      {
        id: '00000000-0000-4000-8000-00000000po03',
        key: 'expo.auto_delete',
        label: '박람회 종료 자동 삭제',
        description: '대표님 지시로 보류 중이라 여기서 켤 수 없어요.',
        category: '박람회',
        type: 'boolean',
        value: 'false',
        defaultValue: 'false',
        lastChangedAt: null,
        lastChangedBy: null,
        readOnlyReason: '대표 지시로 보류 중이에요',
      },
    ],
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
