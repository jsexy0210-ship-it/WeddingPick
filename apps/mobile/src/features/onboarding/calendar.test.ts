import {
  WHEEL_HEIGHT,
  WHEEL_PAD,
  WHEEL_ROW,
  chunk,
  clampDay,
  dayOptions,
  daysInMonth,
  firstSelectable,
  monthOptions,
  normalizeWheelDate,
  splitIso,
  toIso,
  wheelIndexFromOffset,
  yearOptions,
} from './calendar';

describe('휠 3열 날짜 계산', () => {
  it('휠 규격 — 행 48 · 5행 · 240 · 상하 패딩 96 (SPEC §13.6)', () => {
    expect(WHEEL_ROW).toBe(48);
    expect(WHEEL_HEIGHT).toBe(240);
    expect(WHEEL_PAD).toBe(96);
  });

  it('달의 날 수 — 윤년 2월은 29일', () => {
    expect(daysInMonth(2027, 5)).toBe(31);
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(dayOptions(2027, 4)).toHaveLength(30);
    expect(dayOptions(2027, 4)[0]).toBe(1);
  });

  it('월을 바꿔 없는 날짜가 되면 그 달 마지막 날로 당긴다', () => {
    /* 1월 31일에서 2월로 굴리면 2월 28일. */
    expect(clampDay(2027, 2, 31)).toBe(28);
    expect(clampDay(2028, 2, 31)).toBe(29);
    expect(clampDay(2027, 5, 16)).toBe(16);
    expect(clampDay(2027, 5, 0)).toBe(1);
  });

  it('스크롤 오프셋을 가까운 행으로 읽고 목록 밖은 끝으로 막는다', () => {
    expect(wheelIndexFromOffset(0, 12)).toBe(0);
    expect(wheelIndexFromOffset(48 * 4, 12)).toBe(4);
    expect(wheelIndexFromOffset(48 * 4 + 23, 12)).toBe(4);
    expect(wheelIndexFromOffset(48 * 4 + 25, 12)).toBe(5);
    expect(wheelIndexFromOffset(-30, 12)).toBe(0);
    expect(wheelIndexFromOffset(48 * 20, 12)).toBe(11);
  });

  it('과거는 목록에 없다 — 첫 해는 내일이 속한 달부터, 첫 달은 내일부터', () => {
    const first = firstSelectable(new Date(2026, 8, 8, 8, 30));

    expect(first).toEqual({ year: 2026, month: 9, day: 9 });
    expect(monthOptions(2026, first)).toEqual([9, 10, 11, 12]);
    expect(monthOptions(2027, first)).toHaveLength(12);
    expect(dayOptions(2026, 9, first)[0]).toBe(9);
    expect(dayOptions(2026, 9, first)).toHaveLength(22);
    expect(dayOptions(2026, 10, first)[0]).toBe(1);
    /* 12월 31일의 «내일»은 다음 해다. */
    expect(firstSelectable(new Date(2026, 11, 31))).toEqual({ year: 2027, month: 1, day: 1 });
  });

  it('휠을 굴린 뒤 나머지 값을 목록 안으로 맞춘다', () => {
    const first = { year: 2026, month: 9, day: 9 };

    /* 2027년 1월 31일에서 월을 2월로 → 2월 28일. */
    expect(normalizeWheelDate({ year: 2027, month: 2, day: 31 }, first)).toEqual({ year: 2027, month: 2, day: 28 });
    /* 2027년 3월 5일에서 연도를 2026년으로 → 3월은 목록에 없어 9월, 5일은 9일로. */
    expect(normalizeWheelDate({ year: 2026, month: 3, day: 5 }, first)).toEqual({ year: 2026, month: 9, day: 9 });
    expect(normalizeWheelDate({ year: 2027, month: 5, day: 16 }, first)).toEqual({ year: 2027, month: 5, day: 16 });
  });

  it('연도는 올해부터 5년 뒤까지 여섯 개다', () => {
    expect(yearOptions(new Date(2026, 8, 8))).toEqual([2026, 2027, 2028, 2029, 2030, 2031]);
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
