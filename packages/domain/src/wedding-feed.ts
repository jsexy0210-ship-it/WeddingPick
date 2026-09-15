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
 * 자동 작성이 고르는 주제.
 *
 * **자유롭게 쓰게 두지 않는다.** 주제를 모델이 정하면 같은 이야기가 다른 제목으로
 * 반복되고, 그것을 사람이 목록에서 발견하기까지 오래 걸린다. 여기 목록에서 고르고,
 * **이미 쓴 주제는 후보에서 빠진다**(`pickTopics`).
 *
 * 업종 이름은 정본을 쓴다 — 본식스냅 · 헤어변형 · 결정사(CLAUDE.md 2026-09-11).
 */
export type WeddingFeedTopic = {
  key: string;
  /** 카드 위 작은 줄에 그대로 들어간다. */
  categoryLabel: string;
  /** 모델에게 주는 한 줄. 무엇을 쓸 글인지. */
  brief: string;
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
  { key: 'info-company', categoryLabel: '결정사', brief: '결정사를 쓸 때 확인할 것' },
  { key: 'honeymoon-plan', categoryLabel: '허니문', brief: '허니문 일정을 짜는 순서' },
  { key: 'contract-check', categoryLabel: '계약', brief: '계약서에서 확인할 조항' },
  { key: 'schedule-order', categoryLabel: '준비 순서', brief: '무엇부터 정하는 것이 좋은가' },
  { key: 'guest-count', categoryLabel: '하객', brief: '하객 수를 가늠하는 법' },
];

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
