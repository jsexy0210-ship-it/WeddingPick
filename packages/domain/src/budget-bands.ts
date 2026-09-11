import { manwon, rangeLabel } from './disclosure';

/**
 * 검색 필터의 예산 구간 — WP-SRCH-005.
 *
 * 시안 `06-search.dc.html` `filterGroups` 「예산」이 칩 넷을 그린다:
 * «~120만원» · «120~180만원» · «180~250만원» · «250만원~». 만원 단위 숫자 입력
 * 두 칸이 아니라 **고른 구간 하나**다. 라벨은 금액 표기 규칙(`manwon` · `rangeLabel`)을
 * 그대로 쓴다 — 같은 숫자를 두 곳에서 다르게 적지 않는다.
 *
 * **구간은 업종과 무관하게 같다.** 시안이 스튜디오 화면에 그린 값이고, 웨딩홀처럼
 * 자릿수가 다른 업종에는 넓게 잡힌다. 업종별 구간은 시안에 없어 만들지 않는다.
 */
export const BUDGET_BAND_KEYS = ['-120', '120-180', '180-250', '250-'] as const;

export type BudgetBandKey = (typeof BUDGET_BAND_KEYS)[number];

export type BudgetBand = {
  /** 화면과 서버가 주고받는 키. 만원 단위 «하한-상한»이고 빈 쪽은 열려 있다. */
  key: BudgetBandKey;
  /** 하한(원). 없으면 null — «~120만원». */
  fromKrw: number | null;
  /** 상한(원). 없으면 null — «250만원~». */
  toKrw: number | null;
  /** 화면 라벨. */
  label: string;
};

const MANWON = 10_000;

function band(key: BudgetBandKey, fromManwon: number | null, toManwon: number | null): BudgetBand {
  const fromKrw = fromManwon === null ? null : fromManwon * MANWON;
  const toKrw = toManwon === null ? null : toManwon * MANWON;

  return {
    key,
    fromKrw,
    toKrw,
    label:
      fromKrw === null
        ? `~${manwon(toKrw!)}`
        : toKrw === null
          ? `${manwon(fromKrw)}~`
          : rangeLabel(fromKrw, toKrw),
  };
}

export const BUDGET_BANDS: readonly BudgetBand[] = [
  band('-120', null, 120),
  band('120-180', 120, 180),
  band('180-250', 180, 250),
  band('250-', 250, null),
];

export function budgetBand(key: string | null | undefined): BudgetBand | null {
  if (!key) return null;

  return BUDGET_BANDS.find((item) => item.key === key) ?? null;
}
