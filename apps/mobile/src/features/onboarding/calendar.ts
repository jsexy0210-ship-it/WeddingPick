/**
 * 날짜 선택 시트(WP-APP-023)의 계산. SPEC §13.7 «날짜 선택 · 연월 셀렉트».
 *
 * 연 · 월은 셀렉트로 바로 고르고 일만 달력에서 찍는다 — 좌우 화살표로 달을 넘기지
 * 않는다. 화면은 여기서 만든 목록과 42칸만 그린다 — 「없는 날짜면 그 달 마지막 날로
 * 당긴다」 「과거는 고를 수 없다」 같은 규칙이 화면 코드에 섞이면 시험할 수 없다.
 */

/** 연도 셀렉트에 펼치는 수 — 올해부터 5년 뒤까지(SPEC §13.7 «올해부터 5년 뒤»). */
export const YEAR_SPAN = 6;

export const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

/** 요일 헤더. 일요일이 첫 칸이다(시안 «일 월 화 수 목 금 토»). */
export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 달력은 항상 6행 × 7칸 — 달마다 높이가 달라지면 시트가 들썩인다. */
export const CALENDAR_ROWS = 6;
export const CALENDAR_CELLS = CALENDAR_ROWS * WEEKDAYS.length;

/*
 * 달력 색(WP-APP-023 · SPEC §13.7). spec/tokens.json에 달력 항목이 없어 여기 이름 붙여
 * 둔다 — 일요일 · 토요일 · 타월(다른 달의 날). 토큰이 생기면 여기만 바꾼다.
 */
export const CALENDAR_SUNDAY = '#E8735F';
export const CALENDAR_SATURDAY = '#5B8DEF';
export const CALENDAR_MUTED = '#DCDEE3';

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

/** 그 달의 날 수. 윤년은 Date가 안다 — 0일은 전달 마지막 날이다. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * 월을 바꿔 없는 날짜가 되면 그 달 마지막 날로 당긴다 — 1월 31일에서 2월로 가면
 * 2월 28일. 오류를 띄우거나 선택을 비우지 않는다.
 */
export function clampDay(year: number, month: number, day: number): number {
  return Math.min(Math.max(day, 1), daysInMonth(year, month));
}

/** 올해부터 5년 뒤까지. */
export function yearOptions(today: Date): number[] {
  return Array.from({ length: YEAR_SPAN }, (_, index) => today.getFullYear() + index);
}

export type PickedDate = { year: number; month: number; day: number };

/**
 * 고를 수 있는 첫 날 — 내일. 오늘과 과거는 고를 수 없다(domain `isSelectableWeddingDate`
 * · 결혼식은 미래다). 달력은 이 날 앞을 비활성으로 그린다.
 */
export function firstSelectable(today: Date): PickedDate {
  const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  return { year: next.getFullYear(), month: next.getMonth() + 1, day: next.getDate() };
}

/** 그 해에 고를 수 있는 달. 첫 해는 첫 날이 속한 달부터. */
export function monthOptions(year: number, first: PickedDate): number[] {
  return year === first.year ? MONTHS.filter((month) => month >= first.month) : MONTHS;
}

/** 이 달을 셀렉트에서 고를 수 있는가 — 첫 날이 속한 달 이후. */
export function isMonthSelectable(year: number, month: number, first: PickedDate): boolean {
  return monthOptions(year, first).includes(month);
}

/** 그 달에 고를 수 있는 날. 첫 달은 첫 날부터, 그 밖에는 1일 … 마지막 날. */
export function dayOptions(year: number, month: number, first?: PickedDate): number[] {
  const from = first && year === first.year && month === first.month ? first.day : 1;

  return Array.from({ length: daysInMonth(year, month) - from + 1 }, (_, index) => from + index);
}

/** 이 날을 고를 수 있는가 — 첫 날(내일) 이후. */
export function isDaySelectable(value: PickedDate, first: PickedDate): boolean {
  return toIso(value.year, value.month, value.day) >= toIso(first.year, first.month, first.day);
}

/**
 * 연 · 월을 바꾼 뒤 나머지 값을 목록 안으로 맞춘다 — 없는 달이면 첫 달, 없는 날이면
 * 그 달 마지막 날(`clampDay`) 또는 첫 날. 선택을 비우지 않는다.
 */
export function normalizeDate(value: PickedDate, first: PickedDate): PickedDate {
  const year = Math.max(value.year, first.year);
  const months = monthOptions(year, first);
  const month = months.includes(value.month) ? value.month : months[0]!;
  const days = dayOptions(year, month, first);
  const day = Math.max(clampDay(year, month, value.day), days[0]!);

  return { year, month, day };
}

export type CalendarCell = PickedDate & {
  iso: string;
  /** 이 달의 날인가. 아니면 앞뒤 달의 «타월»이라 옅게 그리고 누를 수 없다. */
  inMonth: boolean;
  /** 0 = 일요일 … 6 = 토요일. */
  weekday: number;
};

/**
 * 달력 42칸 — 그 달 1일이 속한 주의 일요일부터 6주. 앞뒤 달의 날도 숫자를 채운다
 * (시안 «25 26 27 28 29 30 1 …»). 빈 칸을 두지 않는다.
 */
export function monthCells(year: number, month: number): CalendarCell[] {
  const firstWeekday = new Date(year, month - 1, 1).getDay();

  return Array.from({ length: CALENDAR_CELLS }, (_, index) => {
    const date = new Date(year, month - 1, 1 - firstWeekday + index);

    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      iso: toIso(date.getFullYear(), date.getMonth() + 1, date.getDate()),
      inMonth: date.getMonth() + 1 === month && date.getFullYear() === year,
      weekday: date.getDay(),
    };
  });
}

/** 고정 크기 격자에 넣기 위해 n개씩 자른다. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }

  return rows;
}
