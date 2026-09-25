/**
 * 웨딩노트 날짜 표기 — `docs/design/React_Native/note.js` 값 그대로다.
 * 지출내역 `spends` 「10.7」 · 변경내역 `changeLog` 「9.20 14:02」처럼 달 · 일을 0으로
 * 채우지 않고 요일도 붙이지 않는다.
 */

function toDate(value: string | Date): Date {
  // `YYYY-MM-DD`(날짜만)는 UTC 자정으로 읽히지 않게 그 날의 로컬 자정으로 만든다.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return typeof value === 'string' ? new Date(value) : value;
}

/** `10.7` */
export function noteMonthDay(value: string | Date): string {
  const date = toDate(value);
  return `${date.getMonth() + 1}.${date.getDate()}`;
}

/** `9.20 14:02` */
export function noteMonthDayTime(value: string | Date): string {
  const date = toDate(value);
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${noteMonthDay(date)} ${hour}:${minute}`;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** `9.23(수) 15:00` — 웨딩일정 타임라인 카드 위 줄(`tlItem` time). */
export function noteMonthDayWeekdayTime(value: string | Date): string {
  const date = toDate(value);
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${noteMonthDay(date)}(${WEEKDAYS[date.getDay()]}) ${hour}:${minute}`;
}
