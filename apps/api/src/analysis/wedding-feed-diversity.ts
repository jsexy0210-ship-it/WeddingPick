/**
 * 웨딩피드 자동 작성이 **겹치지 않게** 하는 규칙 — 모델을 부르지 않는 순수 함수만 둔다.
 *
 * 2026-09-26 대표 지시 — 「웨딩피드 자동작성 — 같은 카테고리 이전 내용을 분석해서 중첩되지
 * 않는 내용으로 생성한다. 전체적으로 이미지도 대부분 다 비슷비슷하다. 다르게 생성되어야
 * 한다. 가상 모델은 동양인 한국인 기준으로만 생성한다.」
 *
 * **왜 겹쳤나(2026-09-26 확인).**
 *  - 글: 관리자 「자동 작성」은 카테고리마다 **글자 하나까지 같은 요청**을 `temperature 0`으로
 *    보냈다(`routes/admin.ts` `/draft`). 이전 글을 한 줄도 넘기지 않았다.
 *  - 그림: 화풍을 정하는 지시(자연광 · 얕은 심도 · 따뜻한 색감 · 「뒷모습 · 손 · 실루엣만」)가
 *    모든 요청에서 같았다. 달라지는 것은 제목과 요약뿐이었다.
 *
 * 그래서 두 겹으로 막는다 — 요청 앞에서 「이미 쓴 것」을 넘기고(`coveredListText`), 받은 뒤에
 * 서버가 한 번 더 잰다(`findNearDuplicate` · `dHash`). 모델이 지시를 어겨도 뒤에서 걸린다.
 */

// ─── 글 ───────────────────────────────────────────────────────────────────

/** 같은 카테고리에서 몇 편을 되돌아보나. 관리자 화면 한 번에 보이는 글 수와 비슷하게 둔다. */
export const FEED_RECENT_LIMIT = 30;

/**
 * 이 값 이상이면 「이미 쓴 글과 겹친다」로 보고 버린다.
 *
 * **근거 — 한국어 표본으로 쟀다**(`wedding-feed-diversity.test.ts`의 표본 그대로):
 *  - 같은 내용을 말만 바꾼 쌍 7개: 0.43 ~ 0.73
 *  - 같은 카테고리의 다른 세부 주제 13개(주제 목록의 `studio-pick` · `studio-original`처럼
 *    일부 낱말을 나눠 갖는 쌍 포함): 0.00 ~ 0.39
 * 둘 사이의 0.40으로 둔다. 겹친 글을 내보내는 것이 새 글을 한 번 더 쓰는 것보다 나쁘다 —
 * 애매하면 버리는 쪽이다.
 */
export const FEED_TEXT_DUPLICATE_THRESHOLD = 0.4;

/** 겹쳐서 버린 뒤 다시 쓰는 횟수(처음 포함). 넘기면 쓰지 않고 이유를 남긴다. */
export const FEED_DRAFT_MAX_ATTEMPTS = 3;

export type FeedTextSample = { title: string; summary: string; body?: string };

/** 낱말 끝의 조사. 떼야 「예산을」과 「예산」이 같은 낱말로 잡힌다. 긴 것부터 본다. */
const PARTICLES = [
  '에서는', '에서', '으로', '에게', '까지', '부터', '하고', '와', '과', '을', '를', '은', '는',
  '이', '가', '의', '에', '도', '로', '만',
];

/**
 * 비교할 모양으로 바꾼다 — NFC · 소문자 · 문장부호를 빈칸으로. `strip`의 말(카테고리 이름)은
 * 지운다: 같은 카테고리의 글은 전부 그 말을 갖고 있어서, 남겨 두면 모든 글이 서로 닮아 보인다.
 */
export function normalizeFeedText(text: string, strip: readonly string[] = []): string {
  let out = text.normalize('NFC').toLowerCase();

  for (const word of strip) {
    const w = word.normalize('NFC').toLowerCase().trim();
    if (w) out = out.split(w).join(' ');
  }

  return out.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function words(text: string): string[] {
  return text.split(' ').filter(Boolean);
}

/** 글자 두 개씩. 낱말 경계를 넘지 않는다. 한 글자 낱말은 그대로 둔다. */
function charBigrams(normalized: string): Set<string> {
  const out = new Set<string>();

  for (const word of words(normalized)) {
    if (word.length < 2) {
      out.add(word);
      continue;
    }
    for (let i = 0; i + 2 <= word.length; i += 1) out.add(word.slice(i, i + 2));
  }

  return out;
}

/**
 * 낱말 머리 두 글자. 한국어는 끝이 바뀌어(짜는 · 짜기 · 짜려면) 글자 쌍만으로는 같은 말이
 * 덜 겹쳐 보인다. 조사를 떼고 앞 두 글자를 보면 「횟수와」와 「횟수를」이 같아진다.
 */
function stemPrefixes(normalized: string): Set<string> {
  const out = new Set<string>();

  for (let word of words(normalized)) {
    for (const particle of PARTICLES) {
      if (word.length > particle.length + 1 && word.endsWith(particle)) {
        word = word.slice(0, -particle.length);
        break;
      }
    }
    if (word.length >= 2) out.add(word.slice(0, 2));
  }

  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let shared = 0;

  for (const item of a) if (b.has(item)) shared += 1;

  return shared / (a.size + b.size - shared);
}

/**
 * 두 글이 얼마나 겹치나(0 ~ 1). 제목과 한 줄 요약만 본다 — 사용자가 목록에서 보고
 * 「같은 글」이라고 느끼는 자리가 그 둘이다. 한쪽에 요약이 없으면 제목끼리 본다.
 *
 * 글자 쌍 Jaccard와 낱말 머리 Jaccard의 평균이다. 앞의 것은 어순이 바뀐 같은 말을,
 * 뒤의 것은 끝이 바뀐 같은 말을 잡는다.
 */
export function feedTextSimilarity(
  a: FeedTextSample,
  b: FeedTextSample,
  categoryLabel = ''
): number {
  const strip = categoryLabel ? [categoryLabel] : [];
  /*
   * 한쪽이 제목만 있으면(화면이 넘긴 「방금 받은 초안 제목」) 제목끼리만 견준다 — 요약까지
   * 섞으면 같은 제목도 요약 글자에 묻혀 달라 보인다.
   */
  const withSummary = a.summary.trim() !== '' && b.summary.trim() !== '';
  const left = normalizeFeedText(withSummary ? `${a.title} ${a.summary}` : a.title, strip);
  const right = normalizeFeedText(withSummary ? `${b.title} ${b.summary}` : b.title, strip);

  return (
    (jaccard(charBigrams(left), charBigrams(right)) +
      jaccard(stemPrefixes(left), stemPrefixes(right))) /
    2
  );
}

/** 가장 많이 겹치는 이전 글. 한도 아래면 null. */
export function findNearDuplicate<T extends FeedTextSample>(
  candidate: FeedTextSample,
  recent: readonly T[],
  options: { categoryLabel?: string; threshold?: number } = {}
): { post: T; score: number } | null {
  const threshold = options.threshold ?? FEED_TEXT_DUPLICATE_THRESHOLD;
  let best: { post: T; score: number } | null = null;

  for (const post of recent) {
    const score = feedTextSimilarity(candidate, post, options.categoryLabel);
    if (score >= threshold && (!best || score > best.score)) best = { post, score };
  }

  return best;
}

/**
 * 본문의 요점 — 문단마다 첫 문장. 모델에게 「이미 다룬 것」을 짧게 보여주는 데만 쓴다.
 * 본문을 통째로 넘기면 서른 편이 수만 자가 되고, 모델은 긴 목록의 뒤쪽을 덜 본다.
 */
export function keyPointsOf(body: string | undefined, max = 3): string[] {
  if (!body) return [];

  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph && !paragraph.startsWith('출처:'))
    .map((paragraph) => {
      const first = paragraph.split(/(?<=[.!?。])\s|\n/)[0] ?? paragraph;
      return first.length > 50 ? `${first.slice(0, 50)}…` : first;
    })
    .slice(0, max);
}

/**
 * 모델에게 넘기는 「이미 쓴 글」 목록. 비어 있으면 빈 문자열이다 — 없는 목록을 적으면
 * 모델이 그 자리를 채우려 든다.
 */
export function coveredListText(
  covered: readonly FeedTextSample[],
  avoidTitles: readonly string[] = []
): string {
  const lines: string[] = [];

  if (covered.length > 0) {
    lines.push(
      `이미 쓴 글(같은 묶음 · 최근 ${covered.length}편). 아래 글과 세부 주제 · 관점 · 제목이 겹치지 않는 새 글을 써라:`
    );
    for (const post of covered) {
      const points = keyPointsOf(post.body, 2);
      lines.push(
        `- ${post.title}${post.summary ? ` — ${post.summary}` : ''}${points.length > 0 ? ` (요점: ${points.join(' / ')})` : ''}`
      );
    }
  }

  const avoid = [...new Set(avoidTitles.map((title) => title.trim()).filter(Boolean))];

  if (avoid.length > 0) {
    lines.push('이번에 쓰지 말 제목(방금 나왔거나 겹쳐서 버렸다):');
    for (const title of avoid) lines.push(`- ${title}`);
  }

  return lines.join('\n');
}

// ─── 그림 ─────────────────────────────────────────────────────────────────

/**
 * 사람을 그릴 때의 규칙 — **모든 웨딩피드 그림 요청에 들어간다**(시험이 센다).
 *
 * 2026-09-26 대표 지시 「가상 모델은 동양인 한국인 기준으로만 생성한다」. 실존 인물을 닮게
 * 그리지 않는 것은 그 전부터의 규칙(「식별 가능한 인물」 금지)을 잇는다.
 *
 * 영어 지시를 함께 둔다 — 이미지 모델은 영어 지시를 더 잘 지킨다(글자 금지와 같은 이유).
 */
export const FEED_IMAGE_PEOPLE_RULE = [
  '사람이 나오면 모두 가상의 한국인(동아시아인) 성인으로만 그린다. 다른 인종이나 어린이는 넣지 마라.',
  '실존 인물, 연예인, 유명인을 닮게 그리지 마라.',
  'Any person in the image must be a fictional Korean (East Asian) adult. No other ethnicities, no children.',
  'Never depict real people, celebrities or look-alikes.',
].join('\n');

type Option = { key: string; text: string };

/**
 * 한 장의 촬영 계획을 이루는 칸. 칸마다 여러 값이 있고, 최근 그림에서 덜 쓴 값을 고른다.
 *
 * **글자가 들어가기 쉬운 소품(달력 · 청첩장 · 체크리스트)은 넣지 않았다.** 그림 안 글자
 * 금지(2026-09-25 대표 지시)를 모델이 가장 자주 어기는 자리가 종이 소품이다.
 */
export const FEED_IMAGE_VARIETY = {
  shot: [
    { key: 'flatlay', text: '위에서 수직으로 내려다본 플랫레이 구도' },
    { key: 'closeup', text: '손과 소품에 바짝 다가간 클로즈업' },
    { key: 'medium', text: '인물의 허리 위를 담은 미디엄 샷' },
    { key: 'full', text: '인물 전신과 주변 공간이 함께 보이는 풀 샷' },
    { key: 'wide', text: '공간 전체를 넓게 담은 와이드 샷' },
    { key: 'over-shoulder', text: '어깨 너머로 바라보는 시점' },
    { key: 'low-angle', text: '낮은 곳에서 올려다본 앵글' },
    { key: 'symmetric', text: '정면에서 좌우 대칭으로 잡은 구도' },
    { key: 'candid', text: '움직이는 순간을 옆에서 자연스럽게 잡은 스냅' },
  ],
  timeOfDay: [
    { key: 'morning', text: '맑은 아침 햇살' },
    { key: 'noon', text: '밝은 한낮의 빛' },
    { key: 'golden', text: '해 질 무렵 금빛 햇살' },
    { key: 'blue-hour', text: '해가 진 직후의 푸른 빛' },
    { key: 'evening-indoor', text: '저녁 실내 조명' },
    { key: 'overcast', text: '흐린 날의 부드러운 빛' },
  ],
  season: [
    { key: 'spring', text: '봄 — 연둣빛 잎과 봄꽃' },
    { key: 'summer', text: '여름 — 짙은 초록과 강한 햇빛' },
    { key: 'autumn', text: '가을 — 단풍과 갈색 톤' },
    { key: 'winter', text: '겨울 — 차가운 공기와 코트 차림' },
  ],
  palette: [
    { key: 'ivory-gold', text: '아이보리와 샴페인 골드' },
    { key: 'sage', text: '세이지 그린과 흰색' },
    { key: 'dusty-blue', text: '더스티 블루와 연회색' },
    { key: 'terracotta', text: '테라코타와 베이지' },
    { key: 'monochrome', text: '흑백에 가까운 무채색' },
    { key: 'pastel', text: '파스텔 핑크와 라벤더' },
    { key: 'navy-burgundy', text: '짙은 네이비와 버건디' },
    { key: 'vivid', text: '선명한 원색이 한두 군데 들어간 밝은 색' },
  ],
  props: [
    { key: 'bouquet', text: '부케와 리본' },
    { key: 'rings', text: '반지 상자와 반지' },
    { key: 'tea', text: '찻잔과 작은 디저트' },
    { key: 'fabric', text: '드레스 원단 샘플과 레이스' },
    { key: 'luggage', text: '여행 가방과 밀짚모자' },
    { key: 'vase', text: '꽃병에 꽂은 생화' },
    { key: 'veil', text: '베일과 헤어 장식' },
    { key: 'shoes', text: '웨딩 슈즈와 넥타이' },
    { key: 'none', text: '소품 없이 공간과 인물만' },
  ],
  people: [
    { key: 'none', text: '사람 없이 공간과 소품만' },
    { key: 'one', text: '한 사람' },
    { key: 'couple', text: '예비 부부 두 사람' },
    { key: 'group', text: '가족이나 친구 서너 명' },
  ],
} as const satisfies Record<string, readonly Option[]>;

/** 장소. 카테고리마다 어울리는 곳이 다르다 — 아래 `FEED_IMAGE_SCENES_BY_CATEGORY`가 고른다. */
export const FEED_IMAGE_SCENES: Record<string, string> = {
  'home-table': '햇빛이 드는 집 식탁',
  cafe: '조용한 카페 창가 자리',
  desk: '정돈된 서재 책상',
  sofa: '거실 소파',
  'park-bench': '공원 산책로 벤치',
  balcony: '화분이 놓인 베란다',
  'consult-room': '밝은 상담실 테이블',
  chapel: '천장이 높은 밝은 채플형 예식장',
  ballroom: '샹들리에가 달린 호텔 연회장',
  garden: '잔디가 깔린 야외 가든 예식장',
  'bridal-room': '꽃으로 꾸민 신부대기실',
  'banquet-table': '연회장 원형 테이블과 꽃장식',
  aisle: '꽃장식이 늘어선 버진로드',
  'studio-white': '흰 벽의 촬영 스튜디오',
  'studio-set': '큰 창이 있는 빈티지 세트 스튜디오',
  field: '억새가 흔들리는 들판',
  'city-street': '도심의 오래된 골목',
  seaside: '파도가 닿는 바닷가',
  'fitting-room': '커튼이 드리운 드레스샵 피팅룸',
  mirror: '큰 전신 거울 앞',
  rack: '드레스가 걸린 행거 앞',
  showroom: '샹들리에가 있는 드레스 쇼룸',
  vanity: '조명이 둘러진 화장대 거울 앞',
  salon: '밝은 뷰티 살롱',
  'window-chair': '창가 자연광이 드는 의자',
  stage: '예식 단상과 촛불 장식',
  beach: '에메랄드빛 해변',
  'old-town': '돌길이 깔린 유럽풍 구시가지',
  airport: '활주로가 보이는 공항 창가',
  'resort-pool': '야자수가 있는 리조트 수영장',
  lake: '산과 호수가 보이는 전망대',
  lobby: '예식장 로비의 축하 공간',
};

const GENERAL_SCENES = ['home-table', 'cafe', 'desk', 'sofa', 'park-bench', 'balcony', 'consult-room'];

/**
 * 카테고리 → 어울리는 장소.
 *
 * **키는 카테고리 이름 그대로다**(`structured.wedding_feed_categories.name` · 0421 씨앗값).
 * 운영자가 새 카테고리를 만들면 여기 없으므로 일반 장소에서 고른다 — 막지 않는다.
 */
export const FEED_IMAGE_SCENES_BY_CATEGORY: Record<string, readonly string[]> = {
  예산: ['home-table', 'cafe', 'desk', 'sofa', 'balcony'],
  체크리스트: ['home-table', 'desk', 'cafe', 'balcony', 'sofa'],
  '준비 순서': ['home-table', 'desk', 'cafe', 'park-bench', 'balcony'],
  웨딩홀: ['chapel', 'ballroom', 'garden', 'bridal-room', 'banquet-table', 'aisle', 'lobby'],
  스튜디오: ['studio-white', 'studio-set', 'field', 'city-street', 'seaside'],
  드레스: ['fitting-room', 'mirror', 'rack', 'showroom', 'bridal-room'],
  메이크업: ['vanity', 'salon', 'bridal-room', 'window-chair'],
  헤어변형: ['vanity', 'salon', 'bridal-room', 'window-chair', 'garden'],
  본식스냅: ['aisle', 'ballroom', 'garden', 'bridal-room', 'stage'],
  허니문: ['beach', 'old-town', 'airport', 'resort-pool', 'lake'],
  계약: ['consult-room', 'cafe', 'desk', 'home-table'],
  하객: ['banquet-table', 'ballroom', 'garden', 'lobby'],
};

export type FeedImageDimension = keyof typeof FEED_IMAGE_VARIETY | 'scene';

export type FeedImagePlan = Record<FeedImageDimension, string>;

const DIMENSIONS: readonly FeedImageDimension[] = [
  'scene',
  'shot',
  'timeOfDay',
  'season',
  'palette',
  'props',
  'people',
];

export function feedImageScenesFor(categoryLabel: string | null | undefined): readonly string[] {
  return FEED_IMAGE_SCENES_BY_CATEGORY[categoryLabel?.trim() ?? ''] ?? GENERAL_SCENES;
}

function optionKeys(dimension: FeedImageDimension, categoryLabel: string | null | undefined): string[] {
  if (dimension === 'scene') return [...feedImageScenesFor(categoryLabel)];

  return FEED_IMAGE_VARIETY[dimension].map((option) => option.key);
}

/** 같은 조합인지 가르는 열쇠. 저장해 두고 같은 조합을 다시 고르지 않는다. */
export function feedImagePlanSignature(plan: FeedImagePlan): string {
  return DIMENSIONS.map((dimension) => plan[dimension]).join('|');
}

/** 저장해 둔 계획을 믿지 않고 모양을 확인한다(옛 행 · 손으로 고친 행). */
export function parseFeedImagePlan(value: unknown): FeedImagePlan | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const plan = {} as FeedImagePlan;

  for (const dimension of DIMENSIONS) {
    const v = record[dimension];
    if (typeof v !== 'string' || !v) return null;
    plan[dimension] = v;
  }

  return plan;
}

/** 두 계획이 몇 칸 다른가. */
export function feedImagePlanDistance(a: FeedImagePlan, b: FeedImagePlan): number {
  return DIMENSIONS.filter((dimension) => a[dimension] !== b[dimension]).length;
}

/** 사람이 있어야 성립하는 구도. 계획에 사람이 없으면 고르지 않는다. */
const PERSON_SHOTS = new Set(['medium', 'full', 'over-shoulder', 'candid']);

/** 바로 앞 몇 장과는 이만큼 칸이 달라야 한다(7칸 중). */
export const FEED_IMAGE_MIN_PLAN_DISTANCE = 4;
const RECENT_STRICT = 5;

/**
 * 이번 그림의 계획을 고른다.
 *
 * 칸마다 **최근 그림에서 가장 덜 쓴 값** 가운데 하나를 무작위로 고른다. 최근일수록 무겁게
 * 센다(앞 다섯 장은 두 번). 바로 앞 두 장이 쓴 값은 다른 값이 있으면 피한다. 그다음
 * 같은 조합이 이미 있거나 앞 다섯 장과 네 칸 미만으로 다르면 한 칸씩 바꿔 다시 본다.
 *
 * `recent`는 최근 것이 앞이다. `random`은 시험이 넘긴다.
 */
export function chooseFeedImagePlan(input: {
  categoryLabel?: string | null;
  recent: readonly FeedImagePlan[];
  random?: () => number;
}): FeedImagePlan {
  const random = input.random ?? Math.random;
  const pick = <T>(items: readonly T[]): T => items[Math.min(items.length - 1, Math.floor(random() * items.length))]!;
  const recent = input.recent;
  const plan = {} as FeedImagePlan;

  for (const dimension of DIMENSIONS) {
    const keys = optionKeys(dimension, input.categoryLabel);
    const weight = new Map(keys.map((key) => [key, 0]));

    recent.forEach((previous, index) => {
      const key = previous[dimension];
      if (weight.has(key)) weight.set(key, weight.get(key)! + (index < RECENT_STRICT ? 2 : 1));
    });

    const justUsed = new Set(recent.slice(0, 2).map((previous) => previous[dimension]));
    const fresh = keys.filter((key) => !justUsed.has(key));
    const pool = fresh.length > 0 ? fresh : keys;
    const least = Math.min(...pool.map((key) => weight.get(key)!));

    plan[dimension] = pick(pool.filter((key) => weight.get(key) === least));
  }

  /*
   * 서로 부딪치는 칸을 푼다 — 「사람 없이」인데 「인물 미디엄 샷」이면 모델이 둘 중 하나를
   * 멋대로 버린다. 사람이 없으면 인물 구도를 빼고, 소품까지 없으면 소품을 하나 넣는다.
   */
  const avoidJustUsed = (dimension: FeedImageDimension, keys: string[]) => {
    const justUsed = new Set(recent.slice(0, 2).map((previous) => previous[dimension]));
    const fresh = keys.filter((key) => !justUsed.has(key));
    return pick(fresh.length > 0 ? fresh : keys);
  };
  const settle = (candidate: FeedImagePlan) => {
    if (candidate.people !== 'none') return;
    if (PERSON_SHOTS.has(candidate.shot)) {
      candidate.shot = avoidJustUsed(
        'shot',
        FEED_IMAGE_VARIETY.shot.map((o) => o.key).filter((key) => !PERSON_SHOTS.has(key))
      );
    }
    if (candidate.props === 'none') {
      candidate.props = avoidJustUsed(
        'props',
        FEED_IMAGE_VARIETY.props.map((o) => o.key).filter((key) => key !== 'none')
      );
    }
  };

  settle(plan);

  const signatures = new Set(recent.map(feedImagePlanSignature));
  const strict = recent.slice(0, RECENT_STRICT);
  const tooClose = (candidate: FeedImagePlan) =>
    signatures.has(feedImagePlanSignature(candidate)) ||
    strict.some((previous) => feedImagePlanDistance(candidate, previous) < FEED_IMAGE_MIN_PLAN_DISTANCE);

  for (let tries = 0; tries < 40 && tooClose(plan); tries += 1) {
    const dimension = pick(DIMENSIONS);
    const others = optionKeys(dimension, input.categoryLabel).filter((key) => key !== plan[dimension]);
    if (others.length > 0) plan[dimension] = avoidJustUsed(dimension, others);
    settle(plan);
  }

  return plan;
}

/** 계획을 모델에게 줄 줄들로. 모르는 키(옛 값)는 그 칸을 건너뛴다. */
export function feedImagePlanLines(plan: FeedImagePlan): string[] {
  const text = (dimension: keyof typeof FEED_IMAGE_VARIETY) =>
    (FEED_IMAGE_VARIETY[dimension] as readonly Option[]).find((option) => option.key === plan[dimension])?.text;
  const rows: [string, string | undefined][] = [
    ['장소', FEED_IMAGE_SCENES[plan.scene]],
    ['구도', text('shot')],
    ['시간대와 빛', text('timeOfDay')],
    ['계절', text('season')],
    ['색감', text('palette')],
    ['소품', text('props')],
    ['인물', text('people')],
  ];

  return rows.filter((row): row is [string, string] => Boolean(row[1])).map(([label, value]) => `- ${label}: ${value}`);
}

// ─── 그림 지문(dHash) ────────────────────────────────────────────────────

/**
 * 64비트 중 이만큼 이하로 다르면 「거의 같은 그림」이다.
 *
 * dHash는 밝기의 좌우 변화만 본다. 같은 그림을 줄이거나 밝기를 바꾸면 0 ~ 5비트, 구도와
 * 색이 비슷한 다른 사진이 6 ~ 10비트 안쪽에 들고, 서로 다른 장면은 대개 20비트를 넘는다
 * (시험의 합성 그림으로 확인). 「비슷비슷하다」를 막는 것이 목적이라 넉넉히 10으로 둔다.
 */
export const FEED_IMAGE_DUPLICATE_BITS = 10;

/**
 * 회색조 픽셀에서 dHash(9×8 차이 해시)를 만든다. 16자리 16진수.
 *
 * 9×8로 줄일 때 칸 안의 픽셀을 평균한다 — 가장 가까운 한 점만 집으면 잡음 하나에
 * 해시가 흔들린다.
 */
export function dHashFromGray(gray: ArrayLike<number>, width: number, height: number): string {
  if (width < 1 || height < 1 || gray.length < width * height) {
    throw new Error('dHash: 픽셀 수가 가로 × 세로보다 적다.');
  }

  const cols = 9;
  const rows = 8;
  const cells: number[] = [];

  for (let row = 0; row < rows; row += 1) {
    const y0 = Math.floor((row * height) / rows);
    const y1 = Math.max(y0 + 1, Math.floor(((row + 1) * height) / rows));

    for (let col = 0; col < cols; col += 1) {
      const x0 = Math.floor((col * width) / cols);
      const x1 = Math.max(x0 + 1, Math.floor(((col + 1) * width) / cols));
      let sum = 0;
      let count = 0;

      for (let y = y0; y < Math.min(y1, height); y += 1) {
        for (let x = x0; x < Math.min(x1, width); x += 1) {
          sum += gray[y * width + x]!;
          count += 1;
        }
      }
      cells.push(count > 0 ? sum / count : 0);
    }
  }

  let hex = '';

  for (let row = 0; row < rows; row += 1) {
    let byte = 0;
    for (let col = 0; col < 8; col += 1) {
      const left = cells[row * cols + col]!;
      const right = cells[row * cols + col + 1]!;
      byte = (byte << 1) | (left < right ? 1 : 0);
    }
    hex += byte.toString(16).padStart(2, '0');
  }

  return hex;
}

const NIBBLE_BITS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/** 두 16진수 해시가 몇 비트 다른가. 길이가 다르거나 깨졌으면 64(전혀 다름)로 본다. */
export function hammingDistanceHex(a: string, b: string): number {
  if (a.length !== b.length || !/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b)) return 64;
  let bits = 0;

  for (let i = 0; i < a.length; i += 1) {
    bits += NIBBLE_BITS[parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16)]!;
  }

  return bits;
}
