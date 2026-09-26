/**
 * 웨딩피드 — 홈 아래쪽에 깔리는 읽을거리.
 *
 * 2026-09-15 대표 지시. 운영자가 목록 · 등록 · 수정 · 삭제를 다 하고, 그 위에
 * **자동 작성**이 붙어 계속 글이 쌓인다.
 *
 * 규칙과 한도를 여기 한 자리에 둔다 — 서버 · 화면 · 자동 작성이 같은 것을 본다.
 * 세 곳에 따로 적으면 한 곳만 고쳐서 어긋나고, 그때 걸리는 것은 사용자 화면이다.
 *
 * **사용자에게 보이는 말은 「웨딩픽 콘텐츠」이고 `AI`라고 적지 않는다**(glossary).
 * 관리자 화면에서도 쓰지 않는다(2026-09-11 대표 지시) — 그래서 이 기능의 이름은
 * 어디서나 「자동 작성」이다.
 */

import type { VendorCategory } from './vendor';

export const WEDDING_FEED_STATUSES = ['draft', 'published', 'archived'] as const;
export type WeddingFeedStatus = (typeof WEDDING_FEED_STATUSES)[number];

export const WEDDING_FEED_STATUS_LABEL: Record<WeddingFeedStatus, string> = {
  draft: '초안',
  published: '공개',
  archived: '내림',
};

export const WEDDING_FEED_SOURCES = ['manual', 'generated'] as const;
export type WeddingFeedSource = (typeof WEDDING_FEED_SOURCES)[number];

export const WEDDING_FEED_SOURCE_LABEL: Record<WeddingFeedSource, string> = {
  manual: '직접 작성',
  generated: '자동 작성',
};

/**
 * 글자 한도.
 *
 * 카드가 정한다. 제목은 시안에서 두 줄까지 들어가고(`home.txt` — 14/600 · lh 20 ·
 * 폭 182), 한 줄 요약은 한 줄이다. 한도를 넘는 글은 **카드에서 잘려 보이는데
 * 목록에서는 멀쩡해 보인다** — 그래서 들어올 때 막는다.
 */
export const WEDDING_FEED_LIMITS = {
  categoryLabel: 20,
  title: 60,
  summary: 120,
  body: 4000,
} as const;

/**
 * ── 칩과 카테고리 — 관리자와 앱이 함께 보는 목록 하나 ─────────────────────
 *
 * 2026-09-26 대표 지적 — 「관리자 웨딩피드 카테고리와 앱웹 카테고리와 정보가 전혀 다르다」.
 *
 * **왜 달랐나.** 2026-09-16부터 탭·카테고리는 표(0421)에 있었고 관리자가 고쳤다(탭
 * 준비·예산 · 업체·서비스 · 계약·여행). 그 탭을 그리던 앱 화면 `(home)/feed.tsx`는
 * 2026-09-25 정본에 없는 화면이라 지워졌고(#535), 남은 앱 목록 — 라운지 「웨딩정보」
 * (WP-LNG-002) — 은 정본 칩을 코드에 박아 그렸다(#537). 그 뒤로 관리자에서 탭을
 * 고쳐도 앱은 아무것도 바뀌지 않았고, 관리자 화면만 「앱은 여기 있는 것을 그린다」고
 * 적고 있었다.
 *
 * **칩은 정본이 정한다.** `docs/design/React_Native/my.js` `cats` — 전체 · 웨딩홀 ·
 * 스드메 · 본식 · 예물 · 신혼 · 예산. 앱 화면의 정본은 이 폴더 하나라(CLAUDE.md
 * 2026-09-24 절대 지침) 관리자가 바꿀 수 있는 값이 아니다. 그래서 표가 아니라 여기
 * 상수로 두고 서버 검사 · 관리자 화면 · 앱 칩이 전부 이것을 본다.
 *
 * **칩 키는 준비 현황 그룹 키와 같다**(`PREPARATION_GROUPS` — start · sdm · ceremony ·
 * goods). 라운지 후기 칩이 같은 줄을 쓰고 업종 묶음도 같다. «예산»만 업종이 아니다.
 */
export const WEDDING_FEED_CHIPS = [
  { key: 'all', label: '전체' },
  { key: 'start', label: '웨딩홀' },
  { key: 'sdm', label: '스드메' },
  { key: 'ceremony', label: '본식' },
  { key: 'goods', label: '예물 · 신혼' },
  { key: 'budget', label: '예산' },
] as const;

export type WeddingFeedChipKey = (typeof WEDDING_FEED_CHIPS)[number]['key'];
export type WeddingFeedChipLabel = (typeof WEDDING_FEED_CHIPS)[number]['label'];

/**
 * 글 한 편이 고르는 카테고리 — 카드 위 작은 줄(배지)에 그대로 나간다.
 *
 * **칩과 다른 층이다.** 칩은 추리는 도구이고 배지는 무엇에 관한 글인지를 말한다 —
 * 정본도 칩은 «스드메»인데 카드 배지는 «드레스» · «스튜디오»다(my.js `guides`).
 *
 * `chip`이 null이면 어느 칩에도 안 들고 «전체»에서만 보인다. 정본 칩 다섯에 맞는
 * 자리가 없는 넷(체크리스트 · 일정 · 하객 · 계약)이 그렇다 — 정본 카드도 «일정» ·
 * «체크리스트» 배지를 달지만 그 이름의 칩은 없다.
 *
 * 이름은 정본을 따른다. 업종은 `VENDOR_CATEGORY_LABEL`과 같은 글자다(본식스냅 ·
 * 헤어변형 — CLAUDE.md 2026-09-11). **«준비 순서»는 «일정»으로 바꿨다** — 같은 자리
 * («무엇부터 정하나»)를 정본은 «일정»으로 적는다(my.js `guides` lg-3 · `relGuides`
 * rl-2 · 스크랩 sv-3 세 번, «준비 순서» 0번). 표와 쌓인 글은 0442가 옮긴다.
 *
 * **결정사는 없다** — 2026-09-24 대표 지시(0433). 다시 넣지 않는다.
 */
export type WeddingFeedCategoryDef = {
  /** 바뀌지 않는 이름표. 자동 작성 주제 · 준비 단계가 이 키로 가리킨다. */
  key: string;
  /** 배지 글자 = 표의 `category_label`. */
  label: string;
  /** 어느 칩에 드는가. null이면 «전체»에서만. */
  chip: Exclude<WeddingFeedChipKey, 'all'> | null;
  /** 업종 이야기면 그 업종. 준비 단계가 업종으로 글을 찾을 때 쓴다. */
  vendorCategory: VendorCategory | null;
};

export const WEDDING_FEED_CATEGORIES = [
  { key: 'hall', label: '웨딩홀', chip: 'start', vendorCategory: 'hall' },
  { key: 'studio', label: '스튜디오', chip: 'sdm', vendorCategory: 'studio' },
  { key: 'dress', label: '드레스', chip: 'sdm', vendorCategory: 'dress' },
  { key: 'makeup', label: '메이크업', chip: 'sdm', vendorCategory: 'makeup' },
  { key: 'hair', label: '헤어변형', chip: 'sdm', vendorCategory: 'hair' },
  { key: 'snap', label: '본식스냅', chip: 'ceremony', vendorCategory: 'snap' },
  { key: 'honeymoon', label: '허니문', chip: 'goods', vendorCategory: 'honeymoon' },
  { key: 'budget', label: '예산', chip: 'budget', vendorCategory: null },
  { key: 'checklist', label: '체크리스트', chip: null, vendorCategory: null },
  { key: 'schedule', label: '일정', chip: null, vendorCategory: null },
  { key: 'guest', label: '하객', chip: null, vendorCategory: null },
  { key: 'contract', label: '계약', chip: null, vendorCategory: null },
] as const satisfies readonly WeddingFeedCategoryDef[];

export type WeddingFeedCategoryEntry = (typeof WEDDING_FEED_CATEGORIES)[number];
export type WeddingFeedCategoryKey = WeddingFeedCategoryEntry['key'];
export type WeddingFeedCategoryLabel = WeddingFeedCategoryEntry['label'];

/** 고를 수 있는 카테고리 이름. 서버 검사 · 관리자 고르기가 이것을 본다. */
export const WEDDING_FEED_CATEGORY_LABELS: readonly WeddingFeedCategoryLabel[] =
  WEDDING_FEED_CATEGORIES.map((category) => category.label);

/**
 * 이름으로 카테고리를 찾는다. **글자가 정확히 같을 때만이다** — 「웨딩홀 」(뒤 공백)을
 * 웨딩홀로 봐주면 무엇이 잘못 적혀 있었는지가 사라진다. 없으면 null.
 */
export function weddingFeedCategoryOf(label: string): WeddingFeedCategoryEntry | null {
  return WEDDING_FEED_CATEGORIES.find((category) => category.label === label) ?? null;
}

export function isWeddingFeedCategoryLabel(label: string): label is WeddingFeedCategoryLabel {
  return weddingFeedCategoryOf(label) !== null;
}

/** 이 이름의 글이 드는 칩. null이면 «전체»에서만 보인다(칩 없는 카테고리 · 목록 밖 이름). */
export function weddingFeedChipOf(label: string): Exclude<WeddingFeedChipKey, 'all'> | null {
  return weddingFeedCategoryOf(label)?.chip ?? null;
}

export function weddingFeedChipLabel(key: WeddingFeedChipKey): WeddingFeedChipLabel {
  return WEDDING_FEED_CHIPS.find((chip) => chip.key === key)!.label;
}

/** 칩을 눌렀을 때 이 글이 남는가. «전체»는 모두 남긴다. */
export function weddingFeedMatchesChip(chip: WeddingFeedChipKey, categoryLabel: string): boolean {
  return chip === 'all' || weddingFeedChipOf(categoryLabel) === chip;
}

/**
 * 자동 작성이 고르는 주제.
 *
 * **자유롭게 쓰게 두지 않는다.** 주제를 모델이 정하면 같은 이야기가 다른 제목으로
 * 반복되고, 그것을 사람이 목록에서 발견하기까지 오래 걸린다. 여기 목록에서 고르고,
 * **이미 쓴 주제는 후보에서 빠진다**(`pickTopics`).
 *
 * 업종 이름은 정본을 쓴다 — 본식스냅 · 헤어변형(CLAUDE.md 2026-09-11). 결정사 주제는
 * 2026-09-24 대표 지시로 뺐다 — 웨딩픽은 플래너 없이 직접 고르는 서비스다.
 *
 * **`견적` · `계약서`를 쓰지 않는다.** 여기 적은 말이 카드 위 작은 줄로 그대로 나가고,
 * 모델이 본문에 그 말을 따라 쓴다. `pick-language.test.ts`가 이 파일을 훑어 막는다.
 */
export type WeddingFeedTopic = {
  key: string;
  /** 카드 위 작은 줄에 그대로 들어간다. 위 목록의 이름만 쓸 수 있다. */
  categoryLabel: WeddingFeedCategoryLabel;
  /** 모델에게 주는 한 줄. 무엇을 쓸 글인지. */
  brief: string;
  /**
   * 통계 주제만 가진다 — 이 글에 넘길 공공 통계 키(`structured.public_stats`).
   * **하나라도 표에 없으면 이 주제는 고르지 않는다**(`topicsMissingStats`). 숫자 없이
   * 통계 글을 쓰게 두면 모델이 숫자를 지어낸다.
   */
  statKeys?: readonly string[];
};

export const WEDDING_FEED_TOPICS: readonly WeddingFeedTopic[] = [
  { key: 'budget-sdm', categoryLabel: '예산', brief: '스드메 예산을 넘기지 않게 짜는 방법' },
  { key: 'budget-hall', categoryLabel: '예산', brief: '웨딩홀 대관료 말고 따로 드는 비용' },
  { key: 'checklist-4m', categoryLabel: '체크리스트', brief: '본식 4개월 전에 정리할 것' },
  { key: 'checklist-1m', categoryLabel: '체크리스트', brief: '본식 한 달 전에 확인할 것' },
  { key: 'hall-visit', categoryLabel: '웨딩홀', brief: '웨딩홀 투어에서 꼭 물어볼 것' },
  { key: 'hall-guarantee', categoryLabel: '웨딩홀', brief: '보증인원이 무엇이고 어떻게 정하나' },
  { key: 'studio-pick', categoryLabel: '스튜디오', brief: '스튜디오 고를 때 보는 것' },
  { key: 'studio-original', categoryLabel: '스튜디오', brief: '원본 제공 조건을 확인하는 법' },
  { key: 'dress-fitting', categoryLabel: '드레스', brief: '드레스 피팅 전에 알아둘 것' },
  { key: 'dress-cost', categoryLabel: '드레스', brief: '드레스에서 따로 드는 비용' },
  { key: 'makeup-trial', categoryLabel: '메이크업', brief: '메이크업 리허설을 보는 법' },
  { key: 'snap-pick', categoryLabel: '본식스냅', brief: '본식스냅을 고를 때 보는 것' },
  { key: 'hair-change', categoryLabel: '헤어변형', brief: '헤어변형이 무엇이고 언제 정하나' },
  { key: 'honeymoon-plan', categoryLabel: '허니문', brief: '허니문 일정을 짜는 순서' },
  { key: 'contract-check', categoryLabel: '계약', brief: '계약 전에 확인할 조건' },
  { key: 'schedule-order', categoryLabel: '일정', brief: '무엇부터 정하는 것이 좋은가' },
  { key: 'guest-count', categoryLabel: '하객', brief: '하객 수를 가늠하는 법' },
  {
    key: 'stats-marriage-seoul',
    categoryLabel: '일정',
    brief: '서울 혼인 건수로 보는 결혼 준비 흐름',
    statKeys: ['seoul.marriage.count'],
  },
  {
    key: 'stats-wedding-hall-count',
    categoryLabel: '웨딩홀',
    brief: '전국 예식장 수로 보는 웨딩홀 고르기',
    statKeys: ['national.wedding_hall.count'],
  },
];

/** 통계가 표에 다 들어오지 않아 지금은 쓸 수 없는 주제의 키. */
export function topicsMissingStats(availableStatKeys: readonly string[]): string[] {
  const available = new Set(availableStatKeys);

  return WEDDING_FEED_TOPICS.filter((topic) =>
    (topic.statKeys ?? []).some((key) => !available.has(key))
  ).map((topic) => topic.key);
}

/**
 * 공개된 글이 이보다 적으면 자동 작성이 돈다.
 *
 * 홈은 두 장을 보여준다(시안 `home.txt` — 웨딩피드 카드 2장). 여유를 둬서 여덟이다 —
 * 운영자가 몇 편을 내려도 홈이 바로 비지 않는다.
 */
export const WEDDING_FEED_TARGET_PUBLISHED = 8;

/** 한 바퀴에 쓰는 편 수. 한 번에 많이 쓰면 사람이 검토를 미룬다. */
export const WEDDING_FEED_PER_RUN = 2;

export type WeddingFeedInput = {
  categoryLabel: string;
  title: string;
  summary: string;
  body: string;
  imageKey: string | null;
  /** 상세 본문 안에 보여줄 이미지. 카드 썸네일과 별도다. */
  bodyImageKey: string | null;
  status: WeddingFeedStatus;
  sortOrder: number;
};

export type WeddingFeedProblem = { field: keyof WeddingFeedInput; message: string };

/**
 * 들어온 글이 쓸 수 있는 것인지 본다.
 *
 * **비어 있는 것과 긴 것을 같은 자리에서 막는다.** 화면과 서버가 따로 막으면
 * 한쪽만 고쳐지고, 자동 작성은 화면을 거치지 않아서 서버 쪽만 남는다.
 */
export function checkWeddingFeedInput(input: WeddingFeedInput): WeddingFeedProblem[] {
  const problems: WeddingFeedProblem[] = [];
  const required: [keyof WeddingFeedInput, string, number][] = [
    ['categoryLabel', input.categoryLabel, WEDDING_FEED_LIMITS.categoryLabel],
    ['title', input.title, WEDDING_FEED_LIMITS.title],
  ];

  for (const [field, value, max] of required) {
    if (value.trim() === '') problems.push({ field, message: '비어 있어요' });
    else if (value.length > max) problems.push({ field, message: `${max}자를 넘겨요` });
  }

  /*
   * **목록 밖 이름은 받지 않는다.** 받으면 그 글은 어느 칩에도 안 들고 «전체»에서만
   * 보이는데 오류도 안 나고 관리자 표에서는 멀쩡해 보인다. 자동 작성도 이 검사를
   * 거친다 — 화면의 고르기만으로는 화면을 안 거치는 길을 못 막는다.
   */
  if (input.categoryLabel.trim() !== '' && !isWeddingFeedCategoryLabel(input.categoryLabel)) {
    problems.push({ field: 'categoryLabel', message: '목록에 없는 카테고리예요' });
  }

  if (input.summary.length > WEDDING_FEED_LIMITS.summary) {
    problems.push({ field: 'summary', message: `${WEDDING_FEED_LIMITS.summary}자를 넘겨요` });
  }

  if (input.body.length > WEDDING_FEED_LIMITS.body) {
    problems.push({ field: 'body', message: `${WEDDING_FEED_LIMITS.body}자를 넘겨요` });
  }

  if (!Number.isInteger(input.sortOrder)) {
    problems.push({ field: 'sortOrder', message: '정수여야 해요' });
  }

  return problems;
}

/**
 * 이번 바퀴에 쓸 주제를 고른다.
 *
 * 이미 쓴 주제(`used`)는 뺀다. **다 썼으면 빈 배열을 돌려준다** — 억지로 채우면
 * 같은 이야기가 두 번 올라가고, 그것은 쌓이지 않은 것보다 나쁘다.
 */
export function pickTopics(
  used: readonly string[],
  count: number
): readonly WeddingFeedTopic[] {
  const seen = new Set(used);

  return WEDDING_FEED_TOPICS.filter((topic) => !seen.has(topic.key)).slice(0, Math.max(0, count));
}

/**
 * 지금 자동 작성이 돌아야 하는가.
 *
 * 공개된 글이 목표보다 적고, 쓸 주제가 남아 있을 때만이다. **초안은 세지 않는다** —
 * 검토를 기다리는 글이 쌓여 있는데 계속 써 내면 검토가 더 밀린다.
 */
export function shouldGenerate(input: {
  publishedCount: number;
  draftCount: number;
  usedTopics: readonly string[];
}): boolean {
  if (input.publishedCount >= WEDDING_FEED_TARGET_PUBLISHED) return false;
  if (input.draftCount >= WEDDING_FEED_PER_RUN) return false;

  return pickTopics(input.usedTopics, 1).length > 0;
}

/**
 * ── 공개 목록 응답의 `tabs` ─────────────────────────────────────────────
 *
 * `/v1/wedding-feed`가 글과 함께 내려주는 칩 줄. **위 상수에서 만든다** — 표에서 읽던
 * 시절(0421 · 2026-09-16~26)에는 관리자가 고친 탭이 여기로 나갔는데, 그 값을 그리는
 * 앱 화면은 이미 없었다. 이제 앱 칩과 같은 줄이 나간다. 이미 깔린 앱이 이 칸을
 * 필수로 읽으므로 칸은 남긴다.
 *
 * 「전체」가 맨 앞이고 `categories`가 빈 배열이다 — 거르지 않는다는 뜻이다.
 */
export type WeddingFeedTab = { key: string; label: string; categories: readonly string[] };

export const WEDDING_FEED_TABS: readonly WeddingFeedTab[] = WEDDING_FEED_CHIPS.map((chip) => ({
  key: chip.key,
  label: chip.label,
  categories:
    chip.key === 'all'
      ? []
      : WEDDING_FEED_CATEGORIES.filter((category) => category.chip === chip.key).map(
          (category) => category.label
        ),
}));

/**
 * 라운지 「웨딩정보」가 한 번에 받는 공개 글 수.
 *
 * **여덟에서 늘렸다.** 라운지가 수를 안 적고 부르면 서버 기본값(자동 작성 목표
 * `WEDDING_FEED_TARGET_PUBLISHED` = 8)이 걸려, 관리자가 아홉째 글을 공개해도 앱
 * 목록에는 안 나왔다 — 관리자 표에는 «공개»로 떠 있는데. 목록 화면은 공개된 글을
 * 전부 보여주는 자리라 넉넉히 받는다.
 */
export const WEDDING_FEED_LOUNGE_LIMIT = 100;
