import type { AppBootstrapResponse, CategoryRecommendation } from '@weddingpick/api-contract';
import type { CategoryStatus } from './state';

/** docs/design/figma-export/README.md: 완료 업종은 빼고 다음 업종을 최대 네 칸까지 표시한다. */
export function pendingPreparations(statuses: readonly CategoryStatus[]): CategoryStatus[] {
  return statuses.filter((item) => item.state !== 'decided').slice(0, 4);
}

/** 0원 예산에는 비율이 없다. 초과 지출도 막대 폭은 100%를 넘기지 않는다. */
export function budgetProgress(budget: AppBootstrapResponse['budget']): number | null {
  if (!budget || !Number.isFinite(budget.total) || !Number.isFinite(budget.spent) || budget.total <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((budget.spent / budget.total) * 100)));
}

/** 응답에 남은 준비가 있는데 추천 목록만 비면 준비 완료가 아니다. */
export function recommendationsAreComplete(response: {
  groups: readonly CategoryRecommendation[];
  remaining: number;
}): boolean {
  return response.remaining === 0 && response.groups.length === 0;
}
