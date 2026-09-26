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
  /* 서버(domain disclosure.ts)는 상세 단계에서만 «· 기준금액 N만원»을 붙인다 — 정본 WP-VEND-001 · 007 금액 설명 줄. */
  caption: `실 제보 ${count}건 · 최근 12개월${median === undefined ? '' : ` · 기준금액 ${Math.round(median / 10_000)}만원`}`,
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
/**
 * 공개된 웨딩피드 넷. 관리자 fixture(`GET /v1/admin/wedding-feed`)의 «공개» 글과 같은
 * id · 카테고리 · 제목이다 — 관리자 표와 앱 목록을 나란히 찍었을 때 같은 글이어야 한다.
 * «드레스»는 스드메 칩, «일정»은 칩 없이 «전체»에서만 보이는 예다.
 */
const PUBLISHED_FEED = [
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
  {
    id: '00000000-0000-4000-8000-0000000000f3',
    categoryLabel: '드레스',
    title: '첫 피팅 전에 물어볼 여섯 가지',
    summary: '원하는 실루엣을 세 장만 정해 가면 빨라요.',
    imageUrl: null,
  },
  {
    id: '00000000-0000-4000-8000-0000000000f4',
    categoryLabel: '일정',
    title: '본식 4개월 전, 무엇부터 할까',
    summary: '웨딩홀부터 정하고 나머지를 차례로 잡아요.',
    imageUrl: null,
  },
];

/*
 * 칩은 글과 «같은 응답»으로 온다. 값은 domain `WEDDING_FEED_TABS` — 정본 my.js `cats`
 * 그대로다(2026-09-26 — 관리자 탭 표에서 읽던 값을 걷었다). 「전체」가 맨 앞이다.
 */
const WEDDING_FEED_TABS = [
  { key: 'all', label: '전체', categories: [] },
  { key: 'start', label: '웨딩홀', categories: ['웨딩홀'] },
  { key: 'sdm', label: '스드메', categories: ['스튜디오', '드레스', '메이크업', '헤어변형'] },
  { key: 'ceremony', label: '본식', categories: ['본식스냅'] },
  { key: 'goods', label: '예물 · 신혼', categories: ['허니문'] },
  { key: 'budget', label: '예산', categories: ['예산'] },
];

/**
 * 공개된 웨딩피드 목록 — 홈은 두 장(`HOME_FEED_PREVIEW_COUNT`), 라운지 「웨딩정보」는 전부
 * (`WEDDING_FEED_LOUNGE_LIMIT`)를 묻는다. 서버처럼 `limit`을 지키고, 없으면 여덟이다.
 *
 * **함수에 `items` · `tabs`를 그대로 붙여 둔다.** 다른 스위치가 `{ ...routes[...], items }`로
 * 목록만 덮어도 칩 줄(`tabs`)이 따라가게 — 함수만 두면 펼칠 칸이 없어 `tabs`가 빠지고,
 * 계약 검사에 걸려 화면이 「연결이 불안정해요」로 찍힌다.
 */
const weddingFeedList = Object.assign(
  ({ url }) => {
    const limit = Number(url.searchParams.get('limit'));

    return {
      items: PUBLISHED_FEED.slice(0, Number.isFinite(limit) && limit > 0 ? limit : 8),
      tabs: WEDDING_FEED_TABS,
    };
  },
  { items: PUBLISHED_FEED, tabs: WEDDING_FEED_TABS }
);

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
  /* 온보딩 완료(WP-AUTH-007 «웨딩픽 시작하기») — 저장 → 홈 골격 한 장(`features/home/home-handoff`)을 찍는다. */
  'POST /v1/me/setup': () => ({ ...ME, setupComplete: true }),
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
  /**
   * 공개된 웨딩피드 — 홈은 두 장(`HOME_FEED_PREVIEW_COUNT`), 라운지 「웨딩정보」는 전부
   * (`WEDDING_FEED_LOUNGE_LIMIT`)를 묻는다. 서버처럼 `limit`을 지키고, 없으면 여덟이다.
   * 글은 아래 관리자 fixture의 «공개» 넷과 같은 줄이다 — 관리자와 앱이 같은 글을 본다.
   */
  'GET /v1/wedding-feed': weddingFeedList,

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
    /* 관리자 fixture의 같은 글(f1)과 같은 공개일이다 — 관리자 «공개일» 칸과 앱 상세 날짜가 같게 찍힌다. */
    publishedAt: '2026-09-11T00:00:00.000Z',
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
   * 예식일 예보 · 공휴일(0437) — D-day 카드와 일정 등록 날짜 칸 아래 한 줄을 찍으려고 값을
   * 채운다. 공휴일은 기간을 가리지 않고 두 달 치를 준다 — 화면이 보고 있는 달 것만 고른다.
   */
  'GET /v1/weddings/:weddingId/forecast': {
    forecast: { date: '2027-04-17', rainProbability: 30, tempMin: 12, tempMax: 21 },
  },
  'GET /v1/public-holidays': {
    holidays: [
      { date: '2026-09-24', name: '추석 연휴' },
      { date: '2026-09-25', name: '추석' },
      { date: '2026-09-26', name: '추석 연휴' },
      { date: '2026-10-03', name: '개천절' },
      { date: '2026-10-09', name: '한글날' },
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
  /** 정본 my.jsx frame-006 «내가 쓴 후기» — 쓴 후기 둘 · 쓸 수 있는 곳 둘. */
  'GET /v1/me/reports': {
    reports: [
      { id: '00000000-0000-4000-8000-000000000001', kind: 'review', kindLabel: '후기', use: '후기', subject: '강남 A 스튜디오', vendorId: '00000000-0000-4000-8000-0000000000a1', amount: null, reportedAt: '2026-09-02T03:00:00.000Z', inUse: true, needsCheck: false, note: null },
      { id: '00000000-0000-4000-8000-000000000002', kind: 'review', kindLabel: '후기', use: '후기', subject: '더채플 강남', vendorId: '00000000-0000-4000-8000-0000000000a2', amount: null, reportedAt: '2026-03-12T03:00:00.000Z', inUse: true, needsCheck: false, note: null },
      { id: '00000000-0000-4000-8000-000000000003', kind: 'payment_proof', kindLabel: 'Pick 인증', use: '실 제보', subject: '라비드레스', vendorId: '00000000-0000-4000-8000-0000000000a3', amount: 1_120_000, reportedAt: '2026-03-04T03:00:00.000Z', inUse: true, needsCheck: false, note: null },
      { id: '00000000-0000-4000-8000-000000000004', kind: 'payment_proof', kindLabel: 'Pick 인증', use: '실 제보', subject: '청담 헤메', vendorId: '00000000-0000-4000-8000-0000000000a4', amount: 980_000, reportedAt: '2026-04-02T03:00:00.000Z', inUse: true, needsCheck: false, note: null },
    ],
  },
  /* MY 「문의하기」 꼬리 · 라운지 — 문의가 없는 상태가 기본이다. */
  /** 정본 my.jsx frame-007 «지난 문의 1건» — 답변 완료 한 건. */
  'GET /v1/inquiries': {
    inquiries: [
      {
        id: '00000000-0000-4000-8000-0000000000c1',
        category: 'other',
        body: 'Pick 인증이 안 됐어요',
        status: 'answered',
        subject: null,
        receivedAt: '2026-08-12T03:00:00.000Z',
        decidedAt: '2026-08-13T03:00:00.000Z',
        resolution: null,
        evidenceUrl: null,
      },
    ],
  },
  /** 지난 문의 상세(`/my/contact/[inquiryId]`) — 답변이 달린 한 건. 정본 프레임 없음. */
  'GET /v1/inquiries/:inquiryId': {
    id: '00000000-0000-4000-8000-0000000000c1',
    category: 'other',
    body: 'Pick 인증이 안 됐어요',
    status: 'answered',
    subject: null,
    receivedAt: '2026-08-12T03:00:00.000Z',
    decidedAt: '2026-08-13T03:00:00.000Z',
    resolution: '확인해 보니 사진이 흐려서 금액을 읽지 못했어요. 다시 올려 주시면 바로 확인할게요.',
    evidenceUrl: null,
  },
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
  /*
   * 예산 추가 «자동 등록(Pick 인증)»(2026-09-26) — 원본 자리 · 한 장 올리기 · 등록 · 동의.
   * 캡처가 카메라 입력에 사진을 넣으면(`--file`) 이 셋을 차례로 부른다. 기본은 서버가 읽은 경우
   * (`accepted`)이고 `FIXTURE_PROOF_PENDING=true`면 못 읽은 경우(`pending_review`)다 — 아래 스위치.
   */
  'POST /v1/documents/uploads': {
    rawDocumentId: 'd1111111-1111-4111-8111-111111111111',
    uploads: [
      {
        pageIndex: 0,
        uploadUrl: 'https://upload.example.invalid/d1111111/1.jpg',
        uploadPath: '/v1/documents/d1111111-1111-4111-8111-111111111111/pages/0',
        storageKey: 'u1111111/d1111111/1.jpg',
        expiresAt: '2026-09-26T01:00:00.000Z',
      },
    ],
  },
  /* 응답 본문이 없다(204 · z.null()). */
  'PUT /v1/documents/:rawDocumentId/pages/:pageIndex': null,
  /*
   * 상담 녹음 올리기(2026-09-26 «녹음 파일을 올려주세요»가 OS 파일 선택기를 바로 연다) — 자리 받기 ·
   * 같은 출처 경로(`uploadPath`)로 본문 올리기(`PUT …/audio`가 도착까지 적어 기록을 돌려준다 — 아래).
   * `uploadUrl`은 옛 앱용 서명 주소라 앱이 부르지 않는다.
   */
  'POST /v1/consultations/uploads': {
    consultationId: 'c9999999-9999-4999-8999-999999999999',
    uploadUrl: 'https://upload.example.invalid/consultations/c9999999-9999-4999-8999-999999999999.m4a',
    uploadPath: '/v1/consultations/c9999999-9999-4999-8999-999999999999/audio',
    storageKey: 'u1111111/consultations/c9999999.m4a',
    expiresAt: '2026-09-26T01:00:00.000Z',
  },
  'POST /v1/payment-proofs': {
    paymentProofId: 'd2222222-2222-4222-8222-222222222222',
    status: 'accepted',
    pendingFields: [],
    reviewNote: null,
    merchantName: '청담 E 웨딩홀',
    paidAmount: 5000000,
    paidAt: '2026-09-20T05:00:00.000Z',
    method: 'card',
    maskedIdentifiers: ['card_number'],
    matchedVendorId: null,
    unmatchedNote: null,
    deepData: false,
    originalDeletedBy: '2026-09-27T05:00:00.000Z',
  },
  'GET /v1/me/withdrawal': {
    lead: '배우자와 함께 만든 기록도 함께 사라져요',
    hasPartner: true,
    /* 정본 my.jsx frame-014 delNow · delKeep. */
    deleted: [
      { label: '계정 · 프로필', value: '이메일 · 로그인 정보' },
      { label: '배우자 연결', value: '1건' },
      { label: 'Pick · 스타일', value: '2건' },
      { label: '일정 · 지출 · 메모', value: '12건' },
    ],
    separated: [
      { label: '실 제보 금액', note: '이름을 지우고 금액만 남아요', anonymous: true },
      { label: '내가 쓴 후기', note: '작성자를 지우고 글만 남아요', anonymous: true },
      { label: '신고 · 분쟁 기록', note: '법령상 보존 항목이에요', anonymous: false },
    ],
    done: ['계정이 삭제됐어요', '로그인 정보가 지워졌어요'],
  },
  'GET /v1/weddings/:weddingId/invites': { invite: null },
  /* 배우자 초대 코드 — 4자리 숫자(2026-09-26 · 그 전 6자리). */
  'POST /v1/weddings/:weddingId/invites': {
    inviteId: '00000000-0000-4000-8000-00000000c0de',
    code: '4829',
    expiresAt: '2026-09-28T09:00:00.000Z',
    shared: ['정리된 가격·조건 내용'],
    notShared: ['원본 문서 파일 자체 — 올린 사람만 가져요'],
  },
  /* 관리자 링크 미리보기(앱용 벌) — 세 벌 중 첫 칸. */
  'GET /v1/admin/site-meta': {
    kind: 'app',
    effective: {
      ogTitle: '웨딩픽 — 플래너 없이, 직접 고르는 웨딩 준비',
      ogDescription: '실 제보 금액과 조건을 보고 직접 골라요',
      ogImageUrl: null,
      ogImageAlt: '웨딩픽',
    },
    defaults: {
      ogTitle: '웨딩픽 — 플래너 없이, 직접 고르는 웨딩 준비',
      ogDescription: '실 제보 금액과 조건을 보고 직접 골라요',
      ogImageUrl: null,
      ogImageAlt: '웨딩픽',
    },
    overrides: { ogTitle: null, ogDescription: null, ogImageUrl: null, ogImageAlt: null },
    updatedAt: null,
    publishRequestedAt: null,
    liveOgTitle: null,
    ogImageSource: 'default',
  },
  /*
   * Pick 추천 — 홈 아코디언과 「웨딩픽 추천」 전체 페이지가 같이 쓴다. 상태를 셋 다 다르게
   * 둬서 캡처 한 장에 «비교» · «보기» · «추천»이 같이 보이게 한다. `limit`은 무시한다 —
   * 캡처에서는 홈도 전체 페이지도 같은 셋을 그린다.
   */
  /** Pick 묶음별 «내 조건에 맞는 곳»(2026-09-25) — 웨딩홀 넷 · 스튜디오 하나, 나머지 묶음은 비었다. */
  'GET /v1/me/pick-recommendations': {
    groups: [
      { key: 'start', vendors: VENDORS.filter((v) => v.category === 'hall').slice(0, 5) },
      { key: 'sdm', vendors: VENDORS.filter((v) => v.category === 'studio').slice(0, 5) },
      { key: 'ceremony', vendors: [] },
      { key: 'goods', vendors: [] },
    ],
  },
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
      /* 정본 my.jsx frame-012 — 다가오는 둘 · 끝난 하나. */
      {
        id: 'e2222222-2222-4222-8222-222222222222',
        title: '더현대 서울 웨딩위크',
        organizer: '더현대 서울',
        startsAt: '2026-10-03T01:00:00.000Z',
        endsAt: '2026-10-04T09:00:00.000Z',
        venue: '더현대 서울 6층',
        region: '서울',
        status: 'upcoming',
        isDeadlineSoon: false,
        sourceNote: '주최사 공지 기준',
        thumbnailUrl: null,
        lastVerifiedAt: '2026-09-10T00:00:00.000Z',
      },
      {
        id: 'e3333333-3333-4333-8333-333333333333',
        title: '강남 웨딩박람회',
        organizer: '세텍',
        startsAt: '2026-08-29T01:00:00.000Z',
        endsAt: '2026-08-30T09:00:00.000Z',
        venue: '세텍',
        region: '서울',
        status: 'closed',
        isDeadlineSoon: false,
        sourceNote: '주최사 공지 기준',
        thumbnailUrl: null,
        lastVerifiedAt: '2026-09-10T00:00:00.000Z',
      },
    ],
    nextCursor: null,
  },
  /* 정본 my.jsx frame-013 박람회 상세 — 목록 첫 박람회. */
  'GET /v1/expos/:expoId': {
    id: 'e1111111-1111-4111-8111-111111111111',
    title: '2026 가을 웨딩 박람회',
    organizer: '더 웨딩페어',
    startsAt: '2026-09-26T01:00:00.000Z',
    endsAt: '2026-09-27T09:00:00.000Z',
    venue: '코엑스 D홀',
    region: '서울',
    status: 'upcoming',
    isDeadlineSoon: true,
    sourceNote: '주최사 공지 기준',
    thumbnailUrl: null,
    lastVerifiedAt: '2026-09-10T00:00:00.000Z',
    address: '서울 강남구 영동대로 513',
    registrationDeadline: '2026-09-24',
    benefits: ['웨딩홀 · 스드메 상담 부스', '드레스 쇼케이스 14:00', '사전등록 사은품'],
    description: '',
    notifyEnabled: false,
    applyUrl: 'https://example.com/expo-apply',
    officialWebsiteUrl: null,
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
  /*
   * 구간마다 칸 수가 서버(`apps/api/src/dashboard-admin.ts` `BUCKET_SPAN`)와 같아야
   * 한다. 예전에는 무엇을 물어도 월 3칸을 돌려줘서, 기본 구간인 「일」 14칸이
   * 1280 폭에서 카드 밖으로 밀리는 것을 캡처가 한 번도 못 봤다(2026-09-26 감사 4번).
   */
  'GET /v1/admin/members-trend': ({ url }) => {
    if (url.searchParams.get('bucket') === 'day') {
      const signups = [18, 22, 15, 30, 27, 12, 9, 24, 31, 19, 26, 21, 14, 11];
      const withdrawals = [1, 0, 2, 1, 0, 3, 1, 0, 2, 1, 1, 0, 2, 1];
      let total = 1440 - signups.reduce((sum, n, i) => sum + n - withdrawals[i], 0);
      return {
        bucket: 'day',
        points: signups.map((n, i) => {
          total += n - withdrawals[i];
          /* KST 자정 = 전날 15:00Z. 2026-09-13 ~ 2026-09-26 KST. */
          const at = new Date(Date.UTC(2026, 8, 12 + i, 15)).toISOString();
          return { at, signups: n, withdrawals: withdrawals[i], total };
        }),
        current: 1440,
      };
    }

    return {
      bucket: 'month',
      points: [
        { at: '2026-07-01T00:00:00.000Z', signups: 120, withdrawals: 8, total: 1200 },
        { at: '2026-08-01T00:00:00.000Z', signups: 150, withdrawals: 11, total: 1350 },
        { at: '2026-09-01T00:00:00.000Z', signups: 90, withdrawals: 6, total: 1440 },
      ],
      current: 1440,
    };
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
  /**
   * 관리자 — 웨딩피드. 공개 넷은 앱 fixture(`PUBLISHED_FEED`)와 같은 글이고, 검토 대기
   * 초안 하나 · 목록 밖 옛 이름(«준비 순서» — 0442 전 값)으로 내린 글 하나를 더 둔다.
   */
  'GET /v1/admin/wedding-feed': {
    posts: [
      ...PUBLISHED_FEED.map((item, index) => ({
        id: item.id,
        categoryLabel: item.categoryLabel,
        title: item.title,
        summary: item.summary,
        body: `${item.summary}\n\n본문`,
        imageKey: null,
        imageUrl: null,
        bodyImageKey: null,
        bodyImageUrl: null,
        status: 'published',
        source: 'manual',
        model: null,
        topic: null,
        sortOrder: index + 1,
        publishedAt: `2026-09-1${index + 1}T00:00:00.000Z`,
        createdAt: `2026-09-1${index + 1}T00:00:00.000Z`,
        updatedAt: `2026-09-1${index + 1}T00:00:00.000Z`,
      })),
      {
        id: '00000000-0000-4000-8000-0000000000f5',
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
        sortOrder: 5,
        publishedAt: null,
        createdAt: '2026-09-15T01:00:00.000Z',
        updatedAt: '2026-09-15T01:00:00.000Z',
      },
      {
        id: '00000000-0000-4000-8000-0000000000f6',
        categoryLabel: '준비 순서',
        title: '무엇부터 정하는 것이 좋은가',
        summary: '예식일에서 거꾸로 세어 봐요.',
        body: '예식일에서 거꾸로…',
        imageKey: null,
        imageUrl: null,
        bodyImageKey: null,
        bodyImageUrl: null,
        status: 'archived',
        source: 'manual',
        model: null,
        topic: null,
        sortOrder: 6,
        publishedAt: null,
        createdAt: '2026-09-10T01:00:00.000Z',
        updatedAt: '2026-09-10T01:00:00.000Z',
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
    nextSortOrder: 7,
    automation: {
      manualReady: true,
      scheduledEnabled: false,
    },
  },
  /*
   * 관리자 웨딩피드 「자동 작성」(2026-09-26 대표 지시 — 누르면 글과 이미지를 한 번에).
   * 글 → 대표 썸네일 → 본문 이미지 순서로 부른다. 그림은 **가짜 자리 표시**다(색 판) —
   * 실제 Gemini 그림이 아니다. 캡처에서 「두 칸이 채워졌다」만 본다.
   */
  'POST /v1/admin/wedding-feed/draft': {
    title: '웨딩홀 조명 리허설에서 볼 것',
    summary: '입장 동선과 단상 조명의 밝기를 먼저 확인해요.',
    body: '예식 전 리허설에서는 입장 동선의 조명을 먼저 봐요. 문이 열릴 때 빛이 어디서 오는지 확인해요.\n\n단상 조명은 사진에 그대로 남아요. 본식스냅 작가와 함께 밝기를 맞춰 보세요.\n\n하객석 조명이 너무 어두우면 식사 시간이 길게 느껴져요. 연회 조명 순서도 같이 확인해보세요.',
  },
  'POST /v1/admin/wedding-feed/image/generate': (() => {
    /* 4×3 PNG를 늘려 그린다 — 색이 번진 판이 두 칸에 채워지는지만 본다. */
    const images = [
      {
        storageKey: 'wedding-feed/thumbnail/capture.png',
        imageUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAMklEQVR4nAEnANj/AC46WXhabsmOa/bXpwEoM05CHBNHLv0nQDUC+/n28fXz6O/z4+bsSDQUpb5aq6IAAAAASUVORK5CYII=',
      },
      {
        storageKey: 'wedding-feed/body/capture.png',
        imageUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAKklEQVR4nGO48+LSlrOr6hdV/fr1lXHL2VWnr16ojqh+9O4uE5x14+kNAAvoGt9cetPWAAAAAElFTkSuQmCC',
      },
    ];
    let next = 0;
    return () => images[next++ % images.length];
  })(),
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
  /*
   * 승인된 실사진 8장 — 정본 WP-VEND-001 «1 / 8» · 포트폴리오 · WP-VEND-006 전체보기와 같은 수.
   * 주소는 캡처가 바깥으로 나가지 않으므로 열리지 않는다(정본 미리보기도 사진 칸이 비어 찍힌다).
   */
  'GET /v1/vendors/:vendorId/images': {
    photos: Array.from({ length: 8 }, (_, i) => ({
      id: `9a000000-0000-4000-8000-00000000000${i + 1}`,
      url: `https://images.weddingpick.invalid/vendor-${i + 1}.jpg`,
      isRepresentative: i === 0,
      useContain: false,
      sourceNote: null,
      verifiedAt: '2026-08-12T00:00:00.000Z',
    })),
  },
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
  /*
   * 로그인한 관리자의 등급(2026-09-25 뷰어 조회 전용). 뷰어 화면을 찍을 때는
   * `CAPTURE_ADMIN_ROLE=viewer`로 띄운다 — 기본은 운영자다.
   */
  'GET /v1/admin/me': () => ({ role: process.env.CAPTURE_ADMIN_ROLE || 'operator' }),
  'GET /v1/admin/vendors': {
    total: 3,
    vendors: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: '강남 A 웨딩홀',
        category: 'hall',
        region: '서울',
        address: '서울 강남구 테헤란로 1',
        status: 'active',
        dataCount: 1284,
        mergedInto: null,
        history: [],
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: '강남 B 웨딩홀',
        category: 'hall',
        region: '서울',
        address: null,
        status: 'suspended',
        dataCount: 96,
        mergedInto: null,
        history: [{ at: '2026-09-14T00:00:00.000Z', action: '정지', note: '제보 검증 중' }],
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: '분당 C 웨딩홀',
        category: 'hall',
        region: '경기',
        address: null,
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
   * 계정·권한 → 앱 회원 목록(`apps/api/src/routes/admin.ts` `GET /v1/admin/users`).
   * 뷰어에게는 관리자 계정 탭 대신 이 목록만 보인다(2026-09-25 대표 지시) — 그 화면을
   * 찍으려면 본문이 «불러오기 실패»가 아니어야 한다. 탈퇴 대기 한 줄을 섞어 상태 칸도 찍는다.
   */
  'GET /v1/admin/users': {
    users: [
      {
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
        pickVerified: true,
        withdrawal: null,
      },
      {
        id: '88888888-8888-4888-8888-888888888888',
        displayName: '이신부',
        provider: 'kakao',
        email: 'bride@example.com',
        nickname: '봄신부',
        createdAt: '2026-07-14T00:00:00.000Z',
        activatedAt: '2026-07-14T00:03:00.000Z',
        lastLoginAt: '2026-09-20T11:30:00.000Z',
        deletedAt: null,
        isOperator: false,
        pickVerified: false,
        withdrawal: null,
      },
      {
        id: '77777777-7777-4777-8777-777777777777',
        displayName: '박예비',
        provider: 'kakao',
        email: null,
        nickname: '예비신랑',
        createdAt: '2026-08-02T00:00:00.000Z',
        activatedAt: null,
        lastLoginAt: '2026-08-02T00:00:00.000Z',
        deletedAt: null,
        isOperator: false,
        pickVerified: false,
        withdrawal: null,
      },
    ],
    total: 3,
    hasMore: false,
    nextCursor: null,
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

/*
 * 웨딩노트 캡처 전용 스위치(2026-09-24 RN 정본 note 대조). 기본 fixture는 건드리지 않고
 * 켤 때만 덮는다 — 계약 시험(capture-fixtures)은 스위치 없이 돈다.
 *
 *   FIXTURE_NOTE_EMPTY=true  WP-EMPTY-NOTE(웨딩노트 · 처음): 예식일 없음 + 일정 · 상담 · 지출 0
 *   FIXTURE_NOTE_DATA=true   WP-OUR-003 예약현황 · WP-CPL-005 변경내역에 줄이 보이게 채운다
 */
if (process.env.FIXTURE_NOTE_EMPTY === 'true') {
  const me = routes['GET /v1/me'];
  routes['GET /v1/me'] = () => ({ ...me(), weddingDate: null });
  routes['GET /v1/weddings/:weddingId/events'] = { events: [] };
  routes['GET /v1/weddings/:weddingId/consultations'] = { records: [] };
  routes['GET /v1/weddings/:weddingId/expenses'] = {
    ...routes['GET /v1/weddings/:weddingId/expenses'],
    paidTotal: 0,
    buckets: [],
    budget: { set: true, budget: 17500000, spent: 0, remaining: 17500000, over: false },
    expenses: [],
  };
}

if (process.env.FIXTURE_NOTE_DATA === 'true') {
  /*
   * 웨딩일정(WP-NOTE-001) — 정본 `note.js` `tlGroups`와 같은 모양: 지난 일정 2건 · 이번 주 2건
   * (하나는 메모 한 줄) · 다음 주 1건 · 그 뒤 1건. 날짜는 오늘 기준 상대값이다.
   */
  {
    const today = new Date();
    const at = (dayOffset, hour) =>
      new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset, hour, 0, 0).toISOString();
    const event = (id, title, startsAt, status, memo = null) => ({
      id, title, startsAt, location: null, vendorId: null, vendorLabel: null, memo,
      notifyEnabled: true, source: 'manual', status,
    });
    const toSunday = (7 - today.getDay()) % 7;
    routes['GET /v1/weddings/:weddingId/events'] = {
      events: [
        event('81111111-1111-4111-8111-111111111111', '웨딩홀 투어 예약', at(-6, 11), 'done'),
        event('82222222-2222-4222-8222-222222222222', '상견례 장소 알아보기', at(-3, 15), 'done'),
        event('83333333-3333-4333-8333-333333333333', '강남 A 스튜디오 상담', at(Math.min(1, toSunday), 15), 'upcoming'),
        event('84444444-4444-4444-8444-444444444444', '청담 E 웨딩홀 투어', at(toSunday, 11), 'upcoming', '가족 2명 같이 가요'),
        event('85555555-5555-4555-8555-555555555555', '드레스 투어 3곳 예약하기', at(toSunday + 3, 10), 'upcoming'),
        event('86666666-6666-4666-8666-666666666666', '웨딩홀 계약금 입금', at(toSunday + 10, 10), 'upcoming', '예산현황에 지출로 들어가요'),
      ],
    };
  }
  const hall = '11111111-1111-4111-8111-111111111111';
  const studio = '12121212-1212-4212-8212-121212121212';
  const expenses = { paidTotal: 0, paidCount: 0, scheduledTotal: 0, scheduledCount: 0 };
  routes['GET /v1/weddings/:weddingId/decisions'] = {
    decisions: [
      {
        category: 'hall',
        categoryLabel: '웨딩홀',
        vendor: { id: hall, name: '청담 E 웨딩홀', region: '서울 강남구' },
        decidedAt: '2026-08-20T05:00:00.000Z',
        decidedByPartner: false,
        events: [],
        expenses: { bucket: 'hall', bucketLabel: '웨딩홀', ...expenses },
      },
      {
        category: 'studio',
        categoryLabel: '스튜디오',
        vendor: { id: studio, name: '강남 A 스튜디오', region: '서울 강남구' },
        decidedAt: '2026-09-08T05:00:00.000Z',
        decidedByPartner: true,
        events: [],
        expenses: { bucket: 'sdm', bucketLabel: '스드메', ...expenses },
      },
    ],
  };
  const note = (id, vendorId, vendorLabel, body, updatedAt) => ({
    id, vendorId, vendorLabel, body, authoredByPartner: false, edited: false, editedByPartner: null,
    createdAt: updatedAt, updatedAt, version: 1,
  });
  routes['GET /v1/weddings/:weddingId/notes'] = {
    notes: [
      note('51111111-1111-4111-8111-111111111111', hall, '청담 E 웨딩홀', '주차는 발렛만 가능. 하객 100명 넘으면 추가요금 있음 — 계약서 3조 확인.', '2026-09-05T03:00:00.000Z'),
    ],
  };
  const notice = (id, title, createdAt) => ({
    id, kind: 'verification', kindLabel: '자료 확인', title, body: title, targetId: null, createdAt, readAt: null,
  });
  routes['GET /v1/me/notifications'] = {
    notifications: [
      notice('61111111-1111-4111-8111-111111111111', '웨딩홀을 청담 E 웨딩홀로 결정', '2026-09-20T05:02:00.000Z'),
      notice('62222222-2222-4222-8222-222222222222', '예산을 1,750만원으로 수정', '2026-09-18T00:40:00.000Z'),
    ],
    unread: 2,
    total: 2,
  };
}

/*
 * Pick 캡처 전용 스위치(2026-09-25 RN 정본 pick 픽셀 대조). 정본 pick.js `catGroups`와
 * 같은 이름·지역·결정 상태로 채운다 — 이름이 다르면 없는 차이가 픽셀로 잡힌다.
 *
 *   FIXTURE_PICK_CANON=true  WP-PICK-001 · 008: 웨딩홀 2(더채플 결정) · 스드메 3(블루밍 결정) · 본식 1
 */
if (process.env.FIXTURE_PICK_CANON === 'true') {
  const cand = (n, vendorName, category, region, addedAt) => ({
    id: `c${n.repeat(7)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`,
    vendorId: `${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`,
    vendorName, category, region, imageUrl: null, note: null, addedAt, addedByPartner: false, rating: null,
  });
  const hall = [
    cand('1', '더채플 청담', 'hall', '서울 강남구', '2026-09-02T00:00:00.000Z'),
    cand('2', '루이비스스퀘어', 'hall', '서울 송파구', '2026-09-01T00:00:00.000Z'),
  ];
  const studio = [
    cand('3', '블루밍 스튜디오', 'studio', '서울 강남구', '2026-09-05T00:00:00.000Z'),
    cand('4', '스튜디오 온', 'studio', '서울 마포구', '2026-09-04T00:00:00.000Z'),
    cand('5', '포레스트 스튜디오', 'studio', '서울 성수동', '2026-09-03T00:00:00.000Z'),
  ];
  const snap = [cand('6', '오드 메이크업', 'snap', '서울 청담동', '2026-09-06T00:00:00.000Z')];
  const group = (category, categoryLabel, candidates, decidedVendorId) => ({
    category, categoryLabel, candidates,
    comparable: candidates.length >= 2,
    state: decidedVendorId ? 'decided' : 'picking',
    stateLabel: decidedVendorId ? '결정 완료' : '후보 Pick 중',
    decidedVendorId,
  });
  routes['GET /v1/weddings/:weddingId/candidates'] = {
    ...routes['GET /v1/weddings/:weddingId/candidates'],
    groups: [
      group('hall', '웨딩홀', hall, hall[0].vendorId),
      group('studio', '스튜디오', studio, studio[0].vendorId),
      group('snap', '본식스냅', snap, null),
    ],
    total: 6,
  };
}

/*
 * common 캡처 전용 스위치(2026-09-25 RN 정본 common 대조). 켤 때만 덮는다.
 *
 *   FIXTURE_PICK_EMPTY=true  WP-EMPTY-PICK(Pick · 처음): 담은 곳 0
 */
if (process.env.FIXTURE_PICK_EMPTY === 'true') {
  routes['GET /v1/weddings/:weddingId/candidates'] = {
    ...routes['GET /v1/weddings/:weddingId/candidates'],
    groups: [],
    total: 0,
  };
}

/*
 * 홈 「웨딩 준비 팁」 준비 단계 캡처 스위치(2026-09-26 대표 오더 「준비단계에 맞춰 콘텐츠를
 * 추천한다」). 켤 때만 덮는다.
 *
 *   FIXTURE_DAYS_LEFT=120              예식일을 오늘(기기 날짜)에서 N일 뒤로 — 히어로 D-day
 *   FIXTURE_PREPARED=hall              준비 현황에서 «이미 정했다»고 고른 업종(쉼표로 여럿)
 *   FIXTURE_WEDDING_FEED_FILE=<경로>   웨딩피드 목록의 글(`items`)을 이 JSON 배열로 덮는다
 *
 * **단계 순서는 가짜 서버가 흉내 내지 않는다.** 순서를 매기는 것은 서버(domain
 * `preparationStage` · `rankFeedForStage`)이고, 여기서 그 규칙을 다시 적으면 규칙이 두 벌이
 * 된다. 캡처할 때는 domain 함수로 만든 결과를 파일로 넘긴다.
 */
if (process.env.FIXTURE_DAYS_LEFT !== undefined || process.env.FIXTURE_PREPARED !== undefined) {
  const patch = {};

  if (process.env.FIXTURE_DAYS_LEFT !== undefined) {
    const today = new Date();
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + Number(process.env.FIXTURE_DAYS_LEFT));
    const pad = (value) => String(value).padStart(2, '0');

    patch.weddingDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  if (process.env.FIXTURE_PREPARED !== undefined) {
    patch.preparedCategories = process.env.FIXTURE_PREPARED.split(',').filter(Boolean);
  }

  const me = routes['GET /v1/me'];
  routes['GET /v1/me'] = () => ({ ...me(), ...patch });
  routes['GET /v1/app/bootstrap'] = {
    ...routes['GET /v1/app/bootstrap'],
    member: { ...routes['GET /v1/app/bootstrap'].member, ...patch },
  };
}

if (process.env.FIXTURE_WEDDING_FEED_FILE) {
  const items = JSON.parse(require('fs').readFileSync(process.env.FIXTURE_WEDDING_FEED_FILE, 'utf8'));

  routes['GET /v1/wedding-feed'] = { ...routes['GET /v1/wedding-feed'], items };
}

/*
 * 온보딩 «완료» → Pick 담은 곳(2026-09-26 준비 현황 업체 검색 시트). 서버는
 * `POST /v1/me/setup`의 `preparedVendorIds`를 같은 트랜잭션에서 `vendor_candidates`에
 * 담는다 — 캡처도 그 흐름을 따라가게 **이 한 번의 실행 안에서만** 기억한다.
 *
 * 온보딩을 끝내기 전에는 아무것도 바꾸지 않는다(기존 캡처는 그대로다). 끝낸 뒤에는
 * `GET /v1/me`가 설정 완료를 돌려주고(`FIXTURE_SETUP_COMPLETE=false`로 시작해도 홈으로
 * 넘어간다), Pick 담은 곳은 방금 보낸 업체만 보여준다 — 막 가입한 사람의 Pick이다.
 */
const onboarded = { done: false, weddingDate: null, region: null, preparedCategories: [], vendorIds: [], manual: [] };

/* 직접 입력한 카드(묶음)의 결정이 들어가는 업종 — 서버 `manualDecisionCategory`와 같다(묶음의 첫 업종). */
const GROUP_FIRST_CATEGORY = { start: 'hall', sdm: 'studio', ceremony: 'snap', goods: 'goods' };
const CATEGORY_LABEL = { hall: '웨딩홀', studio: '스튜디오', snap: '본식스냅', goods: '예물' };

routes['POST /v1/me/setup'] = ({ body } = {}) => {
  onboarded.done = true;
  onboarded.weddingDate = body?.weddingDate ?? null;
  onboarded.region = body?.region ?? null;
  onboarded.preparedCategories = Array.isArray(body?.preparedCategories) ? body.preparedCategories : [];
  onboarded.vendorIds = Array.isArray(body?.preparedVendorIds) ? body.preparedVendorIds : [];
  onboarded.manual = Array.isArray(body?.preparedManualVendors) ? body.preparedManualVendors : [];

  return {
    ...ME,
    weddingDate: body?.weddingDate ?? null,
    region: body?.region ?? null,
    preparedCategories: onboarded.preparedCategories,
    styleTags: body?.styleTags ?? ME.styleTags,
    setupComplete: true,
    hasPick: onboarded.vendorIds.length > 0,
  };
};

/*
 * 온보딩 뒤의 후보 목록 — 서버처럼 고른 업체는 담기 + 그 업종의 결정, 직접 입력은 결정만
 * (`manualDecisions`). 온보딩 전에는 원래 fixture 그대로다.
 */
function onboardedCandidates(base) {
  const picked = onboarded.vendorIds.map((id) => VENDORS.find((v) => v.id === id)).filter(Boolean);
  const categories = [...new Set(picked.map((v) => v.category))];

  return {
    ...base,
    groups: categories.map((category) => {
      const decided = picked.find((v) => v.category === category);

      return {
        category,
        categoryLabel: CATEGORY_LABEL[category] ?? category,
        candidates: picked
          .filter((v) => v.category === category)
          .map((v, index) => ({
            id: `c${v.id.slice(1)}`,
            vendorId: v.id,
            vendorName: v.name,
            category: v.category,
            region: v.region,
            imageUrl: null,
            note: null,
            addedAt: `2026-09-26T00:00:0${index}.000Z`,
            addedByPartner: false,
            rating: v.rating,
          })),
        comparable: false,
        state: 'decided',
        stateLabel: '결정 완료',
        decidedVendorId: decided.id,
      };
    }),
    total: picked.length,
    manualDecisions: onboarded.manual.map((one, index) => {
      const category = GROUP_FIRST_CATEGORY[one.group] ?? 'hall';

      return {
        category,
        categoryLabel: CATEGORY_LABEL[category] ?? category,
        name: one.name,
        decidedAt: `2026-09-26T00:00:1${index}.000Z`,
        decidedByPartner: false,
      };
    }),
  };
}

{
  const baseMe = routes['GET /v1/me'];
  const onboardedMe = (me) => ({
    ...me,
    weddingDate: onboarded.weddingDate,
    region: onboarded.region,
    setupComplete: true,
    preparedCategories: onboarded.preparedCategories,
    hasPick: onboarded.vendorIds.length > 0,
  });

  routes['GET /v1/me'] = (input) => {
    const me = typeof baseMe === 'function' ? baseMe(input) : baseMe;

    return onboarded.done ? onboardedMe(me) : me;
  };

  const baseCandidates = routes['GET /v1/weddings/:weddingId/candidates'];

  routes['GET /v1/weddings/:weddingId/candidates'] = (input) => {
    const base = typeof baseCandidates === 'function' ? baseCandidates(input) : baseCandidates;

    return onboarded.done ? onboardedCandidates(base) : base;
  };

  /* 홈도 같은 사람을 본다 — 온보딩을 끝냈으면 준비 현황 · 결정이 「내 웨딩 준비」에 선다. */
  const baseBootstrap = routes['GET /v1/app/bootstrap'];

  routes['GET /v1/app/bootstrap'] = (input) => {
    const base = typeof baseBootstrap === 'function' ? baseBootstrap(input) : baseBootstrap;

    if (!onboarded.done) return base;

    const candidatesBase = typeof baseCandidates === 'function' ? baseCandidates(input) : baseCandidates;

    return { ...base, member: onboardedMe(base.member ?? ME), candidates: onboardedCandidates(candidatesBase) };
  };
}

/*
 * 예산 추가 «자동 등록» 캡처 전용 스위치(2026-09-26). 기본 fixture는 건드리지 않는다.
 *
 *   FIXTURE_PAYMENT_CONSENT=false  Pick 인증 동의가 아직 없다 — 자동 등록이 동의 안내부터 보인다
 *   FIXTURE_PROOF_PENDING=true     서버가 못 읽었다 — 결과 «확인 중이에요» · 지출내역 «확인 중» 줄
 *   FIXTURE_PROOF_BUDGET_RAISED=true  총예산을 넘어 서버가 넘은 만큼 늘렸다 — 결과 «총예산을 N만원 늘렸어요»
 *   FIXTURE_CONSULT_EMPTY=true     상담기록이 비었다 — 빈 상자 «녹음 파일을 올려주세요»
 *   FIXTURE_TASKS_UNDATED=true     할 일이 날짜 없이 심겨 있다 — 웨딩일정 «예식일 기준 임시 날짜» 줄
 *   FIXTURE_VENDOR_PUBLIC=true     공공데이터 업체 — 업체 상세 «정보» 탭 출처 «공공데이터»
 */
routes['PUT /v1/consultations/:consultationId/audio'] = {
  ...routes['GET /v1/weddings/:weddingId/consultations'].records[0],
  id: 'c9999999-9999-4999-8999-999999999999',
  confirmedAt: null,
};

/*
 * 업체 상세 «정보» 탭의 출처 줄(2026-09-26 「공공데이터」 통일). 서버가 공공데이터 업체에 주는
 * 문장(`vendorSourceNote`) 그대로 — 화면은 이 문장 대신 «공공데이터» 한 이름을 적어야 한다.
 */
if (process.env.FIXTURE_VENDOR_PUBLIC === 'true') {
  routes['GET /v1/vendors/:vendorId'] = { ...routes['GET /v1/vendors/:vendorId'], sourceNote: '지방행정 인허가 데이터 · 공공데이터포털' };
}

/*
 * 웨딩일정 임시 날짜(2026-09-26). 서버는 새 웨딩에 기본 열셋을 **날짜 없이** 심는다
 * (`seedPresets`) — 실제 사용자 대부분이 이 꼴이다. 기본 fixture는 셋 다 날짜가 있어 임시 줄이
 * 안 보이므로, 켜면 날짜 없는 기본 할 일 여섯 + 날짜를 넣은 하나로 바꾼다(진짜 날짜가 이긴다).
 */
if (process.env.FIXTURE_TASKS_UNDATED === 'true') {
  const task = (id, label, dueDate = null, vendorLabel = null) => ({
    id, label, dueDate, vendorId: null, vendorLabel, state: 'upcoming', stateLabel: '예정', manualState: false,
  });
  routes['GET /v1/weddings/:weddingId/tasks'] = {
    tasks: [
      task('91111111-1111-4111-8111-111111111111', '드레스 투어'),
      task('92222222-2222-4222-8222-222222222222', '스튜디오 촬영일'),
      task('93333333-3333-4333-8333-333333333333', '예물·예단'),
      task('94444444-4444-4444-8444-444444444444', '예복 맞춤'),
      task('95555555-5555-4555-8555-555555555555', '청첩장 시안'),
      task('96666666-6666-4666-8666-666666666666', '혼인신고 서류'),
      task('97777777-7777-4777-8777-777777777777', '웨딩홀 잔금 납부', '2027-04-01', '청담 E 웨딩홀'),
    ],
    progress: { done: 0, total: 7 },
  };
}

/* 상담기록 빈 상자(WP-NOTE-004 `uploadBox`) — 누르면 OS 파일 선택기가 열리는지 찍는다. */
if (process.env.FIXTURE_CONSULT_EMPTY === 'true') {
  routes['GET /v1/weddings/:weddingId/consultations'] = { records: [] };
}

if (process.env.FIXTURE_PAYMENT_CONSENT === 'false') {
  routes['GET /v1/me/settings'] = { ...routes['GET /v1/me/settings'], paymentConsent: false, paymentConsentAt: null };
}
routes['POST /v1/me/payment-consent'] = { ...routes['GET /v1/me/settings'], paymentConsent: true, paymentConsentAt: '2026-09-26T00:00:00.000Z' };

/*
 * 총예산 3,000만원 · 낸 돈 1,200만원인 웨딩에 2,300만원짜리 Pick 인증 — 총예산을 넘은 500만원만큼
 * 서버가 늘렸다(2026-09-26 대표 결정). 결과 화면 «총예산을 500만원 늘렸어요»를 찍는다.
 */
if (process.env.FIXTURE_PROOF_BUDGET_RAISED === 'true') {
  routes['POST /v1/payment-proofs'] = {
    ...routes['POST /v1/payment-proofs'],
    paidAmount: 23000000,
    budgetRaise: { weddingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', before: 30000000, budget: 35000000, raisedBy: 5000000 },
  };
}

if (process.env.FIXTURE_PROOF_PENDING === 'true') {
  routes['POST /v1/payment-proofs'] = {
    ...routes['POST /v1/payment-proofs'],
    status: 'pending_review',
    pendingFields: ['merchantName', 'paidAmount', 'paidAt'],
    reviewNote: '사진에서 금액을 읽지 못했어요. 확인이 끝나면 알려드려요',
    merchantName: null,
    paidAmount: null,
    paidAt: null,
    maskedIdentifiers: [],
  };
  routes['GET /v1/me/reports'] = {
    reports: [
      {
        id: 'd3333333-3333-4333-8333-333333333333',
        kind: 'payment_proof',
        kindLabel: 'Pick 인증',
        use: '실 제보',
        subject: '확인 중인 자료',
        vendorId: null,
        amount: null,
        reportedAt: '2026-09-26T03:00:00.000Z',
        inUse: false,
        needsCheck: true,
        note: '사진에서 금액을 읽지 못했어요. 확인이 끝나면 알려드려요',
      },
      ...routes['GET /v1/me/reports'].reports,
    ],
  };
}

module.exports = { routes, matchRoute, VENDORS, SPONSORED, ME };
