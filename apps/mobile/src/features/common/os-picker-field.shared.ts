/**
 * 날짜 · 시간 선택 필드(`OsDateField` · `OsTimeField`)와 휠 시트(`wheel-picker-sheet.tsx`)의 값 규칙.
 *
 * 값은 문자열 하나다 — 날짜 `YYYY-MM-DD`, 시간 `HH:MM`(24시간). 휠은 이 꼴을 연 · 월 · 일,
 * 오전/오후 · 시 · 분으로 쪼개 굴리고 다시 합친다. 화면 코드에 섞이면 시험할 수 없어 여기 둔다.
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

/** `YYYY-MM-DD` → 그날 로컬 자정. 모양이 아니면 null. */
export function dateOfDay(day: string | null | undefined): Date | null {
  if (!day || !DAY_PATTERN.test(day)) return null;

  const [year, month, date] = day.split('-').map(Number);

  return new Date(year!, month! - 1, date!);
}

/**
 * 범위 밖의 날은 받지 않는다 — 휠이 목록에서 빼 두지만 확인 직전에 한 번 더 막는다. 문자열 비교로 충분하다(`YYYY-MM-DD`는 사전순이 곧 날짜순).
 */
export function acceptDay(day: string, min?: string, max?: string): boolean {
  if (!DAY_PATTERN.test(day)) return false;
  if (min && day < min) return false;
  if (max && day > max) return false;

  return true;
}


/* ── 날짜 휠(년 · 월 · 일 3열) ─────────────────────────────────────────── */

export type DayParts = { year: number; month: number; day: number };

/** min · max를 안 넘긴 필드가 휠에 펼치는 범위 — 올해 앞뒤 5년. */
export const DEFAULT_YEARS_AROUND = 5;

export function splitDay(day: string): DayParts | null {
  if (!DAY_PATTERN.test(day)) return null;

  const [year, month, date] = day.split('-').map(Number);

  return { year: year!, month: month!, day: date! };
}

export function joinDay({ year, month, day }: DayParts): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** 그 달의 날 수. 윤년은 Date가 안다 — 0일은 전달 마지막 날이다. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 휠이 펼치는 첫 날 · 마지막 날. 넘겨받은 min · max가 없으면 올해 앞뒤 5년. */
export function wheelBounds(min: string | undefined, max: string | undefined, today: Date): { first: DayParts; last: DayParts } {
  const year = today.getFullYear();

  return {
    first: (min && splitDay(min)) || { year: year - DEFAULT_YEARS_AROUND, month: 1, day: 1 },
    last: (max && splitDay(max)) || { year: year + DEFAULT_YEARS_AROUND, month: 12, day: 31 },
  };
}

const range = (from: number, to: number) => Array.from({ length: Math.max(to - from + 1, 0) }, (_, at) => from + at);

/**
 * 세 열의 목록. **범위 밖은 목록에 아예 오르지 않는다** — 밴드에 걸릴 수 없는 값은 고를 수도
 * 없다. 월에 따라 일 수가 맞춰진다(2월 28 · 29일).
 */
export function yearItems(first: DayParts, last: DayParts): number[] {
  return range(first.year, last.year);
}

export function monthItems(year: number, first: DayParts, last: DayParts): number[] {
  return range(year === first.year ? first.month : 1, year === last.year ? last.month : 12);
}

export function dayItems(year: number, month: number, first: DayParts, last: DayParts): number[] {
  const from = year === first.year && month === first.month ? first.day : 1;
  const to = year === last.year && month === last.month ? last.day : daysInMonth(year, month);

  return range(from, to);
}

/**
 * 굴린 뒤 나머지 값을 목록 안으로 맞춘다 — 1월 31일에서 월을 2월로 굴리면 2월 28일(윤년 29일),
 * 범위 밖이면 가장 가까운 끝. 선택을 비우지 않는다.
 */
export function clampParts(value: DayParts, first: DayParts, last: DayParts): DayParts {
  const year = Math.min(Math.max(value.year, first.year), last.year);
  const months = monthItems(year, first, last);
  const month = Math.min(Math.max(value.month, months[0]!), months[months.length - 1]!);
  const days = dayItems(year, month, first, last);
  const day = Math.min(Math.max(value.day, days[0]!), days[days.length - 1]!);

  return { year, month, day };
}

/* ── 시간 휠(오전/오후 · 시 · 분 3열) ─────────────────────────────────── */

export type Meridiem = 'am' | 'pm';

export type TimeParts = { meridiem: Meridiem; hour: number; minute: number };

/**
 * 분 열의 간격. **RN 정본에 시간 휠 그림이 없다**(`DESIGN_UNRESOLVED`) — 10분 단위로 둔다.
 * 정본이 정해지면 이 한 값만 바꾼다.
 */
export const MINUTE_STEP = 10;

export const MERIDIEM_ITEMS: readonly Meridiem[] = ['am', 'pm'];
export const HOUR_ITEMS: readonly number[] = range(1, 12);
export const MINUTE_ITEMS: readonly number[] = range(0, Math.floor(59 / MINUTE_STEP)).map((at) => at * MINUTE_STEP);

/** `HH:MM` → 오전/오후 · 1~12시 · 분(간격에 맞춰 내림). 모양이 아니면 null. */
export function splitTime(time: string | null | undefined): TimeParts | null {
  const match = time ? TIME_PATTERN.exec(time) : null;

  if (!match) return null;

  const hours = Number(match[1]);
  const minute = Math.floor(Number(match[2]) / MINUTE_STEP) * MINUTE_STEP;

  return { meridiem: hours < 12 ? 'am' : 'pm', hour: hours % 12 === 0 ? 12 : hours % 12, minute };
}

/** 오전 12시는 00시, 오후 12시는 12시다. */
export function joinTime({ meridiem, hour, minute }: TimeParts): string {
  const hours = (hour % 12) + (meridiem === 'pm' ? 12 : 0);

  return `${pad(hours)}:${pad(minute)}`;
}
