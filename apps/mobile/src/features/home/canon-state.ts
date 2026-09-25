import type { AppBootstrapResponse, CategoryRecommendation } from '@weddingpick/api-contract';

/*
 * `pendingPreparations`(완료 업종을 빼고 최대 4칸)는 2026-09-23 v3.29 홈 재구축에서
 * 지웠다 — 근거가 이미 파기된 `docs/design/figma-export/README.md`였고, 현재 정본
 * (`docs/design/React_Native/home.jsx`)은 항상 4칸(완료해도 안
 * 사라짐)을 요구한다. 새 계산은 `./prep-groups.ts`의 `homePrepCards`가 맡는다.
 */

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
