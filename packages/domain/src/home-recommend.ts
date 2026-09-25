import { formatCount } from './format-number';
import { PREPARATION_CATEGORIES, VENDOR_CATEGORY_LABEL, type VendorCategory } from './vendor';
import { MIN_COMPARABLE, type PreparationState } from './pick';

/**
 * Pick 추천 — 홈과 「웨딩픽 추천」 전체 페이지가 함께 쓰는 규칙(2026-09-15 대표 사양 §4~§15).
 *
 * 업종 하나가 지금 어디까지 왔는지를 **여섯 값**으로 말한다. 앞선 `PreparationState`
 * (`before` · `picking` · `decided`) 셋을 대체하지 않는다 — 그쪽은 서버가 저장하는 값이고
 * 이쪽은 **화면이 무엇을 보여줄지**를 정하는 값이다. 셋에서 여섯을 만드는 규칙이
 * `categoryPickState` 하나뿐이라, 홈과 전체 페이지가 다른 상태를 보여줄 길이 없다.
 */

export const CATEGORY_PICK_STATES = [
  'NOT_STARTED',
  'EXPLORING',
  'SHORTLISTED',
  'COMPARING',
  'DECIDED',
  'SKIPPED',
] as const;

export type CategoryPickState = (typeof CATEGORY_PICK_STATES)[number];

/**
 * 셋에서 여섯으로. **지금 실제로 만들어지는 것은 넷이다.**
 *
 * `EXPLORING`은 「업체 보는 중 · Pick 없음」인데, **조회 기록을 어디에도 저장하지 않는다** —
 * 마이그레이션 전체(0001~0410)에 `vendor_views` 류의 표가 하나도 없다. 그래서 「보긴 했다」와
 * 「손도 안 댔다」를 가를 수 없고 둘 다 `NOT_STARTED`로 나온다. 화면 문구는 어차피 둘 다
 * `[추천]`이라 사용자에게는 같아 보인다(2026-09-15 확정).
 *
 * **본 기록이 생기면 여기서 갈린다** — 그때 `viewed` 한 칸을 받아 `EXPLORING`을 돌려주면
 * 된다. 정렬 순위(`STATE_RANK`)와 액션 라벨은 이미 그 값을 알고 있다.
 *
 * `SKIPPED`는 「이 준비는 안 할래요」인데 **그것을 정하는 화면이 없다.** 값을 만들 길이
 * 없으므로 이 함수는 절대 돌려주지 않는다 — 타입에만 남겨 노출 규칙이 이름으로 제외할 수
 * 있게 한다. 상태를 만들면 그것을 켜고 끄는 화면도 만들어야 하고, 그건 이번 범위가 아니다.
 */
export function categoryPickState(input: {
  /** 서버가 내려준 준비 상태(`wedding_preparation.state`). */
  state: PreparationState;
  /** 그 업종에 담아둔 후보 수. */
  pickCount: number;
  /** 온보딩 준비 현황에서 「이미 정했다」고 고른 업종인가. */
  prepared?: boolean;
}): CategoryPickState {
  if (input.state === 'decided' || input.prepared === true) return 'DECIDED';
  if (input.pickCount >= MIN_COMPARABLE) return 'COMPARING';
  if (input.pickCount > 0) return 'SHORTLISTED';

  return 'NOT_STARTED';
}

/**
 * 카테고리 줄 오른쪽 액션. 사양 §5 — 카테고리명과 **같은 줄**에 선다.
 *
 * 없는 상태(`DECIDED` · `SKIPPED`)는 애초에 목록에 서지 않으므로 null이다.
 *
 * **「추천 3곳」처럼 개수를 붙이지 않는다**(사양 §4 금지).
 */
export const CATEGORY_ACTION_LABEL: Record<CategoryPickState, string | null> = {
  NOT_STARTED: '추천',
  EXPLORING: '추천',
  SHORTLISTED: '보기',
  COMPARING: '비교',
  DECIDED: null,
  SKIPPED: null,
};

/** Pick 추천에 서는 상태. `DECIDED` · `SKIPPED`는 빠진다(사양 §7 · §11). */
export function showsInRecommend(state: CategoryPickState): boolean {
  return CATEGORY_ACTION_LABEL[state] !== null;
}

/**
 * 상태 순위. 사양 §11 — ① COMPARING ② SHORTLISTED ③ EXPLORING ④ NOT_STARTED.
 *
 * 먼저 고른 것을 끝내는 쪽이 새로 여는 쪽보다 사용자에게 가깝다(`pick.ts` `nextCategory`와
 * 같은 생각이다).
 */
const STATE_RANK: Record<CategoryPickState, number> = {
  COMPARING: 0,
  SHORTLISTED: 1,
  EXPLORING: 2,
  NOT_STARTED: 3,
  DECIDED: 4,
  SKIPPED: 5,
};

/**
 * 같은 상태 안의 순서는 **준비 순서**(`PREPARATION_CATEGORIES`)다.
 *
 * 사양 §11이 「웨딩 준비 순서 / 예식일까지 남은 기간을 반영」하라고 적었는데, 그 둘은 이
 * 저장소에서 같은 것이다 — 준비 순서가 이미 예식일에서 역산한 차례다(웨딩홀이 먼저 정해져야
 * 날짜와 예산이 잡히고, 허니문이 맨 뒤다). **예식일로 따로 가중치를 만들지 않는다** — 며칠
 * 남았다고 드레스가 웨딩홀보다 급해지지는 않는다.
 */
export function compareRecommendCategories(
  a: { category: VendorCategory; state: CategoryPickState },
  b: { category: VendorCategory; state: CategoryPickState }
): number {
  return (
    STATE_RANK[a.state] - STATE_RANK[b.state] ||
    PREPARATION_CATEGORIES.indexOf(a.category) - PREPARATION_CATEGORIES.indexOf(b.category)
  );
}

/** 홈 Pick 추천에 세우는 업종 수. 나머지는 「다음 준비」 요약과 전체 페이지가 맡는다. */
export const HOME_RECOMMEND_CATEGORIES = 3;

/** 업종 하나에 보여주는 추천 업체 수(사양 §6 · §12). */
export const RECOMMEND_VENDORS_PER_CATEGORY = 3;

/**
 * Pick 화면 준비 묶음 하나에 보여주는 «내 조건에 맞는 곳» 수(2026-09-25 대표 지시 — 「Pick 메뉴
 * 카테고리별로 각각 5개씩 배치한다」). 담아둔 후보와는 따로 센다.
 */
export const PICK_RECOMMEND_VENDORS_PER_GROUP = 5;

/** 「다음 준비」 요약에 이름을 늘어놓는 최대 개수. 넘으면 「외 N개」로 접는다. */
export const NEXT_STEPS_NAMED = 4;

/**
 * 「스튜디오 · 메이크업 · 예물 · 허니문 외 3개」 — 사양 §9.
 *
 * 넷까지는 이름을 적고 나머지는 센다. 빈 배열이면 null — 남은 준비가 없으면 그 자리를
 * 그리지 않는다.
 */
export function nextStepsSummary(categories: readonly VendorCategory[]): string | null {
  if (categories.length === 0) return null;

  const named = categories.slice(0, NEXT_STEPS_NAMED).map((category) => VENDOR_CATEGORY_LABEL[category]);
  const rest = categories.length - named.length;

  return rest > 0 ? `${named.join(' · ')} 외 ${formatCount(rest)}개` : named.join(' · ');
}

/** 「아직 결정하지 않은 준비가 7개 있어요」 — 사양 §9. 숫자는 `formatCount`를 거친다. */
export function nextStepsCountLine(remaining: number): string {
  return `아직 결정하지 않은 준비가 ${formatCount(remaining)}개 있어요`;
}
