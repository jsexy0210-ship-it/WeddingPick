/**
 * 날짜 선택 시트(WP-APP-023)의 휠 계산. SPEC §13.6 «데이트피커 · 휠 3열».
 *
 * 달력 격자를 쓰지 않는다 — 연 · 월 · 일 세 휠을 한 화면에서 굴린다. 화면은 여기서
 * 만든 목록과 인덱스 계산만 그린다 — 「없는 날짜면 그 달 마지막 날로 당긴다」 같은
 * 규칙이 화면 코드에 섞이면 시험할 수 없다.
 */

/** 연도 휠에 펼치는 수 — 올해부터 5년 뒤까지(SPEC §13.6 «연 범위»). */
export const YEAR_SPAN = 6;

export const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

/*
 * 휠 규격(SPEC §13.6 «규격»). 행 48 · 5행 노출 → 휠 240. 상하 패딩 96(2행)이라
 * 첫·마지막 항목도 중앙 밴드에 온다. 중앙 밴드는 top 96 · height 48.
 */
export const WHEEL_ROW = 48;
export const WHEEL_VISIBLE_ROWS = 5;
export const WHEEL_HEIGHT = WHEEL_ROW * WHEEL_VISIBLE_ROWS;
export const WHEEL_PAD = WHEEL_ROW * Math.floor(WHEEL_VISIBLE_ROWS / 2);

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
 * 월을 바꿔 없는 날짜가 되면 그 달 마지막 날로 당긴다(SPEC §13.6 «동작 규칙») —
 * 1월 31일에서 2월로 굴리면 2월 28일. 오류를 띄우거나 선택을 비우지 않는다.
 */
export function clampDay(year: number, month: number, day: number): number {
  return Math.min(Math.max(day, 1), daysInMonth(year, month));
}

/** 스크롤 오프셋 → 휠 인덱스. 행 경계 사이에서는 가까운 쪽이고, 목록 밖은 끝으로 막는다. */
export function wheelIndexFromOffset(offset: number, count: number, row: number = WHEEL_ROW): number {
  const index = Math.round(offset / row);

  return Math.min(Math.max(index, 0), Math.max(count - 1, 0));
}

/** 올해부터 5년 뒤까지. */
export function yearOptions(today: Date): number[] {
  return Array.from({ length: YEAR_SPAN }, (_, index) => today.getFullYear() + index);
}

export type WheelDate = { year: number; month: number; day: number };

/**
 * 고를 수 있는 첫 날 — 내일. 오늘과 과거는 고를 수 없다(domain `isSelectableWeddingDate`
 * · 결혼식은 미래다). 휠은 이 날 앞의 월 · 일을 목록에 두지 않는다(SPEC §13.6 «과거
 * 날짜는 목록에 두지 않습니다»).
 */
export function firstSelectable(today: Date): WheelDate {
  const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  return { year: next.getFullYear(), month: next.getMonth() + 1, day: next.getDate() };
}

/** 그 해에 고를 수 있는 달. 첫 해는 첫 날이 속한 달부터. */
export function monthOptions(year: number, first: WheelDate): number[] {
  return year === first.year ? MONTHS.filter((month) => month >= first.month) : MONTHS;
}

/** 그 달에 고를 수 있는 날. 첫 달은 첫 날부터, 그 밖에는 1일 … 마지막 날. */
export function dayOptions(year: number, month: number, first?: WheelDate): number[] {
  const from = first && year === first.year && month === first.month ? first.day : 1;

  return Array.from({ length: daysInMonth(year, month) - from + 1 }, (_, index) => from + index);
}

/**
 * 휠 하나를 굴린 뒤 나머지 두 값을 목록 안으로 맞춘다 — 없는 달이면 첫 달, 없는
 * 날이면 그 달 마지막 날(`clampDay`) 또는 첫 날. 선택을 비우지 않는다.
 */
export function normalizeWheelDate(value: WheelDate, first: WheelDate): WheelDate {
  const year = Math.max(value.year, first.year);
  const months = monthOptions(year, first);
  const month = months.includes(value.month) ? value.month : months[0]!;
  const days = dayOptions(year, month, first);
  const day = Math.max(clampDay(year, month, value.day), days[0]!);

  return { year, month, day };
}

/** 고정 크기 격자에 넣기 위해 n개씩 자른다. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }

  return rows;
}
