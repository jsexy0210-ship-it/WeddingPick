import { DISCLOSURE_THRESHOLDS, disclosureStage } from './disclosure';

/**
 * 재식별 방지. 최종통합정책 v2.0 C-4.
 *
 * > 단순히 3건 이상이라는 이유만으로 모든 세부조건을 공개하지 않는다.
 * > 지역·날짜·상품·옵션 조합으로 특정 사용자를 추정할 가능성이 높으면 세부조건을
 * > 묶거나 숨긴다.
 *
 * **문제는 건수가 아니라 조합이다.** "서울 강남구 · 2026년 5월 · 토요일 저녁 ·
 * 보증 250명"으로 좁힌 3건은, 그 조건에 해당하는 사람이 알 만한 사람 셋이라는
 * 뜻이다. 자기 결제 금액을 아는 사람은 나머지 둘의 금액도 좁혀 알 수 있다.
 *
 * 그래서 **얼마나 좁혔는지**를 함께 본다. 좁힐수록 더 많은 건수를 요구한다.
 */

/** 가격 조건을 이루는 축. C-5의 카테고리별 스키마가 이 위에 얹힌다. */
export const CONDITION_AXES = ['region', 'period', 'product', 'option'] as const;

export type ConditionAxis = (typeof CONDITION_AXES)[number];

export const CONDITION_AXIS_LABEL: Record<ConditionAxis, string> = {
  region: '지역',
  period: '시기',
  product: '상품',
  option: '옵션',
};

/**
 * 축 하나를 더 좁힐 때마다 요구하는 건수가 늘어난다.
 *
 * **잠정값이다.** 통계적 k-익명성을 계산해서 나온 값이 아니라, "좁힐수록 더
 * 필요하다"는 방향만 담은 숫자다 — 실제 자료가 쌓이면 재식별 위험을 재서 정해야
 * 한다. 그 전에는 넉넉한 쪽으로 둔다.
 */
export const NARROWING_STEP = 2;

/**
 * 이 조건을 공개해도 되는가.
 *
 * `axes`는 **몇 개의 축으로 좁혔는지**다. 아무것도 안 좁힌 전체 통계는 0이고,
 * 지역과 시기로 좁혔으면 2다.
 */
export function canDiscloseNarrowed(input: {
  count: number;
  axes: number;
}): boolean {
  return input.count >= requiredCount(input.axes);
}

/** 이만큼은 모여야 그 조건을 보여준다. */
export function requiredCount(axes: number): number {
  return DISCLOSURE_THRESHOLDS.limited + Math.max(0, axes) * NARROWING_STEP;
}

/**
 * 보여줄 수 있는 데까지만 좁힌다.
 *
 * 조건을 하나씩 떼어내며 공개할 수 있는 조합을 찾는다. **덜 좁힌 쪽이 더 안전하다** —
 * 못 보여줄 바에는 넓게라도 보여주는 것이 낫고, 그게 C-4의 "묶거나 숨긴다"에서
 * 묶는 쪽이다.
 *
 * `counts`는 축을 0개, 1개, ... 순으로 좁혔을 때의 건수다. 부르는 쪽이 실제로
 * 세어서 넘긴다 — 어떤 축을 먼저 떼어낼지는 업종마다 다르고, 그건 여기가 아니라
 * 그쪽이 안다.
 */
export function widestDisclosable(counts: readonly number[]): number | null {
  for (let axes = counts.length - 1; axes >= 0; axes -= 1) {
    if (canDiscloseNarrowed({ count: counts[axes]!, axes })) return axes;
  }

  return null;
}

/**
 * 조건별을 보여주지 않을 때 하는 말.
 *
 * **"개인정보 때문"이라고 말하지 않는다.** 사용자가 무엇을 잘못한 것처럼 들리고,
 * 실제로는 자료가 덜 모인 것이 맞다.
 *
 * v3.3 §O-1: 사용자 화면에서 `데이터`를 쓰지 않는다 — "정보"로 적는다.
 */
export const NARROWED_NOT_ENOUGH = '이 조건은 아직 정보가 모이는 중이에요';

/**
 * 시기를 얼마나 잘게 보여줄 것인가.
 *
 * 날짜까지 보여주면 "그날 그 홀에서 결혼한 사람"이 되고, 그건 대개 한 쌍이다.
 * 연월까지만 쓴다 — 가격 제보가 `contracted_on`을 연월로 받는 것과 같은 이유다.
 */
export const PERIOD_GRANULARITY = 'month' as const;

/** 지역을 얼마나 잘게 보여줄 것인가. 구까지 가면 좁고, 시도까지면 넓다. */
export function coarseRegion(region: string): string {
  // "서울 강남구" → "서울". 공백 앞이 시도다.
  return region.split(' ')[0] ?? region;
}

/**
 * 전체 공개 단계와 조건별 공개 단계는 따로다. C-3.
 *
 * 전체가 상세 단계여도 그 조건이 모자라면 내지 않는다.
 */
export function conditionStage(totalCount: number, conditionCount: number, axes: number) {
  if (disclosureStage(totalCount) !== 'detailed') return null;
  if (!canDiscloseNarrowed({ count: conditionCount, axes })) return null;

  return disclosureStage(conditionCount);
}

/**
 * 조건이 비슷한 사례를 찾을 때 좁혀 들어가는 순서. v2.0 D-1.
 *
 * **배열의 자리가 곧 좁힌 축의 수다.** 0번은 아무것도 안 좁힌 업종 전체이고,
 * 뒤로 갈수록 좁다. `widestDisclosable`이 이 배열과 같은 길이의 건수를 받아
 * 보여줄 수 있는 가장 넓은 자리를 고른다.
 *
 * 지역이 시기보다 앞인 이유: 지역은 사용자가 바꿀 수 없는 조건이고, 시기는
 * 기다리면 달라진다. 하나만 남길 수 있다면 남길 것은 지역 쪽이다.
 */
export const CONDITION_NARROWING = [null, 'region', 'period'] as const satisfies readonly (
  | ConditionAxis
  | null
)[];

/** 시기 축이 보는 창. 최근 이만큼에 결제된 것만 같은 시기로 본다. */
export const RECENT_PERIOD_MONTHS = 3;

export const RECENT_PERIOD_LABEL = `최근 ${RECENT_PERIOD_MONTHS}개월`;

/**
 * 어느 조건의 숫자인지 화면에 적는 말.
 *
 * 숫자만 떼어놓으면 그것이 어느 조건의 값인지 모르는 채로 읽힌다. 조건별
 * 통계에서는 이게 캡션보다 먼저다 — 무엇을 좁혔는지가 곧 그 숫자의 뜻이다.
 */
export function narrowedLabel(
  axes: number,
  input: { category: string; region: string }
): string {
  /*
   * 지역을 안 좁혔으면 '전국'이라고 적는다. 아무 말도 안 적으면 읽는 사람이
   * 자기 지역의 숫자라고 넘겨짚는다 — 그게 가장 흔한 오해다.
   */
  const parts = [input.category, axes >= 1 ? coarseRegion(input.region) : '전국'];

  if (axes >= 2) parts.push(RECENT_PERIOD_LABEL);

  return parts.join(' · ');
}
