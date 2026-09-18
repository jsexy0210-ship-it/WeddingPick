import type { CategoryRecommendation } from '@weddingpick/api-contract';
import type { CategoryStatus } from './state';
import { budgetProgress, pendingPreparations, recommendationsAreComplete } from './canon-state';

const rows: CategoryStatus[] = ['hall', 'studio', 'dress', 'makeup', 'snap'].map((category) => ({
  category: category as CategoryStatus['category'], label: category,
  state: 'before', pickCount: 0, decidedName: null,
}));

describe('최신 홈·추천 상태', () => {
  it('미완료 네 업종만 원래 준비 순서로 표시한다', () => {
    expect(pendingPreparations(rows).map((row) => row.category)).toEqual(['hall', 'studio', 'dress', 'makeup']);
  });
  it('완료한 업종을 제외하고 다음 업종을 승격한다', () => {
    expect(pendingPreparations(rows.map((row) => row.category === 'hall' ? { ...row, state: 'decided' } : row))
      .map((row) => row.category)).toEqual(['studio', 'dress', 'makeup', 'snap']);
  });
  it('완료 카드나 카운터를 넣어 네 칸을 억지로 채우지 않는다', () => {
    const source = rows.map((row, index) => ({ ...row, state: index < 4 ? 'decided' as const : 'before' as const }));
    expect(pendingPreparations(source)).toHaveLength(1);
    expect(pendingPreparations(source.map((row) => ({ ...row, state: 'decided' })))).toEqual([]);
    expect(rows).toHaveLength(5);
  });
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
