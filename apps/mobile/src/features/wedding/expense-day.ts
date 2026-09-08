/**
 * 낸 날짜 — WP-OUR-014(지출 추가)와 결제인증 등록 화면이 같은 규칙으로 읽고 쓴다.
 *
 * 화면 안의 값은 `YYYY-MM-DD`(로컬 날짜)이고, 서버로 갈 때만 ISO 시각이 된다.
 * 시각을 모르면 그날 **정오**로 둔다 — 자정은 시간대 경계에 걸려 하루가 어긋난다.
 */

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD`인지. 형태만 본다 — 실제 날짜인지는 `dayToTimestamp`가 답한다. */
export function isDay(value: string): boolean {
  return DAY_PATTERN.test(value);
}

/** 오늘(로컬)을 `YYYY-MM-DD`로. */
export function todayDay(now: Date = new Date()): string {
  return toDay(now);
}

/** Date(로컬) → `YYYY-MM-DD`. */
export function toDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/** `YYYY-MM-DD` → 그날 정오의 ISO. 날짜가 아니면 null. */
export function dayToTimestamp(day: string): string | null {
  if (!isDay(day)) return null;

  const parsed = new Date(`${day}T12:00:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * 파라미터로 받은 값(`YYYY-MM-DD` 또는 ISO)을 `YYYY-MM-DD`로. 읽을 수 없으면 null —
 * 채우지 않는 것이 엉뚱한 날짜를 채우는 것보다 낫다.
 */
export function paramToDay(value: string | undefined): string | null {
  if (!value) return null;
  if (isDay(value)) return value;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : toDay(parsed);
}
