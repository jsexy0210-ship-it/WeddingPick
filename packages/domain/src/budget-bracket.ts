/**
 * 온보딩 3/4 예산 스텝. 디자인 핸드오프 01-onboarding.dc.html #11e — 자유 입력이
 * 아니라 다섯 구간 중 하나를 고른다. 순서와 문구는 핸드오프 그대로다.
 */

export const WEDDING_BUDGET_BRACKETS = [
  'under_20m',
  '20m_30m',
  '30m_40m',
  'over_40m',
  'unknown',
] as const;

export type WeddingBudgetBracket = (typeof WEDDING_BUDGET_BRACKETS)[number];

export const BUDGET_BRACKET_LABEL: Record<WeddingBudgetBracket, string> = {
  under_20m: '2,000만원 이하',
  '20m_30m': '2,000~3,000만원',
  '30m_40m': '3,000~4,000만원',
  over_40m: '4,000만원 이상',
  unknown: '아직 모르겠어요',
};

/**
 * 구간의 상한값. TOP3 추천(top3.ts)이 예산을 숫자로 비교하기 때문에 필요하다 —
 * 사용자가 직접 숫자를 입력하지 않아도, 그 로직은 그대로 둔다.
 *
 * `over_40m`과 `unknown`은 상한이 없다 — `null`. top3.ts에서 `budgetAmount`가
 * `null`이면 예산으로 거르지 않는다는 뜻이라, "상한 모름"과 "아직 모르겠어요"
 * 둘 다 자연히 맞아떨어진다.
 */
export function budgetBracketCeiling(bracket: WeddingBudgetBracket): number | null {
  switch (bracket) {
    case 'under_20m':
      return 20_000_000;
    case '20m_30m':
      return 30_000_000;
    case '30m_40m':
      return 40_000_000;
    case 'over_40m':
    case 'unknown':
      return null;
  }
}
