import { nextCategory, type CategoryProgress } from './pick';
import {
  PREPARATION_CATEGORIES,
  PREPARATION_GROUPS,
  VENDOR_CATEGORY_LABEL,
  type PreparationGroupKey,
  type VendorCategory,
} from './vendor';
import { WEDDING_FEED_TOPICS } from './wedding-feed';
import { TASK_PRESETS, TENTATIVE_DAYS_BEFORE } from './wedding-plan';

/**
 * 준비 단계 — 홈 「웨딩 준비 팁」이 지금 무엇부터 읽힐지를 정하는 값.
 *
 * 2026-09-26 대표 오더 「웨딩 준비 팁 — 준비단계에 맞춰 콘텐츠를 추천한다」. 최신 글 두 편이
 * 아니라 **그 사람이 지금 서 있는 자리의 글**이 먼저 온다. 사용자 화면에는 이 값의 이름을
 * 적지 않는다 — 섹션 제목은 그대로 「웨딩 준비 팁」이고 카드 모양도 그대로다. 바뀌는 것은
 * 어느 글이 앞에 서는가 하나다.
 *
 * **새로 묻지 않는다.** 이미 있는 셋만 본다.
 *
 *   예식일        남은 날(D-day). 예식일 기준 임시 날짜(`TENTATIVE_DAYS_BEFORE`)의 경계로 자른다
 *   업종별 상태   앱에서 정한 것 · 준비 현황(온보딩 3/5)에서 «이미 정했다» · 후보를 담는 중
 *   임시 일정     기본 할 일(`TASK_PRESETS`)의 임시 날짜가 이미 온 미정 업종이 먼저다
 *
 * 지금 정하는 업종(`current`)은 서버의 `nextCategory`(홈 히어로 · Pick 탭이 보는 것)와 같은
 * 규칙이다 — 히어로가 «드레스 차례예요»라고 하는데 팁이 웨딩홀 글이면 둘 중 하나가 틀린 말이다.
 */

export const PREPARATION_STAGE_KEYS = [
  /** 아무것도 안 정했고, 예식일이 없거나 웨딩홀 계약 임시 날짜(D-300)보다 앞이다. */
  'early',
  /** 지금 정하는 업종이 「시작 준비」(웨딩홀)다. */
  'start',
  /** 지금 정하는 업종이 「스드메」(스튜디오 · 드레스 · 메이크업 · 헤어변형)다. */
  'sdm',
  /** 지금 정하는 업종이 「본식 준비」(본식스냅 · 부케 · 청첩장)다. */
  'ceremony',
  /** 지금 정하는 업종이 「예물 · 신혼」(예물 · 혼수 · 허니문)이다. */
  'goods',
  /** 식순 · 사회자 확정 임시 날짜(D-30) 안쪽. 업종보다 마지막 확인이 먼저다. */
  'final',
  /** 업종을 다 정했고 아직 D-30 밖이다. */
  'wrapup',
  /** 예식일이 지났다. 고를 기준이 없어 원래 순서(최신)를 그대로 둔다. */
  'after',
] as const;

export type PreparationStageKey = (typeof PREPARATION_STAGE_KEYS)[number];

/**
 * 웨딩피드 글 하나가 맞는지 보는 조건. **토픽**(자동 작성 글만 가진다)이나 **카테고리 이름**
 * (모든 글이 가진다) 중 하나다. 직접 쓴 글은 토픽이 없어 카테고리로만 걸린다.
 */
export type StageFeedMatch = { topic: string } | { label: string };

export type PreparationStage = {
  key: PreparationStageKey;
  /** 지금 정하는 업종. 다 정했으면 null. */
  current: VendorCategory | null;
  /** 임시 날짜가 이미 온(지난) 미정 업종 — 임시 날짜가 이른 것부터. 예식일이 없으면 비어 있다. */
  due: readonly VendorCategory[];
  /** 웨딩피드에서 먼저 세울 것. 앞에 있을수록 먼저다. */
  feed: readonly StageFeedMatch[];
  /** 이 단계에서는 철 지난 토픽. 카테고리가 맞아도 맞지 않는 글과 같이 뒤로 보낸다. */
  staleTopics: readonly string[];
};

export type PreparationStageInput = {
  /** 예식일까지 남은 날(한국 날짜 기준). 예식일을 안 정했으면 null. */
  daysLeft: number | null;
  /**
   * 정한 업종 — 앱에서 결정한 것(`category_decisions`)과 준비 현황에서 «이미 정했다»고
   * 고른 것(`prepared_categories`)을 합친 것. 홈 준비 현황 4칸이 「완료」로 적는 그 집합이다.
   */
  decided: readonly VendorCategory[];
  /** 후보를 담는 중인 업종(`wedding_preparation.state = 'picking'`). */
  picking: readonly VendorCategory[];
};

/* ------------------------------------------------------------ 임시 일정의 경계 */

/** 기본 할 일 하나의 임시 날짜 — 예식일 며칠 앞인가. 표에 없으면 null. */
function presetLeadDays(key: string): number | null {
  const preset = TASK_PRESETS.find((row) => row.key === key);

  return preset === undefined ? null : (TENTATIVE_DAYS_BEFORE[preset.label] ?? null);
}

/**
 * 업종마다 손대기 시작하는 임시 날짜 — 그 업종의 기본 할 일 가운데 가장 이른 것.
 * 웨딩홀은 「웨딩홀 계약」(D-300)이고 잔금(D-7)이 아니다. 기본 할 일이 없는 업종
 * (헤어변형 · 부케 · 혼수)은 null — 없는 날짜를 지어내지 않는다.
 */
export function categoryLeadDays(category: VendorCategory): number | null {
  let lead: number | null = null;

  for (const preset of TASK_PRESETS) {
    if (preset.category !== category) continue;
    const days = TENTATIVE_DAYS_BEFORE[preset.label];

    if (days !== undefined && (lead === null || days > lead)) lead = days;
  }

  return lead;
}

/** 이보다 멀면 아직 웨딩홀도 급하지 않다 — 「웨딩홀 계약」의 임시 날짜(D-300). */
export const EARLY_STAGE_AFTER_DAYS = categoryLeadDays('hall') ?? 0;

/** 이 안쪽이면 업종보다 마지막 확인이 먼저다 — 「식순·사회자 확정」의 임시 날짜(D-30). */
export const FINAL_STAGE_WITHIN_DAYS = presetLeadDays('ceremony_order') ?? 0;

/* ------------------------------------------------------------ 웨딩피드 카테고리 */

/**
 * 업종이 아닌 웨딩피드 카테고리. **이름을 여기 적지 않는다** — 카테고리 이름의 원본은
 * 웨딩피드 쪽 상수이고(지금은 `WEDDING_FEED_TOPICS`의 `categoryLabel`), 여기서는 토픽 키로
 * 그 상수를 거쳐 읽는다. 업종 카테고리는 `VENDOR_CATEGORY_LABEL`을 거친다.
 *
 *   order      준비 순서     (schedule-order)
 *   budget     예산          (budget-sdm)
 *   guests     하객          (guest-count)
 *   contract   계약          (contract-check)
 *   checklist  체크리스트    (checklist-4m)
 */
export const STAGE_FEED_SUBJECT_TOPIC = {
  order: 'schedule-order',
  budget: 'budget-sdm',
  guests: 'guest-count',
  contract: 'contract-check',
  checklist: 'checklist-4m',
} as const;

type Subject = keyof typeof STAGE_FEED_SUBJECT_TOPIC;

function topicLabel(key: string): string | null {
  return WEDDING_FEED_TOPICS.find((topic) => topic.key === key)?.categoryLabel ?? null;
}

const topic = (key: string): StageFeedMatch[] => [{ topic: key }];
const subject = (name: Subject): StageFeedMatch[] => {
  const label = topicLabel(STAGE_FEED_SUBJECT_TOPIC[name]);

  return label === null ? [] : [{ label }];
};
const vendor = (categories: readonly VendorCategory[]): StageFeedMatch[] =>
  categories.map((category) => ({ label: VENDOR_CATEGORY_LABEL[category] }));

function groupOf(category: VendorCategory): PreparationGroupKey | null {
  return PREPARATION_GROUPS.find((group) => group.categories.includes(category))?.key ?? null;
}

/** 같은 조건이 두 번 서면 뒤의 것은 아무 일도 안 한다 — 읽는 사람이 헷갈리지 않게 뺀다. */
function unique(matches: readonly StageFeedMatch[]): StageFeedMatch[] {
  const seen = new Set<string>();

  return matches.filter((match) => {
    const id = 'topic' in match ? `topic:${match.topic}` : `label:${match.label}`;

    if (seen.has(id)) return false;
    seen.add(id);

    return true;
  });
}

/* ------------------------------------------------------------ 단계 */

/**
 * 지금 준비 단계.
 *
 *   예식일이 지났다                                   after
 *   D-30 안쪽                                         final
 *   다 정했다                                         wrapup
 *   아무것도 안 정했고 · 예식일이 없거나 D-300 밖이다   early
 *   그 밖                                             지금 정하는 업종의 준비 현황 그룹
 *                                                     (start · sdm · ceremony · goods)
 */
export function preparationStage(input: PreparationStageInput): PreparationStage {
  const decided = new Set(input.decided.filter((category) => PREPARATION_CATEGORIES.includes(category)));
  const picking = new Set(
    input.picking.filter((category) => PREPARATION_CATEGORIES.includes(category) && !decided.has(category))
  );

  const progress: CategoryProgress[] = PREPARATION_CATEGORIES.map((category) => ({
    category,
    label: VENDOR_CATEGORY_LABEL[category],
    state: decided.has(category) ? 'decided' : picking.has(category) ? 'picking' : 'before',
    pickCount: picking.has(category) ? 1 : 0,
    decidedVendorId: null,
  }));
  const current = nextCategory(progress);
  const open = PREPARATION_CATEGORIES.filter((category) => !decided.has(category));

  const daysLeft = input.daysLeft;
  const due =
    daysLeft === null
      ? []
      : open
          .filter((category) => {
            const lead = categoryLeadDays(category);

            return lead !== null && daysLeft <= lead;
          })
          .sort((a, b) => (categoryLeadDays(b) ?? 0) - (categoryLeadDays(a) ?? 0));

  const key = stageKey({ daysLeft, current, untouched: decided.size === 0 && picking.size === 0 });

  return {
    key,
    current,
    due,
    feed: stageFeed({ key, current, open, due }),
    staleTopics: key === 'final' ? ['checklist-4m'] : [],
  };
}

function stageKey(input: {
  daysLeft: number | null;
  current: VendorCategory | null;
  untouched: boolean;
}): PreparationStageKey {
  const { daysLeft, current, untouched } = input;

  if (daysLeft !== null && daysLeft < 0) return 'after';
  if (daysLeft !== null && daysLeft <= FINAL_STAGE_WITHIN_DAYS) return 'final';
  if (current === null) return 'wrapup';
  if (untouched && (daysLeft === null || daysLeft > EARLY_STAGE_AFTER_DAYS)) return 'early';

  return groupOf(current) ?? 'start';
}

/**
 * 단계 → 먼저 세울 웨딩피드 카테고리 · 토픽. 표로 적으면 이렇다(업종 이름은 예시).
 *
 *   early     준비 순서 · 예산(웨딩홀 비용 토픽 먼저) · 웨딩홀 · 하객
 *   start     웨딩홀 · 하객 · 예산(웨딩홀 비용 토픽 먼저) · 계약 · 임시 날짜가 온 다른 업종
 *   sdm       지금 업종 · 스드메 예산 토픽 · 같은 그룹의 남은 업종 · 계약 · 예산 · 임시 날짜가 온 다른 업종
 *   ceremony  지금 업종 · 같은 그룹의 남은 업종 · 4개월 전 체크리스트 토픽 · 하객 · 계약 · 임시 날짜가 온 다른 업종
 *   goods     (ceremony와 같다)
 *   final     한 달 전 체크리스트 토픽 · 체크리스트 · 하객 · 계약 · 남은 업종   (4개월 전 체크리스트는 철 지남)
 *   wrapup    4개월 전 체크리스트 토픽 · 체크리스트 · 하객 · 계약 · 예산
 *   after     없음 — 원래 순서
 *
 * 같은 그룹의 남은 업종과 남은 업종은 **임시 날짜가 온 것부터** 선다.
 */
function stageFeed(input: {
  key: PreparationStageKey;
  current: VendorCategory | null;
  open: readonly VendorCategory[];
  due: readonly VendorCategory[];
}): StageFeedMatch[] {
  const { key, current, open, due } = input;
  const dueFirst = (categories: readonly VendorCategory[]) => [
    ...due.filter((category) => categories.includes(category)),
    ...categories.filter((category) => !due.includes(category)),
  ];
  const currentGroup = current === null ? null : groupOf(current);
  const sameGroup = dueFirst(
    open.filter((category) => category !== current && groupOf(category) === currentGroup)
  );
  const otherDue = due.filter((category) => category !== current && !sameGroup.includes(category));
  const now = current === null ? [] : [current];

  switch (key) {
    case 'early':
      return unique([
        ...topic('schedule-order'),
        ...subject('order'),
        ...topic('budget-hall'),
        ...subject('budget'),
        ...vendor(['hall']),
        ...subject('guests'),
      ]);
    case 'start':
      return unique([
        ...vendor(now),
        ...subject('guests'),
        ...topic('budget-hall'),
        ...subject('contract'),
        ...subject('budget'),
        ...vendor(otherDue),
      ]);
    case 'sdm':
      return unique([
        ...vendor(now),
        ...topic('budget-sdm'),
        ...vendor(sameGroup),
        ...subject('contract'),
        ...subject('budget'),
        ...vendor(otherDue),
      ]);
    case 'ceremony':
    case 'goods':
      return unique([
        ...vendor(now),
        ...vendor(sameGroup),
        ...topic('checklist-4m'),
        ...subject('guests'),
        ...subject('contract'),
        ...vendor(otherDue),
      ]);
    case 'final':
      return unique([
        ...topic('checklist-1m'),
        ...subject('checklist'),
        ...subject('guests'),
        ...subject('contract'),
        ...vendor(dueFirst(open)),
      ]);
    case 'wrapup':
      return unique([
        ...topic('checklist-4m'),
        ...subject('checklist'),
        ...subject('guests'),
        ...subject('contract'),
        ...subject('budget'),
      ]);
    case 'after':
      return [];
  }
}

/* ------------------------------------------------------------ 줄 세우기 */

/** 웨딩피드 글에서 단계가 보는 두 칸. 서버의 행이든 계약의 항목이든 이 둘만 있으면 된다. */
export type StageRankablePost = { categoryLabel: string; topic: string | null };

const UNMATCHED = Number.MAX_SAFE_INTEGER;

/**
 * 공개된 글을 단계에 맞춰 다시 세운다. **빼지 않고 순서만 바꾼다** — 글이 한 편이라도 있으면
 * 섹션이 비지 않는다. 맞는 글이 하나도 없으면 원래 순서(운영자 순서 · 최신) 그대로다.
 *
 *   1. 단계 조건에 맞는 글 — 조건이 앞에 있을수록 먼저. **카테고리마다 첫 글만** 여기 선다.
 *   2. 맞지만 앞에서 같은 카테고리가 이미 선 글 — 홈은 두 장만 보여서, 같은 카테고리 두 장보다
 *      서로 다른 두 가지가 지금 단계를 더 넓게 덮는다.
 *   3. 맞지 않는 글 · 철 지난 토픽의 글 — 원래 순서.
 *
 * 같은 자리끼리는 원래 순서를 지킨다(운영자가 정한 `sort_order` → 공개 최신).
 */
export function rankFeedForStage<T extends StageRankablePost>(
  posts: readonly T[],
  stage: PreparationStage | null
): T[] {
  if (stage === null || stage.feed.length === 0) return [...posts];

  const stale = new Set(stage.staleTopics);
  const rankOf = (post: T): number => {
    if (post.topic !== null && stale.has(post.topic)) return UNMATCHED;

    const label = post.categoryLabel.trim();
    const index = stage.feed.findIndex((match) =>
      'topic' in match ? match.topic === post.topic : match.label === label
    );

    return index === -1 ? UNMATCHED : index;
  };

  const ranked = posts
    .map((post, order) => ({ post, order, rank: rankOf(post) }))
    .sort((a, b) => a.rank - b.rank || a.order - b.order);

  const seenLabels = new Set<string>();
  const tiered = ranked.map((row) => {
    if (row.rank === UNMATCHED) return { ...row, tier: 2 };

    const label = row.post.categoryLabel.trim();
    const tier = seenLabels.has(label) ? 1 : 0;

    seenLabels.add(label);

    return { ...row, tier };
  });

  return tiered
    .sort((a, b) => a.tier - b.tier || a.rank - b.rank || a.order - b.order)
    .map((row) => row.post);
}
