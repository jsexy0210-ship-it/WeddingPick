/**
 * OS 날짜 · 시간 선택 필드가 네이티브와 웹에서 함께 쓰는 값 규칙.
 *
 * 값은 문자열 하나다 — 날짜 `YYYY-MM-DD`, 시간 `HH:MM`(24시간). 웹의
 * `<input type="date">` · `<input type="time">`이 주고받는 꼴과 같아서 웹은 그대로
 * 넘기고, 네이티브는 `Date`와 이 꼴 사이만 바꾼다.
 */

export type OsDateFieldProps = {
  label: string;
  /** `YYYY-MM-DD`. 아직 안 골랐으면 null. */
  value: string | null;
  placeholder: string;
  onChange: (day: string) => void;
  /** 고를 수 있는 첫 날 `YYYY-MM-DD`(포함). */
  min?: string;
  /** 고를 수 있는 마지막 날 `YYYY-MM-DD`(포함). */
  max?: string;
  /** 필드 테두리를 코랄로 — 일정 추가의 날짜 칸(note.js `dateVal`). */
  accent?: boolean;
  testID?: string;
};

export type OsTimeFieldProps = {
  label: string;
  /** `HH:MM`(24시간). 아직 안 골랐으면 null. */
  value: string | null;
  placeholder: string;
  onChange: (time: string) => void;
  testID?: string;
};

const pad = (value: number) => String(value).padStart(2, '0');

export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function dayOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function timeOf(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `YYYY-MM-DD` → 그날 로컬 자정. 모양이 아니면 null. */
export function dateOfDay(day: string | null | undefined): Date | null {
  if (!day || !DAY_PATTERN.test(day)) return null;

  const [year, month, date] = day.split('-').map(Number);

  return new Date(year!, month! - 1, date!);
}

/** `HH:MM` → 오늘 그 시각. 모양이 아니면 null. */
export function dateOfTime(time: string | null | undefined): Date | null {
  const match = time ? TIME_PATTERN.exec(time) : null;

  if (!match) return null;

  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(match[1]), Number(match[2]));
}

/**
 * 범위 밖의 날은 받지 않는다 — OS 선택기가 막아 주지만 웹 데스크톱은 칸에 직접
 * 적을 수 있다. 문자열 비교로 충분하다(`YYYY-MM-DD`는 사전순이 곧 날짜순).
 */
export function acceptDay(day: string, min?: string, max?: string): boolean {
  if (!DAY_PATTERN.test(day)) return false;
  if (min && day < min) return false;
  if (max && day > max) return false;

  return true;
}

/** 처음 열 때 선택기가 가리킬 날 — 고른 값, 없으면 오늘을 범위 안으로 당긴 날. */
export function initialDate(value: string | null, min?: string, max?: string): Date {
  const picked = dateOfDay(value);

  if (picked) return picked;

  const today = dayOf(new Date());

  if (min && today < min) return dateOfDay(min)!;
  if (max && today > max) return dateOfDay(max)!;

  return dateOfDay(today)!;
}
