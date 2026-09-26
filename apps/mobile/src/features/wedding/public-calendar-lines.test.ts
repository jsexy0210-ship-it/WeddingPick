import { forecastLine, holidayLine, monthRange } from './public-calendar-lines';

describe('웨딩노트 공공 자료 한 줄', () => {
  it('예보는 승인된 문구 그대로 쓴다', () => {
    expect(forecastLine({ date: '2026-10-03', rainProbability: 30, tempMin: 12, tempMax: 21 })).toBe(
      '예식일 예보 · 비 올 확률 30% · 12~21℃'
    );
  });

  it('예보가 없으면 줄을 그리지 않는다', () => {
    expect(forecastLine(null)).toBeNull();
  });

  it('공휴일은 보고 있는 달 것만 이어 쓴다', () => {
    const holidays = [
      { date: '2026-09-25', name: '추석' },
      { date: '2026-10-03', name: '개천절' },
      { date: '2026-10-09', name: '한글날' },
    ];
    expect(holidayLine(holidays, 2026, 9)).toBe('10월 3일 개천절 · 10월 9일 한글날');
    expect(holidayLine(holidays, 2026, 10)).toBeNull();
  });

  it('달의 첫날과 끝날을 준다', () => {
    expect(monthRange(2026, 1)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange(2026, 11)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
});
