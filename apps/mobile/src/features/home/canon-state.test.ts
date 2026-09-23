import type { CategoryRecommendation } from '@weddingpick/api-contract';
import { budgetProgress, recommendationsAreComplete } from './canon-state';

describe('최신 홈·추천 상태', () => {
  const budgetCases: [Parameters<typeof budgetProgress>[0], number | null][] = [
    [null, null],
    [{ total: 0, spent: 0, remaining: 0 }, null],
    [{ total: 0, spent: 10, remaining: -10 }, null],
    [{ total: 100, spent: 57, remaining: 43 }, 57],
    [{ total: 100, spent: 150, remaining: -50 }, 100],
    [{ total: 100, spent: -5, remaining: 105 }, 0],
    [{ total: Number.NaN, spent: 5, remaining: 5 }, null],
  ];
  it.each(budgetCases)('예산 비율의 경계값을 처리한다: %j', (budget, expected) => {
    expect(budgetProgress(budget)).toBe(expected);
  });
  it('추천이 비어도 준비가 남아 있으면 완료라고 하지 않는다', () => {
    expect(recommendationsAreComplete({ groups: [], remaining: 2 })).toBe(false);
    expect(recommendationsAreComplete({ groups: [], remaining: 0 })).toBe(true);
    expect(recommendationsAreComplete({ groups: [{} as CategoryRecommendation], remaining: 0 })).toBe(false);
  });
});
