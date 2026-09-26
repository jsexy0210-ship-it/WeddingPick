import { noteMonthDay, noteMonthDayTime, noteMonthDayWeekday, noteMonthDayWeekdayTime } from './note-format';

describe('웨딩노트 날짜 표기', () => {
  it('정본 「10.7」 · 「9.20 14:02」 · 「9.23(수) 15:00」처럼 달 · 일에 0을 채우지 않는다', () => {
    expect(noteMonthDay('2026-10-07')).toBe('10.7');
    expect(noteMonthDayTime(new Date(2026, 8, 20, 14, 2))).toBe('9.20 14:02');
    expect(noteMonthDayWeekdayTime(new Date(2026, 8, 23, 15, 0))).toBe('9.23(수) 15:00');
    expect(noteMonthDayWeekdayTime(new Date(2026, 9, 7, 9, 5))).toBe('10.7(수) 09:05');
  });

  it('시간 없는 할 일 줄은 정본 「9.30(수)」처럼 요일까지만 적는다', () => {
    expect(noteMonthDayWeekday('2026-09-30')).toBe('9.30(수)');
    expect(noteMonthDayWeekday('2027-01-04')).toBe('1.4(월)');
  });
});
