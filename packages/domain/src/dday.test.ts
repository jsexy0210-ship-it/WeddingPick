import { formatDday, formatRemainingUntilWedding, WEEK_DAYS } from './dday';
import { daysUntil } from './profile';

/**
 * 2026-09-26 대표 감사(운영에서 재현) — 웨딩노트가 예식 하루 전에 「남은 1주」를, 다음 주 구간에
 * 「D--1」을 보여줬다. 부호 · 당일 · 지난 날 · 주 경계를 한 표로 못박는다.
 */
describe('formatDday', () => {
  it.each([
    [236, 'D-236'],
    [1, 'D-1'],
    [0, 'D-DAY'],
    [-1, 'D+1'],
    [-30, 'D+30'],
    [1234, 'D-1,234'],
    [-1234, 'D+1,234'],
  ])('%i일 → %s', (days, label) => {
    expect(formatDday(days)).toBe(label);
  });

  it('어떤 값에도 부호를 겹치지 않는다', () => {
    for (let days = -400; days <= 400; days += 1) {
      expect(formatDday(days)).not.toMatch(/D--|D\+-|D-\+/);
    }
  });

  it('예식일 기준 날짜 계산과 이어 쓴다 — 예식 다음 날 구간은 D+1이다', () => {
    const wedding = '2026-10-10';
    expect(formatDday(daysUntil(wedding, new Date(2026, 9, 9, 23, 0)))).toBe('D-1');
    expect(formatDday(daysUntil(wedding, new Date(2026, 9, 10, 0, 30)))).toBe('D-DAY');
    expect(formatDday(daysUntil(wedding, new Date(2026, 9, 11, 8, 0)))).toBe('D+1');
  });
});

describe('formatRemainingUntilWedding', () => {
  it('정본 WP-NOTE-001 — D-236은 「남은 34주」다(올림)', () => {
    expect(formatRemainingUntilWedding(236)).toBe('남은 34주');
  });

  it.each([
    [1, '남은 1일'],
    [6, '남은 6일'],
    [WEEK_DAYS, '남은 1주'],
    [8, '남은 2주'],
    [13, '남은 2주'],
    [14, '남은 2주'],
    [15, '남은 3주'],
  ])('주 경계 — %i일 → %s', (days, label) => {
    expect(formatRemainingUntilWedding(days)).toBe(label);
  });

  it('예식 전날은 「남은 1주」가 아니다', () => {
    expect(formatRemainingUntilWedding(1)).not.toBe('남은 1주');
  });

  it('당일은 기존 문구, 지난 뒤는 줄을 그리지 않는다', () => {
    expect(formatRemainingUntilWedding(0)).toBe('예식이 곧이에요');
    expect(formatRemainingUntilWedding(-1)).toBeNull();
    expect(formatRemainingUntilWedding(-100)).toBeNull();
  });
});
