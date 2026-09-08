/**
 * 온보딩 4/5 예산 스텝. 핸드오프 v3.19 «예산 질문을 앞으로 쓸 예산으로 통일» ·
 * SPEC §13.6 — 자유 입력이 아니라 여섯 구간 중 하나를 고른다.
 *
 * **전체 예산이 아니라 «앞으로 준비에 쓸 예산»이다.** 준비 현황에 따라 질문이나
 * 구간을 분기하지 않는다 — 시작 전이면 전체 예산과 같고, 이미 일부 진행했다면
 * 자연히 남은 예산이 된다. 그래서 구간이 500만원 단위다. 완료 화면과 MY의 라벨은
 * «준비 예산»(BUDGET_BRACKET_FIELD_LABEL).
 *
 * 2026-09-08 이전의 네 구간(under_20m · 20m_30m · 30m_40m · over_40m)은 0086·0087이
 * 새 구간으로 옮겼다 — under_20m → 10m_20m, 30m_40m · over_40m → over_30m.
 */

export const WEDDING_BUDGET_BRACKETS = [
  'under_5m',
  '5m_10m',
  '10m_20m',
  '20m_30m',
  'over_30m',
  'unknown',
] as const;

export type WeddingBudgetBracket = (typeof WEDDING_BUDGET_BRACKETS)[number];

export const BUDGET_BRACKET_LABEL: Record<WeddingBudgetBracket, string> = {
  under_5m: '500만원 이하',
  '5m_10m': '500~1,000만원',
  '10m_20m': '1,000~2,000만원',
  '20m_30m': '2,000~3,000만원',
  over_30m: '3,000만원 이상',
  unknown: '아직 모르겠어요',
};

/** 답 줄 · 완료 요약 · MY의 라벨. «예산»이 아니라 «준비 예산»(v3.19). */
export const BUDGET_BRACKET_FIELD_LABEL = '준비 예산';

/** 4/5 제목과 설명(v3.21 «문구 최종»). */
export const BUDGET_STEP_TITLE = '앞으로 남은 예산은 얼마인가요?';
export const BUDGET_STEP_DESCRIPTION = '예산에 맞춰 합리적인 정보를 드려요';

const MAN_WON = 10_000;

/** 구간의 범위(원). 상한이 없는 구간은 max가 null이다. */
export type BudgetRange = { min: number; max: number | null };

/**
 * 구간의 최소~최대(원). `unknown`은 범위가 없어 null — 「아직 모르겠어요」는
 * 범위 제한 없이 전체를 본다(SPEC §13.6 «예산 매칭 기준»).
 */
export function budgetBracketRange(bracket: WeddingBudgetBracket): BudgetRange | null {
  switch (bracket) {
    case 'under_5m':
      return { min: 0, max: 500 * MAN_WON };
    case '5m_10m':
      return { min: 500 * MAN_WON, max: 1_000 * MAN_WON };
    case '10m_20m':
      return { min: 1_000 * MAN_WON, max: 2_000 * MAN_WON };
    case '20m_30m':
      return { min: 2_000 * MAN_WON, max: 3_000 * MAN_WON };
    case 'over_30m':
      return { min: 3_000 * MAN_WON, max: null };
    case 'unknown':
      return null;
  }
}

/**
 * 예산 매칭 — **겹침** 기준(SPEC §13.6). 고른 구간의 범위와 업체의 제보 금액
 * 구간(priceMin~priceMax)이 조금이라도 겹치면 맞는다. 완전 포함이 아니다.
 *
 *   고른 구간 2,000~3,000만원
 *   제보 1,800~2,500만원 → 맞음 (하한 겹침)
 *   제보 2,800~3,500만원 → 맞음 (상한 겹침)
 *   제보 3,200~4,000만원 → 제외 (겹침 없음)
 *
 * `unknown`은 늘 true — 범위 제한 없이 전체를 보여준다.
 */
export function budgetOverlaps(
  bracket: WeddingBudgetBracket,
  priceMin: number,
  priceMax: number
): boolean {
  const range = budgetBracketRange(bracket);

  if (range === null) return true;

  const low = Math.min(priceMin, priceMax);
  const high = Math.max(priceMin, priceMax);

  return high >= range.min && (range.max === null || low <= range.max);
}

/**
 * 구간의 상한값(원). `structured.weddings.budget_amount`를 서버가 이 값으로
 * 파생한다(0077) — 지출 화면의 «예산 대비»가 숫자 하나를 쓰기 때문이다.
 *
 * 상한이 없는 `over_30m`과 `unknown`은 null.
 */
export function budgetBracketCeiling(bracket: WeddingBudgetBracket): number | null {
  return budgetBracketRange(bracket)?.max ?? null;
}
