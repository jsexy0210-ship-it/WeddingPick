import {
  BUDGET_BRACKET_LABEL,
  WEDDING_BUDGET_BRACKETS,
  budgetBracketCeiling,
} from './budget-bracket';

describe('예산 구간', () => {
  it('핸드오프 #11e의 다섯 구간을 그 순서로 둔다', () => {
    // 순서도 문구도 시안 그대로다. 화면이 이 배열을 그대로 그린다.
    expect(WEDDING_BUDGET_BRACKETS.map((bracket) => BUDGET_BRACKET_LABEL[bracket])).toEqual([
      '2,000만원 이하',
      '2,000~3,000만원',
      '3,000~4,000만원',
      '4,000만원 이상',
      '아직 모르겠어요',
    ]);
  });

  it('상한값은 구간의 윗선이다', () => {
    expect(budgetBracketCeiling('under_20m')).toBe(20_000_000);
    expect(budgetBracketCeiling('20m_30m')).toBe(30_000_000);
    expect(budgetBracketCeiling('30m_40m')).toBe(40_000_000);
  });

  it('상한이 없는 구간은 null이다 — top3가 예산으로 거르지 않는다', () => {
    expect(budgetBracketCeiling('over_40m')).toBeNull();
    expect(budgetBracketCeiling('unknown')).toBeNull();
  });
});
