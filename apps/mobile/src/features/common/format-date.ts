import { formatDateDot } from '@weddingpick/domain';

export { formatDateDot };

/**
 * 날짜 표기 파생형 — 전역 고정(핸드오프 v3.21 · SPEC 11.1 · 13.5.5 이웃 항목).
 *
 * 기본형은 `2027.05.16(토)`(`formatDateDot`). 연도가 문맥상 분명한 자리는
 * `05.16(토)`, 시각이 붙는 자리는 `05.16(토) 14:30` · `2027.05.16(토) 14:30`.
 * «N월 N일» · «N년 N월 N일» 같은 서술형은 약관 본문 밖에서 쓰지 않는다.
 */

/** `05.16(토)` — 연도를 뺀 월·일·요일. */
export function formatMonthDayDot(date: string | Date): string {
  return formatDateDot(date).slice(5);
}

/** `14:30` — 24시간 두 자리. */
export function formatTimeHm(date: string | Date): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  const hour = String(value.getHours()).padStart(2, '0');
  const minute = String(value.getMinutes()).padStart(2, '0');

  return `${hour}:${minute}`;
}

/** `05.16(토) 14:30` */
export function formatMonthDayTimeDot(date: string | Date): string {
  return `${formatMonthDayDot(date)} ${formatTimeHm(date)}`;
}

/** `2027.05.16(토) 14:30` — 연도가 필요한 기록(관리자 로그 등). */
export function formatDateTimeDot(date: string | Date): string {
  return `${formatDateDot(date)} ${formatTimeHm(date)}`;
}
