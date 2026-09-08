import {
  CALENDAR_CELLS,
  CALENDAR_MUTED,
  CALENDAR_SATURDAY,
  CALENDAR_SUNDAY,
  chunk,
  clampDay,
  dayOptions,
  daysInMonth,
  firstSelectable,
  isDaySelectable,
  isMonthSelectable,
  monthCells,
  monthOptions,
  normalizeDate,
  splitIso,
  toIso,
  yearOptions,
} from './calendar';

describe('연월 셀렉트 + 달력 계산 (WP-APP-023)', () => {
  it('달력 색 — 일요일 · 토요일 · 타월 (SPEC §13.7)', () => {
    expect(CALENDAR_SUNDAY).toBe('#E8735F');
    expect(CALENDAR_SATURDAY).toBe('#5B8DEF');
    expect(CALENDAR_MUTED).toBe('#DCDEE3');
  });

  it('달의 날 수 — 윤년 2월은 29일', () => {
    expect(daysInMonth(2027, 5)).toBe(31);
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(dayOptions(2027, 4)).toHaveLength(30);
    expect(dayOptions(2027, 4)[0]).toBe(1);
  });

  it('월을 바꿔 없는 날짜가 되면 그 달 마지막 날로 당긴다', () => {
    /* 1월 31일에서 2월로 가면 2월 28일. */
    expect(clampDay(2027, 2, 31)).toBe(28);
    expect(clampDay(2028, 2, 31)).toBe(29);
    expect(clampDay(2027, 5, 16)).toBe(16);
    expect(clampDay(2027, 5, 0)).toBe(1);
  });

  it('과거는 고를 수 없다 — 첫 해는 내일이 속한 달부터, 첫 달은 내일부터', () => {
    const first = firstSelectable(new Date(2026, 8, 8, 8, 30));

    expect(first).toEqual({ year: 2026, month: 9, day: 9 });
    expect(monthOptions(2026, first)).toEqual([9, 10, 11, 12]);
    expect(monthOptions(2027, first)).toHaveLength(12);
    expect(isMonthSelectable(2026, 8, first)).toBe(false);
    expect(isMonthSelectable(2026, 9, first)).toBe(true);
    expect(dayOptions(2026, 9, first)[0]).toBe(9);
    expect(dayOptions(2026, 9, first)).toHaveLength(22);
    expect(dayOptions(2026, 10, first)[0]).toBe(1);
    expect(isDaySelectable({ year: 2026, month: 9, day: 8 }, first)).toBe(false);
    expect(isDaySelectable({ year: 2026, month: 9, day: 9 }, first)).toBe(true);
    expect(isDaySelectable({ year: 2027, month: 1, day: 1 }, first)).toBe(true);
    /* 12월 31일의 «내일»은 다음 해다. */
    expect(firstSelectable(new Date(2026, 11, 31))).toEqual({ year: 2027, month: 1, day: 1 });
  });

  it('연 · 월을 바꾼 뒤 나머지 값을 목록 안으로 맞춘다', () => {
    const first = { year: 2026, month: 9, day: 9 };

    /* 2027년 1월 31일에서 월을 2월로 → 2월 28일. */
    expect(normalizeDate({ year: 2027, month: 2, day: 31 }, first)).toEqual({ year: 2027, month: 2, day: 28 });
    /* 2027년 3월 5일에서 연도를 2026년으로 → 3월은 목록에 없어 9월, 5일은 9일로. */
    expect(normalizeDate({ year: 2026, month: 3, day: 5 }, first)).toEqual({ year: 2026, month: 9, day: 9 });
    expect(normalizeDate({ year: 2027, month: 5, day: 16 }, first)).toEqual({ year: 2027, month: 5, day: 16 });
  });

  it('연도는 올해부터 5년 뒤까지 여섯 개다', () => {
    expect(yearOptions(new Date(2026, 8, 8))).toEqual([2026, 2027, 2028, 2029, 2030, 2031]);
  });

  it('달력은 항상 42칸이고 앞뒤 달의 날로 채운다 — 시안 2027년 5월', () => {
    const cells = monthCells(2027, 5);

    expect(cells).toHaveLength(CALENDAR_CELLS);
    /* 2027-05-01은 토요일 — 첫 주는 4월 25일부터. */
    expect(cells[0]).toMatchObject({ year: 2027, month: 4, day: 25, inMonth: false, weekday: 0 });
    expect(cells[6]).toMatchObject({ month: 5, day: 1, inMonth: true, weekday: 6 });
    expect(cells[21]).toMatchObject({ iso: '2027-05-16', inMonth: true, weekday: 0 });
    expect(cells[36]).toMatchObject({ month: 5, day: 31, inMonth: true });
    expect(cells[37]).toMatchObject({ month: 6, day: 1, inMonth: false });
    expect(cells.filter((cell) => cell.inMonth)).toHaveLength(31);
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
