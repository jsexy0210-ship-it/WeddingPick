import {
  BUDGET_BRACKET_FIELD_LABEL,
  BUDGET_BRACKET_LABEL,
  WEDDING_BUDGET_BRACKETS,
  budgetBracketCeiling,
  budgetBracketRange,
  budgetOverlaps,
} from './budget-bracket';

describe('예산 구간', () => {
  it('핸드오프 v3.19의 여섯 구간을 그 순서로 둔다', () => {
    // 순서도 문구도 SPEC §13.6 그대로다. 화면이 이 배열을 그대로 그린다.
    expect(WEDDING_BUDGET_BRACKETS.map((bracket) => BUDGET_BRACKET_LABEL[bracket])).toEqual([
      '500만원 이하',
      '500~1,000만원',
      '1,000~2,000만원',
      '2,000~3,000만원',
      '3,000만원 이상',
      '아직 모르겠어요',
    ]);
  });

  it('라벨은 «준비 예산»이다 — 전체 예산이 아니라 앞으로 쓸 예산', () => {
    expect(BUDGET_BRACKET_FIELD_LABEL).toBe('준비 예산');
  });

  it('범위는 만원을 원으로 바꾼 값이다', () => {
    expect(budgetBracketRange('under_5m')).toEqual({ min: 0, max: 5_000_000 });
    expect(budgetBracketRange('5m_10m')).toEqual({ min: 5_000_000, max: 10_000_000 });
    expect(budgetBracketRange('10m_20m')).toEqual({ min: 10_000_000, max: 20_000_000 });
    expect(budgetBracketRange('20m_30m')).toEqual({ min: 20_000_000, max: 30_000_000 });
    expect(budgetBracketRange('over_30m')).toEqual({ min: 30_000_000, max: null });
  });

  it('아직 모르겠어요는 범위가 없다', () => {
    expect(budgetBracketRange('unknown')).toBeNull();
  });

  it('상한값은 구간의 윗선이고, 없으면 null이다', () => {
    expect(budgetBracketCeiling('under_5m')).toBe(5_000_000);
    expect(budgetBracketCeiling('20m_30m')).toBe(30_000_000);
    expect(budgetBracketCeiling('over_30m')).toBeNull();
    expect(budgetBracketCeiling('unknown')).toBeNull();
  });

  describe('예산 매칭은 겹침 기준이다', () => {
    // SPEC §13.6의 예 그대로 — 고른 구간 2,000~3,000만원.
    it('하한이 겹치면 맞는다', () => {
      expect(budgetOverlaps('20m_30m', 18_000_000, 25_000_000)).toBe(true);
    });

    it('상한이 겹치면 맞는다', () => {
      expect(budgetOverlaps('20m_30m', 28_000_000, 35_000_000)).toBe(true);
    });

    it('겹치지 않으면 제외한다', () => {
      expect(budgetOverlaps('20m_30m', 32_000_000, 40_000_000)).toBe(false);
      expect(budgetOverlaps('20m_30m', 5_000_000, 15_000_000)).toBe(false);
    });

    it('완전 포함일 필요는 없다 — 구간을 통째로 감싸도 맞는다', () => {
      expect(budgetOverlaps('20m_30m', 10_000_000, 40_000_000)).toBe(true);
    });

    it('상한이 없는 구간은 하한만 본다', () => {
      expect(budgetOverlaps('over_30m', 32_000_000, 90_000_000)).toBe(true);
      expect(budgetOverlaps('over_30m', 10_000_000, 29_000_000)).toBe(false);
    });

    it('아직 모르겠어요는 전부 맞는다', () => {
      expect(budgetOverlaps('unknown', 1, 2)).toBe(true);
      expect(budgetOverlaps('unknown', 900_000_000, 900_000_000)).toBe(true);
    });

    it('금액 하나(min = max)도 된다', () => {
      expect(budgetOverlaps('under_5m', 5_000_000, 5_000_000)).toBe(true);
      expect(budgetOverlaps('under_5m', 5_000_001, 5_000_001)).toBe(false);
    });
  });
});
