import {
  TOP3_LIMIT,
  TOP3_MIN_CONFIRMED,
  TOP3_REASON_LABEL,
  budgetExcludes,
  isRecommendable,
  reasonsFor,
  type Top3Facts,
} from './top3';

const BASE: Top3Facts = {
  regionMatched: true,
  confirmedCount: 3,
  recentCount: 0,
  priceMin: null,
  priceMax: null,
  budgetBracket: null,
};

describe('추천 이유', () => {
  it('지역이 맞으면 이유가 된다', () => {
    expect(reasonsFor(BASE)).toContain('region');
    expect(reasonsFor({ ...BASE, regionMatched: false })).not.toContain('region');
  });

  it('예산은 제보 금액이 있어야 말할 수 있다', () => {
    // 무엇과 견줬는지 없이 "예산과 맞아요"라고 적으면 그건 근거가 아니다.
    expect(reasonsFor({ ...BASE, budgetBracket: '20m_30m' })).not.toContain('budget');
    expect(
      reasonsFor({ ...BASE, budgetBracket: '20m_30m', priceMin: 18_000_000, priceMax: 25_000_000 })
    ).toContain('budget');
  });

  it('겹치지 않으면 이유가 아니고 추천 대상에서도 빠진다', () => {
    const facts: Top3Facts = { ...BASE, budgetBracket: '20m_30m', priceMin: 32_000_000, priceMax: 40_000_000 };

    expect(reasonsFor(facts)).not.toContain('budget');
    expect(budgetExcludes(facts)).toBe(true);
    expect(isRecommendable(facts)).toBe(false);
  });

  it('예산을 안 정했거나 모르겠으면 말하지도 거르지도 않는다', () => {
    const unknown: Top3Facts = { ...BASE, budgetBracket: 'unknown', priceMin: 90_000_000, priceMax: 99_000_000 };

    expect(reasonsFor({ ...BASE, budgetBracket: null, priceMin: 21_000_000, priceMax: 21_000_000 })).not.toContain(
      'budget'
    );
    expect(reasonsFor(unknown)).not.toContain('budget');
    expect(budgetExcludes(unknown)).toBe(false);
    expect(isRecommendable(unknown)).toBe(true);
  });

  it('실 제보가 다섯 건부터 많다고 말한다', () => {
    expect(reasonsFor({ ...BASE, confirmedCount: 4 })).not.toContain('many_confirmed');
    expect(reasonsFor({ ...BASE, confirmedCount: 5 })).toContain('many_confirmed');
  });

  it('최근 자료가 있어야 최근이라고 말한다', () => {
    expect(reasonsFor({ ...BASE, recentCount: 0 })).not.toContain('recent_data');
    expect(reasonsFor({ ...BASE, recentCount: 1 })).toContain('recent_data');
  });

  it('모든 이유에 사용자 문장이 있다', () => {
    for (const reason of reasonsFor({
      regionMatched: true,
      confirmedCount: 10,
      recentCount: 4,
      priceMin: 21_000_000,
      priceMax: 24_000_000,
      budgetBracket: '20m_30m',
    })) {
      expect(TOP3_REASON_LABEL[reason]).toBeTruthy();
    }
  });
});

describe('추천할 자격', () => {
  it('실 제보가 세 건은 있어야 한다', () => {
    // 그 아래는 금액 구간조차 못 보여준다. 보여줄 것이 없는 추천은 추천이 아니다.
    expect(TOP3_MIN_CONFIRMED).toBe(3);
    expect(isRecommendable({ ...BASE, confirmedCount: 2 })).toBe(false);
    expect(isRecommendable({ ...BASE, confirmedCount: 3 })).toBe(true);
  });

  it('이유가 하나도 없으면 추천하지 않는다', () => {
    // "이유는 없지만 추천합니다"라고 적을 자리가 없다.
    const noReason: Top3Facts = { ...BASE, regionMatched: false, confirmedCount: 3 };

    expect(reasonsFor(noReason)).toEqual([]);
    expect(isRecommendable(noReason)).toBe(false);
  });

  it('세 곳이 최대다', () => {
    expect(TOP3_LIMIT).toBe(3);
  });
});
