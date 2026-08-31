import { VENDOR_CATEGORIES, VENDOR_CATEGORY_LABEL, type VendorCategory } from './vendor';

/**
 * Pick. 통합정책 v3.2 §6~7.
 *
 * `관심업체`를 대체한다 — 이름만 바꾼 것이 아니라 **끝이 생겼다.** 예전에는
 * 담아두는 것으로 끝났고, 담은 목록은 시간이 지나도 줄지 않았다. 이제 업종마다
 * 하나를 정하고 그 업종은 닫힌다.
 *
 *   `Pick → 비교 → 공동결정 → 최종 결정 → 준비 완료`
 *
 * 앞의 셋은 후보를 들고 있는 동안의 일이고, 최종 결정부터가 결론이다.
 */

/** 업종 하나가 지금 어디까지 왔는가. v3.2 §7. */
export const PREPARATION_STATES = ['before', 'picking', 'decided'] as const;

export type PreparationState = (typeof PREPARATION_STATES)[number];

export const PREPARATION_STATE_LABEL: Record<PreparationState, string> = {
  before: '준비 전',
  picking: '후보 Pick 중',
  decided: '결정 완료',
};

/**
 * 누가 Pick했는가. v3.2 §6.
 *
 * **둘 다 Pick한 곳을 따로 세는 것이 요점이다.** 각자 담은 것만 구분하면
 * 목록이 두 개가 되고, 두 사람이 같은 곳을 마음에 들어 했다는 사실이 어디에도
 * 안 남는다 — 그게 대화를 시작하기 가장 좋은 자리인데.
 */
export const PICK_OWNERS = ['mine', 'spouse', 'both'] as const;

export type PickOwner = (typeof PICK_OWNERS)[number];

export const PICK_OWNER_LABEL: Record<PickOwner, string> = {
  mine: '내가 Pick',
  spouse: '배우자가 Pick',
  both: '둘 다 Pick',
};

/**
 * 한 사람이 담았는지 둘 다 담았는지.
 *
 * 지금 자료 구조에서 한 업체는 웨딩에 한 줄뿐이라(0026의 UNIQUE) 담은 사람은
 * 하나다. 그래서 `both`는 **양쪽이 같은 곳을 담으려 한 흔적**으로만 나온다 —
 * 아래 `secondPickerId`가 그 흔적이고, 없으면 담은 사람 한쪽이다.
 */
export function pickOwner(input: {
  addedBy: string | null;
  secondPickerId?: string | null;
  viewerId: string;
}): PickOwner {
  if (input.secondPickerId && input.secondPickerId !== input.addedBy) return 'both';

  return input.addedBy === input.viewerId ? 'mine' : 'spouse';
}

/**
 * 비교할 수 있는가. v3.2 §6 — 같은 업종에서 2곳 이상이면 바로 비교한다.
 *
 * 한 곳만 담아두고 비교 버튼을 눌렀을 때 "비교할 것이 없어요"가 뜨는 것보다,
 * 버튼이 그때까지 눌리지 않는 편이 낫다.
 */
export const MIN_COMPARABLE = 2;

export function canCompare(pickCount: number): boolean {
  return pickCount >= MIN_COMPARABLE;
}

/** 비교하기 어려울 때 하는 말. v3.3의 표준 문구. */
export const CANNOT_COMPARE = '아직 비교하기 어려워요';

/** 업종 하나의 Pick 현황. */
export type CategoryProgress = {
  category: VendorCategory;
  label: string;
  state: PreparationState;
  pickCount: number;
  decidedVendorId: string | null;
};

/**
 * 다음에 무엇을 준비할지 고른다. v3.2 §6 마지막 줄.
 *
 * **후보를 담다 만 업종이 먼저다.** 이미 고르기 시작한 일을 끝내는 것이,
 * 손대지 않은 일을 새로 여는 것보다 사용자에게 가깝다. 그 다음이 아직 시작하지
 * 않은 업종이고, 순서는 업종 목록의 순서를 따른다.
 *
 * 다 정했으면 null이다 — 없는 다음을 지어내지 않는다.
 */
export function nextCategory(progress: readonly CategoryProgress[]): VendorCategory | null {
  const rank = (state: PreparationState): number =>
    state === 'picking' ? 0 : state === 'before' ? 1 : 2;

  const open = progress
    .filter((row) => row.state !== 'decided')
    .sort(
      (a, b) =>
        rank(a.state) - rank(b.state) ||
        VENDOR_CATEGORIES.indexOf(a.category) - VENDOR_CATEGORIES.indexOf(b.category)
    );

  return open[0]?.category ?? null;
}

/**
 * 홈에 적는 진행률. v3.3이 `9/20 완료` 꼴로 정했다.
 *
 * 분모는 업종 수다 — 담은 후보 수를 분모로 쓰면 많이 담을수록 진행률이 떨어지고,
 * 그건 열심히 한 사람을 벌주는 셈이다.
 */
export function preparationProgress(progress: readonly CategoryProgress[]): {
  decided: number;
  total: number;
  label: string;
} {
  const decided = progress.filter((row) => row.state === 'decided').length;

  return { decided, total: progress.length, label: `${decided}/${progress.length} 완료` };
}

export function categoryProgressLabel(category: VendorCategory): string {
  return VENDOR_CATEGORY_LABEL[category];
}
