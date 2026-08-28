import { PRICING_POLICY } from './policy';
import { computePriceStat, judgePrice, levelBreakdown, median, quantile } from './pricing';
import type { PriceSample } from './pricing';
import type { VerificationLevel } from './verification';

function sample(amount: number, level: VerificationLevel = 'L2', date = '2026-05-01'): PriceSample {
  return { amount, verificationLevel: level, contractDate: date };
}

describe('중앙값과 분위수', () => {
  it('홀수 개면 가운데 값을 쓴다', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('짝수 개면 가운데 두 값의 평균을 쓴다', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('평균이 아니라 중앙값이라 이상치에 끌려가지 않는다', () => {
    // 사업계획서 9번: 평균보다 중앙값을 우선한다.
    const amounts = [1000, 1100, 1200, 1300, 99999];

    expect(median(amounts)).toBe(1200);
  });

  it('빈 표본에서는 분위수를 구하지 않는다', () => {
    expect(() => quantile([], 0.5)).toThrow();
  });
});

describe('시장 가격 통계', () => {
  const enough = PRICING_POLICY.minimumSampleCount;

  it('표본이 기준에 못 미치면 가격을 만들지 않는다', () => {
    const samples = Array.from({ length: enough - 1 }, (_, i) => sample(1000 + i));

    // 제품 원칙 2: AI도 서버도 없는 시장 데이터를 만들어내지 않는다.
    expect(computePriceStat(samples)).toBeNull();
  });

  it('기준을 채우면 통계를 낸다', () => {
    const samples = Array.from({ length: enough }, (_, i) => sample(1000 + i));

    expect(computePriceStat(samples)).not.toBeNull();
  });

  it('L2 미만은 표본에서 빼고 센다', () => {
    const eligible = Array.from({ length: enough }, () => sample(1000, 'L2'));
    const ignored = [sample(1, 'L0'), sample(2, 'L1')];

    const stat = computePriceStat([...eligible, ...ignored]);

    expect(stat?.sampleCount).toBe(enough);
    expect(stat?.median).toBe(1000);
  });

  it('L0·L1만 있으면 표본이 아무리 많아도 가격이 없다', () => {
    const samples = Array.from({ length: enough * 3 }, (_, i) => sample(1000 + i, 'L1'));

    expect(computePriceStat(samples)).toBeNull();
  });

  it('기준 기간은 실제 표본의 계약일 범위다', () => {
    const samples = [
      sample(1000, 'L2', '2026-03-02'),
      sample(1100, 'L2', '2026-01-15'),
      sample(1200, 'L2', '2026-06-30'),
      sample(1300, 'L2', '2026-04-01'),
      sample(1400, 'L2', '2026-02-20'),
    ];

    const stat = computePriceStat(samples);

    expect(stat?.periodStart).toBe('2026-01-15');
    expect(stat?.periodEnd).toBe('2026-06-30');
  });
});

describe('가격 판단', () => {
  const stat = {
    sampleCount: 10,
    median: 1000,
    p25: 800,
    p75: 1200,
    p90: 1400,
    periodStart: '2026-01-01',
    periodEnd: '2026-06-30',
    minVerificationLevel: 'L2' as VerificationLevel,
  };

  it('p25 미만은 낮은 편', () => {
    expect(judgePrice(700, stat)).toBe('low');
  });

  it('p25 이상 p75 이하는 비슷한 수준', () => {
    expect(judgePrice(800, stat)).toBe('similar');
    expect(judgePrice(1200, stat)).toBe('similar');
  });

  it('p75 초과 p90 이하는 다소 높은 편', () => {
    expect(judgePrice(1300, stat)).toBe('somewhat_high');
  });

  it('p90 초과는 높은 편', () => {
    expect(judgePrice(1500, stat)).toBe('high');
  });
});

describe('근거 표시', () => {
  it('등급 구성을 세어 무엇을 근거로 판단했는지 보여줄 수 있다', () => {
    const counts = levelBreakdown([sample(1, 'L2'), sample(2, 'L2'), sample(3, 'L4')]);

    expect(counts).toEqual({ L0: 0, L1: 0, L2: 2, L3: 0, L4: 1 });
  });
});
