import { PUBLISHED_AMOUNT_UNIT, discloseAmounts, roundForDisclosure } from './disclosure';
import { computePriceStat, type PriceSample } from './pricing';

/**
 * 개별 결제금액이 그대로 나가지 않는지. 통합정책 §18 · C-4.
 *
 * 정책은 3건 미만이면 금액을 내지 말라고 했지, 3건이 넘으면 아무 숫자나 내도
 * 된다고 하지 않았다. 그런데 분위수는 표본 수에 따라 **표본 하나를 그대로**
 * 돌려준다 — `(n-1)*q`가 정수면 보간할 이웃이 없다.
 *
 * 그래서 건수만 세는 시험으로는 이 구멍이 안 잡힌다. 실제로 나가는 숫자가
 * 어느 한 사람이 낸 금액과 원 단위로 같은지를 본다.
 */

/** 서로 다른, 만원으로 안 떨어지는 금액. 반올림이 실제로 일어나야 시험이 성립한다. */
function amounts(count: number): number[] {
  return Array.from({ length: count }, (_, index) => 1_234_567 + index * 1_111_111);
}

function asSamples(values: readonly number[]): PriceSample[] {
  return values.map((amount, index) => ({
    amount,
    verificationLevel: 'L2',
    contractDate: `2026-0${(index % 9) + 1}-01`,
  }));
}

describe('개별 결제금액 공개 금지', () => {
  /*
   * 5·9·13건이 특히 위험하다 — (n-1)/4가 정수라 25%·75%가 표본을 그대로 짚는다.
   * 홀수는 중앙값도 가운데 한 건 그대로다.
   */
  const risky = [3, 5, 7, 9, 10, 13, 17];

  it.each(risky)('%i건일 때 구간이 누군가의 금액과 같지 않다', (count) => {
    const raw = amounts(count);
    const result = discloseAmounts({ amounts: raw, period: '최근 12개월' });

    if (result.stage === 'collecting') return;

    expect(raw).not.toContain(result.low);
    expect(raw).not.toContain(result.high);
  });

  it.each(risky.filter((count) => count >= 10))(
    '%i건일 때 기준금액이 누군가의 금액과 같지 않다',
    (count) => {
      const raw = amounts(count);
      const result = discloseAmounts({ amounts: raw, period: '최근 12개월' });

      expect(result.stage).toBe('detailed');

      if (result.stage !== 'detailed') return;

      expect(raw).not.toContain(result.median);
    }
  );

  it.each(risky)('%i건일 때 상품 통계가 누군가의 금액과 같지 않다', (count) => {
    const raw = amounts(count);
    const stat = computePriceStat(asSamples(raw));

    if (!stat) return;

    for (const published of [stat.median, stat.p25, stat.p75, stat.p90]) {
      expect(raw).not.toContain(published);
    }
  });

  it('나가는 금액은 전부 만원 단위다', () => {
    const raw = amounts(12);
    const result = discloseAmounts({ amounts: raw, period: '최근 12개월' });
    const stat = computePriceStat(asSamples(raw));

    const published = [
      ...(result.stage === 'collecting' ? [] : [result.low, result.high]),
      ...(result.stage === 'detailed' ? [result.median] : []),
      ...(stat ? [stat.median, stat.p25, stat.p75, stat.p90] : []),
    ];

    expect(published.length).toBeGreaterThan(0);

    for (const amount of published) {
      expect(amount % PUBLISHED_AMOUNT_UNIT).toBe(0);
    }
  });

  it('3건 미만이면 숫자 자체가 없다', () => {
    /* 반올림은 마지막 방어선이다. 그 앞에 건수 기준이 있고, 그것이 먼저 막는다. */
    for (const count of [0, 1, 2]) {
      const result = discloseAmounts({ amounts: amounts(count), period: '최근 12개월' });

      expect(result.stage).toBe('collecting');
      expect(result).not.toHaveProperty('low');
      expect(result).not.toHaveProperty('median');
    }
  });

  it('반올림 단위가 한 곳에 있다', () => {
    expect(PUBLISHED_AMOUNT_UNIT).toBe(10_000);
    expect(roundForDisclosure(1_234_567)).toBe(1_230_000);
    expect(roundForDisclosure(1_235_000)).toBe(1_240_000);
  });

  it('만원이 안 되는 값을 0으로 만들지 않는다', () => {
    /*
     * 0원은 `공짜였다`로 읽힌다. 없는 값을 지어내는 것보다 나쁘다. 1만원으로
     * 올려 적는 것도 지어내는 것이라 하지 않는다.
     */
    expect(roundForDisclosure(1_000)).toBe(1_000);
    expect(roundForDisclosure(9_999)).toBe(9_999);
    expect(roundForDisclosure(10_000)).toBe(10_000);
  });
});
