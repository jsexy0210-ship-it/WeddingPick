import { noteMonthDay, noteMonthDayTime, noteMonthDayWeekdayTime } from './note-format';

describe('웨딩노트 날짜 표기', () => {
  it('정본 「10.7」 · 「9.20 14:02」 · 「9.23(수) 15:00」처럼 달 · 일에 0을 채우지 않는다', () => {
    expect(noteMonthDay('2026-10-07')).toBe('10.7');
    expect(noteMonthDayTime(new Date(2026, 8, 20, 14, 2))).toBe('9.20 14:02');
    expect(noteMonthDayWeekdayTime(new Date(2026, 8, 23, 15, 0))).toBe('9.23(수) 15:00');
    expect(noteMonthDayWeekdayTime(new Date(2026, 9, 7, 9, 5))).toBe('10.7(수) 09:05');
  });
});
