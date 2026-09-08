/**
 * 홈 Priority Engine. 통합정책 v3.10 §3·IA §4.
 *
 * 홈의 대표 자리는 **하나**다. 무엇을 거기 둘지를 이 파일이 정한다.
 *
 * 하는 일은 고르기뿐이다 — 후보를 만들지 않는다. 화면이 잴 수 있는 것만 후보로
 * 넘기고, 여기서는 정책이 정한 순서대로 첫 번째를 집는다. 이렇게 갈라두는 이유:
 *
 *   1. **못 재는 것을 지어내지 않게 된다.** 후보를 여기서 만들면 신호가 없는
 *      자리를 그럴듯한 문장으로 채우고 싶어진다. 넘겨받기만 하면 신호가 없는
 *      종류는 그냥 안 온다.
 *   2. 순서는 정책이고 후보는 데이터다. 정책이 바뀌면 이 파일만 고친다.
 */

/**
 * 우선순위. 앞이 먼저다.
 *
 * `긴급 일정 → 다음 할 일 → Pick 후보 → 커플 공통취향 → 예산 → 혜택·정보변경 →
 * 일반 추천`. "유효 추천이 없으면 다음 일정으로 fallback"은 이 순서가 이미
 * 지킨다 — 다음 할 일이 둘째라, 추천이 하나도 없으면 그것이 남는다.
 *
 * **가격 TOP3 분기는 없다.** 홈 C-1이 "웨딩픽 추천과 경쟁하는 가격 TOP3 섹션을
 * 홈에 두지 않는다"고 정했고, 대표 자리도 같은 규칙을 따른다. TOP3 성격의
 * 탐색은 검색 영역에 있다.
 */
export const PRIORITY_KINDS = [
  /** 지난 일정, 또는 곧 닥친 일정. */
  'urgent_task',
  /** 다음 할 일. 유효 추천이 없을 때 남는 자리이기도 하다. */
  'next_task',
  /** 두 곳 이상 Pick해둔 업종. 견줘볼 수 있는 상태다. */
  'pick_candidate',
  /**
   * 커플 공통취향.
   *
   * **아직 이 종류는 만들어지지 않는다.** 취향은 이미지 Pick과 행동으로 점진
   * 학습한다고 정책이 정했는데(v3.10 §8) 그 수집이 아직 없다. 자리를 비워둔
   * 채로 순서에 남겨둔다 — 신호가 생기는 날 여기에 꽂으면 된다.
   */
  'couple_taste',
  /** 예산. 총예산을 안 정했거나, 쓴 돈이 예산을 넘었을 때. */
  'budget',
  /** Pick한 곳의 혜택이나 정보가 바뀜. */
  'benefit_change',
  /** 일반 큐레이션. */
  'curation',
] as const;

export type PriorityKind = (typeof PRIORITY_KINDS)[number];

/**
 * 홈 대표 자리에 놓을 후보 하나.
 *
 * `title`은 무엇을 할지, `detail`은 그 근거다. 둘이 같은 말을 하면 안 된다 —
 * 정책이 "Hero와 Next Action의 의미 중복을 금지한다"고 적었다.
 */
export type PriorityItem = {
  kind: PriorityKind;
  title: string;
  detail: string | null;
  /** 누르면 갈 곳. 화면이 정한다. */
  action: string;
  actionLabel: string;
};

const ORDER = new Map<PriorityKind, number>(PRIORITY_KINDS.map((kind, index) => [kind, index]));

/**
 * 후보 중 하나를 고른다. 없으면 null.
 *
 * 같은 종류가 여럿이면 **먼저 넘어온 것**을 쓴다. 종류 안에서 무엇이 더 급한지는
 * 그 값을 아는 쪽(화면·서버)이 정할 일이지 여기서 다시 견줄 일이 아니다.
 */
export function topPriority(items: readonly PriorityItem[]): PriorityItem | null {
  let best: PriorityItem | null = null;
  let bestRank = Number.POSITIVE_INFINITY;

  for (const item of items) {
    const rank = ORDER.get(item.kind);

    if (rank === undefined) continue;

    if (rank < bestRank) {
      best = item;
      bestRank = rank;
    }
  }

  return best;
}

/**
 * 지난 일정과 곧 닥친 일정을 가르는 날 수.
 *
 * 7일인 이유: 결혼 준비 일정은 주 단위로 움직인다. 하루로 잡으면 전날에야
 * 급해지고, 한 달로 잡으면 늘 급한 상태가 되어 급하다는 말이 뜻을 잃는다.
 */
export const URGENT_WITHIN_DAYS = 7;

/** 이 일정이 지금 급한가. `dueInDays`가 음수면 이미 지난 것이다. */
export function isUrgent(dueInDays: number | null): boolean {
  return dueInDays !== null && dueInDays <= URGENT_WITHIN_DAYS;
}
