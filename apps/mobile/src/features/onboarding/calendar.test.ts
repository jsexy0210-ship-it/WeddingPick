import { CALENDAR_CELLS, chunk, isPastMonth, monthGrid, splitIso, toIso, yearOptions } from './calendar';

describe('달력 격자', () => {
  it('2027년 5월은 앞 타월 6칸 · 31일 · 뒤 타월로 42칸을 채운다 (시안 MAY27)', () => {
    const cells = monthGrid(2027, 5);

    expect(cells).toHaveLength(CALENDAR_CELLS);
    /* 4/25(일)부터 시작 — 1일이 토요일이라 앞에 여섯 칸. */
    expect(cells.slice(0, 6).map((cell) => cell.day)).toEqual([25, 26, 27, 28, 29, 30]);
    expect(cells.slice(0, 6).every((cell) => !cell.inMonth)).toBe(true);
    expect(cells[6]).toEqual({ iso: '2027-05-01', day: 1, inMonth: true, weekday: 6 });
    expect(cells.filter((cell) => cell.inMonth)).toHaveLength(31);
    /* 15일이 토요일이다 — 시안의 «16(토)»는 실제 달력과 하루 어긋난 예시값이다. */
    expect(cells.find((cell) => cell.iso === '2027-05-15')?.weekday).toBe(6);
    expect(cells[37]).toEqual({ iso: '2027-06-01', day: 1, inMonth: false, weekday: 2 });
  });

  it('일요일에서 시작하는 달도 42칸이다', () => {
    const cells = monthGrid(2026, 11);

    expect(cells[0]).toEqual({ iso: '2026-11-01', day: 1, inMonth: true, weekday: 0 });
    expect(cells).toHaveLength(CALENDAR_CELLS);
  });

  it('연도는 올해부터 5년 뒤까지 여섯 개다', () => {
    expect(yearOptions(new Date(2026, 8, 8))).toEqual([2026, 2027, 2028, 2029, 2030, 2031]);
  });

  it('오늘이 속한 달보다 앞은 지난 달이다', () => {
    const today = new Date(2026, 8, 8);

    expect(isPastMonth(2026, 8, today)).toBe(true);
    expect(isPastMonth(2026, 9, today)).toBe(false);
    expect(isPastMonth(2025, 12, today)).toBe(true);
    expect(isPastMonth(2027, 1, today)).toBe(false);
  });

  it('iso 왕복', () => {
    expect(toIso(2027, 5, 6)).toBe('2027-05-06');
    expect(splitIso('2027-05-16')).toEqual({ year: 2027, month: 5, day: 16 });
    expect(splitIso('2027.05.16')).toBeNull();
  });

  it('격자 줄 나누기', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 4)).toEqual([]);
  });
});
