import { chunk, firstSelectable, toIso } from './calendar';

describe('예식일 범위 계산', () => {
  it('과거는 고를 수 없다 — 고를 수 있는 첫 날은 내일', () => {
    expect(firstSelectable(new Date(2026, 8, 8, 8, 30))).toEqual({ year: 2026, month: 9, day: 9 });
    /* 12월 31일의 «내일»은 다음 해다. */
    expect(firstSelectable(new Date(2026, 11, 31))).toEqual({ year: 2027, month: 1, day: 1 });
  });

  it('격자 줄 나누기', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 4)).toEqual([]);
  });

  it('iso 만들기', () => {
    expect(toIso(2027, 5, 6)).toBe('2027-05-06');
  });
});
