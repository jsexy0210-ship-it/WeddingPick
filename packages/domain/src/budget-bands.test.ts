import { BUDGET_BANDS, budgetBand } from './budget-bands';

/**
 * 예산 구간 — WP-SRCH-005. 시안 `06-search.dc.html` `filterGroups` 「예산」이 그리는
 * 칩 넷 그대로다. 라벨은 금액 표기 규칙으로 만들고 손으로 적지 않는다 — 여기가
 * 어긋나면 같은 금액이 화면마다 다르게 적힌다.
 */
describe('예산 구간', () => {
  it('시안이 그린 칩 넷이다', () => {
    expect(BUDGET_BANDS.map((band) => band.label)).toEqual([
      '~120만원',
      '120~180만원',
      '180~250만원',
      '250만원~',
    ]);
  });

  it('열린 쪽은 null이다 — 0원이나 큰 수로 채우지 않는다', () => {
    expect(BUDGET_BANDS[0]!.fromKrw).toBeNull();
    expect(BUDGET_BANDS[BUDGET_BANDS.length - 1]!.toKrw).toBeNull();
  });

  it('구간은 서로 겹치지 않고 이어진다', () => {
    for (let index = 1; index < BUDGET_BANDS.length; index += 1) {
      expect(BUDGET_BANDS[index]!.fromKrw).toBe(BUDGET_BANDS[index - 1]!.toKrw);
    }
  });

  it('모르는 키는 구간이 아니다', () => {
    expect(budgetBand('0-9999')).toBeNull();
    expect(budgetBand(null)).toBeNull();
    expect(budgetBand('120-180')?.label).toBe('120~180만원');
  });
});
