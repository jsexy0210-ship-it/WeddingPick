import {
  clampParts,
  dayItems,
  joinTime,
  MINUTE_ITEMS,
  monthItems,
  splitTime,
  wheelBounds,
  yearItems,
} from './os-picker-field.shared';

/** 디자인된 날짜 · 시간 휠(`wheel-picker-sheet.tsx`)이 굴리는 목록과 값 맞춤. */
describe('날짜 휠 — 년 · 월 · 일', () => {
  const today = new Date(2026, 8, 25);

  it('min · max 밖은 목록에 오르지 않는다', () => {
    const { first, last } = wheelBounds('2026-09-25', '2027-02-10', today);

    expect(yearItems(first, last)).toEqual([2026, 2027]);
    expect(monthItems(2026, first, last)).toEqual([9, 10, 11, 12]);
    expect(monthItems(2027, first, last)).toEqual([1, 2]);
    expect(dayItems(2026, 9, first, last)[0]).toBe(25);
    expect(dayItems(2027, 2, first, last).at(-1)).toBe(10);
  });

  it('범위를 안 넘기면 올해 앞뒤 5년', () => {
    const { first, last } = wheelBounds(undefined, undefined, today);

    expect(first).toEqual({ year: 2021, month: 1, day: 1 });
    expect(last).toEqual({ year: 2031, month: 12, day: 31 });
  });

  it('월에 따라 일 수가 맞춰진다 — 1월 31일에서 2월로 굴리면 말일로 당긴다', () => {
    const { first, last } = wheelBounds(undefined, undefined, today);

    expect(dayItems(2028, 2, first, last)).toHaveLength(29);
    expect(clampParts({ year: 2027, month: 2, day: 31 }, first, last)).toEqual({ year: 2027, month: 2, day: 28 });
  });

  it('범위 밖 값은 가장 가까운 끝으로 맞춘다', () => {
    const { first, last } = wheelBounds('2026-09-25', '2027-02-10', today);

    expect(clampParts({ year: 2026, month: 3, day: 1 }, first, last)).toEqual({ year: 2026, month: 9, day: 25 });
    expect(clampParts({ year: 2027, month: 2, day: 20 }, first, last)).toEqual({ year: 2027, month: 2, day: 10 });
  });
});

describe('시간 휠 — 오전/오후 · 시 · 분', () => {
  it('분은 10분 단위다', () => {
    expect(MINUTE_ITEMS).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it('24시간 값을 오전/오후 · 12시간으로 쪼개고 다시 합친다', () => {
    expect(splitTime('14:00')).toEqual({ meridiem: 'pm', hour: 2, minute: 0 });
    expect(splitTime('00:30')).toEqual({ meridiem: 'am', hour: 12, minute: 30 });
    expect(splitTime('12:05')).toEqual({ meridiem: 'pm', hour: 12, minute: 0 });
    expect(joinTime({ meridiem: 'am', hour: 12, minute: 30 })).toBe('00:30');
    expect(joinTime({ meridiem: 'pm', hour: 12, minute: 0 })).toBe('12:00');
    expect(joinTime({ meridiem: 'pm', hour: 9, minute: 50 })).toBe('21:50');
    expect(splitTime('9:00')).toBeNull();
  });
});
