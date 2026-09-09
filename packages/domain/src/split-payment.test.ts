import { splitPayment } from './split-payment';

describe('나눠 낸 금액 묶기', () => {
  it('계약금과 잔금이 다 읽히면 합계를 낸다', () => {
    expect(splitPayment({ deposit: 500_000, balance: 1_320_000 })).toEqual({
      total: 1_820_000,
      parts: [
        { label: '계약금', amount: 500_000 },
        { label: '잔금', amount: 1_320_000 },
      ],
    });
  });

  /*
   * 하나뿐인데 묶으면 그 하나가 총액처럼 읽힌다 — 계약금 50만원짜리 자료에
   * 「같이 묶으면 총 50만원이에요」가 붙는 순간 사람은 그것을 계약 총액으로 믿는다.
   */
  it('한쪽만 읽혔으면 묶지 않는다', () => {
    expect(splitPayment({ deposit: 500_000, balance: null })).toBeNull();
    expect(splitPayment({ deposit: null, balance: 1_320_000 })).toBeNull();
    expect(splitPayment({ deposit: null, balance: null })).toBeNull();
  });

  it('0원도 읽은 값이다 — 없는 것과 다르다', () => {
    expect(splitPayment({ deposit: 0, balance: 1_320_000 })?.total).toBe(1_320_000);
  });

  it('반올림하지 않는다 — 확인 화면의 금액은 원 단위 그대로다', () => {
    expect(splitPayment({ deposit: 504_321, balance: 1_320_000 })?.total).toBe(1_824_321);
  });
});
