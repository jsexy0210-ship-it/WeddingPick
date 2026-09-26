import { PREPARATION_NOT_STARTED_LABEL, VENDOR_CATEGORY_LABEL } from '@weddingpick/domain';

import type { WheelOption } from '@/features/common/wheel-picker-sheet';
import { PREP_CARDS, type PrepCard, type PreparedCategory, isPrepCardSelected } from '@/features/onboarding/flow';

/**
 * 내 웨딩설정(WP-MY-003)의 1열 휠 보기 — 2026-09-26 대표 지시 「모든 항목을 휠 바텀시트로 ·
 * 날짜 외에는 1열 휠」.
 *
 * **정본에는 이 화면의 편집 시트 그림이 없다**(my.jsx frame-003은 행만 그린다). 그래서
 * 보기는 새로 짓지 않고 **온보딩이 받는 답 그대로**를 1열로 늘어놓는다 — 보기 묶음 자체가
 * `DESIGN_UNRESOLVED`다.
 *
 *   준비 현황 온보딩 3/5 카드 넷(`PREP_CARDS`)의 답이 될 수 있는 모든 것 — 없음 하나 + 조합 열다섯
 *
 * 준비 현황은 여러 개를 고르는 질문이라 1열 휠에서는 **조합 하나를 한 칸**으로 둔다. 휠은 한 번에
 * 하나만 가리키므로, 조합을 칸으로 세우지 않으면 두 번째 카드를 고를 길이 없다. 칸의 글자는 요약
 * 줄(정본 weddingSet v 「웨딩홀」)과 같은 꼴이다.
 *
 * 예산은 여기 없다 — 2026-09-26 대표 지시 「MY 내 웨딩설정에서 예산은 삭제한다」로 행째 뺐다.
 *
 * 스타일은 여기 없다 — 2026-09-26 「개수제한 없다」로 1~4개 조합(열다섯)이 되어 휠 칸으로는
 * 너무 많고, 다중 선택 시트(`style-pick-sheet.tsx`)로 고른다.
 */

/* ------------------------------------------------------------------ 준비 현황 */

/** 조합의 저장 키 — `PREP_CARDS` 순서로 카드 키를 `+`로 잇는다. 아무것도 없으면 `none`. */
export type PrepComboKey = string;

export const PREP_NONE_KEY: PrepComboKey = 'none';

function prepKey(cards: readonly PrepCard[]): PrepComboKey {
  return cards.length === 0 ? PREP_NONE_KEY : cards.map((card) => card.key).join('+');
}

/** «아직 시작 전이에요»를 맨 앞에, 그다음 카드 1개 · 2개 · 3개 · 4개 순 — 같은 수 안에서는 카드 순서. */
export function prepCombos(): readonly (readonly PrepCard[])[] {
  const combos: PrepCard[][] = [[]];

  for (let size = 1; size <= PREP_CARDS.length; size += 1) {
    combos.push(...choose(PREP_CARDS, size));
  }

  return combos;
}

export function prepOptions(): readonly WheelOption<PrepComboKey>[] {
  return prepCombos().map((combo) => ({ value: prepKey(combo), label: prepComboLabel(combo) }));
}

function prepComboLabel(cards: readonly PrepCard[]): string {
  return cards.length === 0 ? PREPARATION_NOT_STARTED_LABEL : cards.map((card) => card.name).join(' · ');
}

/**
 * 지금 준비 현황이 가리키는 칸 — 업종이 전부 든 카드만 켠 것으로 센다(온보딩 `isPrepCardSelected`와 같다).
 * 카드 하나를 이루지 못한 업종만 있는 옛 값은 null — 휠은 첫 칸에서 시작하고, 「확인」 전에는 아무것도 바뀌지 않는다.
 */
export function prepComboKeyOf(categories: readonly PreparedCategory[]): PrepComboKey | null {
  const cards = PREP_CARDS.filter((card) => isPrepCardSelected(card, categories));
  const covered = new Set<PreparedCategory>(cards.flatMap((card) => card.categories));

  return categories.every((category) => covered.has(category)) ? prepKey(cards) : null;
}

/** 칸 → 서버에 보낼 업종. 카드의 업종 전부를 카드 순서대로(온보딩 `togglePrepCard`와 같은 결과). */
export function prepCategoriesFromKey(key: PrepComboKey): PreparedCategory[] {
  if (key === PREP_NONE_KEY) return [];

  const parts = key.split('+');

  return PREP_CARDS.filter((card) => parts.includes(card.key)).flatMap((card) => [...card.categories]);
}

/**
 * 준비 현황 행의 값 — 카드 이름(정본 weddingSet v 「웨딩홀」). 카드를 이루지 못한 옛 업종은
 * 업종 이름 그대로 뒤에 잇는다 — 가진 값을 숨기지 않는다.
 */
export function prepValueLabel(categories: readonly PreparedCategory[]): string {
  const cards = PREP_CARDS.filter((card) => isPrepCardSelected(card, categories));
  const covered = new Set<PreparedCategory>(cards.flatMap((card) => card.categories));
  const rest = categories.filter((category) => !covered.has(category));
  const names = [...cards.map((card) => card.name), ...rest.map((category) => VENDOR_CATEGORY_LABEL[category])];

  return names.length > 0 ? names.join(' · ') : PREPARATION_NOT_STARTED_LABEL;
}

/* ------------------------------------------------------------------ 공통 */

/** 순서를 지킨 n개 조합. */
function choose<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];

  return items.flatMap((item, index) => choose(items.slice(index + 1), size - 1).map((rest) => [item, ...rest]));
}
