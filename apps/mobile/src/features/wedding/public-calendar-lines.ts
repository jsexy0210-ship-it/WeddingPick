import type { PublicHoliday, WeddingForecast } from '@weddingpick/api-contract';

/**
 * 웨딩노트에 붙는 공공 자료 한 줄 — 2026-09-24 대표 지시 「A안으로 해, 문구도 그대로 진행」.
 *
 * 둘 다 정본(v3.29)에 없던 줄이라 새 모양을 만들지 않는다 — 바로 위 보조 줄(13px ·
 * textSecondary)과 같은 글자로 한 줄만 더한다. 값이 없으면 null을 돌려주고 줄을 그리지 않는다.
 */

/** D-day 카드(WP-NOTE-001): 「예식일 예보 · 비 올 확률 30% · 12~21℃」 */
export function forecastLine(forecast: WeddingForecast | null): string | null {
  if (!forecast) return null;

  return `예식일 예보 · 비 올 확률 ${forecast.rainProbability}% · ${forecast.tempMin}~${forecast.tempMax}℃`;
}

/** 일정 등록 달력(WP-NOTE-002) 아래: 「10월 3일 개천절 · 10월 9일 한글날」 — 보고 있는 달만. */
export function holidayLine(holidays: readonly PublicHoliday[], year: number, month: number): string | null {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  const inMonth = holidays.filter((holiday) => holiday.date.startsWith(prefix));
  if (inMonth.length === 0) return null;

  return inMonth
    .map((holiday) => `${month + 1}월 ${Number(holiday.date.slice(8, 10))}일 ${holiday.name}`)
    .join(' · ');
}

/** 달력 한 장이 보여주는 달의 첫날·끝날(YYYY-MM-DD). */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const pad = (value: number) => String(value).padStart(2, '0');
  const last = new Date(year, month + 1, 0).getDate();

  return { from: `${year}-${pad(month + 1)}-01`, to: `${year}-${pad(month + 1)}-${pad(last)}` };
}
