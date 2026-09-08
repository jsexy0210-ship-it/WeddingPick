/**
 * 날짜 선택 시트(WP-APP-023)의 달력 계산. SPEC §13.7 «날짜 선택 · 연월 셀렉트».
 *
 * 연 · 월은 셀렉트로 바로 고르고 일만 달력에서 찍는다. 화면은 여기서 만든 칸을
 * 그리기만 한다 — 달의 첫 요일 · 앞뒤 타월 채우기 같은 계산이 화면 코드에 섞이면
 * 시험할 수 없다.
 */

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 연도 셀렉트에 펼치는 수 — 올해부터 5년 뒤까지(SPEC §13.7). */
export const YEAR_SPAN = 6;

export const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

/** 달력 칸 수. 6주 고정 — 달마다 줄 수가 달라지면 시트 높이가 들썩인다. */
export const CALENDAR_CELLS = 42;

export type CalendarCell = {
  /** `YYYY-MM-DD`. */
  iso: string;
  day: number;
  /** 이 달의 날인가. 앞뒤 타월은 옅게 그리고 고를 수 없다. */
  inMonth: boolean;
  /** 0 = 일요일 … 6 = 토요일. */
  weekday: number;
};

const pad = (value: number) => String(value).padStart(2, '0');

export function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** `YYYY-MM-DD` → 연 · 월(1~12) · 일. 모양이 아니면 null. */
export function splitIso(iso: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);

  if (!match) return null;

  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** 한 달의 6주 격자. 첫 줄은 일요일에서 시작하고, 앞뒤는 이웃 달의 날로 채운다. */
export function monthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month - 1, 1);
  const lead = first.getDay();
  const cells: CalendarCell[] = [];

  for (let index = 0; index < CALENDAR_CELLS; index += 1) {
    const date = new Date(year, month - 1, 1 + index - lead);

    cells.push({
      iso: toIso(date.getFullYear(), date.getMonth() + 1, date.getDate()),
      day: date.getDate(),
      inMonth: date.getMonth() === month - 1,
      weekday: date.getDay(),
    });
  }

  return cells;
}

/** 올해부터 5년 뒤까지. */
export function yearOptions(today: Date): number[] {
  return Array.from({ length: YEAR_SPAN }, (_, index) => today.getFullYear() + index);
}

/** 이 달에 고를 수 있는 날이 하나도 없는가 — 오늘이 속한 달보다 앞이면 그렇다. */
export function isPastMonth(year: number, month: number, today: Date): boolean {
  return year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth() + 1);
}

/** 고정 크기 격자에 넣기 위해 n개씩 자른다. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }

  return rows;
}
