/**
 * 날짜 선택 시트(WP-APP-023)의 계산.
 *
 * 화면은 여기서 만든 세 목록(연 · 월 · 일)만 휠에 걸고, 굴린 뒤 `normalizeDate`를
 * 지난다 — 「없는 날짜면 그 달 마지막 날로 당긴다」 「과거는 고를 수 없다」 같은
 * 규칙이 화면 코드에 섞이면 시험할 수 없다.
 *
 * **과거는 목록에서 빼서 막는다.** 비활성으로 그려 놓고 누르면 되돌리는 것이
 * 아니라 `first`(내일) 앞의 해 · 달 · 날을 애초에 만들지 않는다 — 휠에서는 밴드에
 * 걸릴 수 없는 값이 곧 고를 수 없는 값이다.
 */

/** 연도 셀렉트에 펼치는 수 — 올해부터 5년 뒤까지(SPEC §13.7 «올해부터 5년 뒤»). */
export const YEAR_SPAN = 6;

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

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

/** 그 달에 고를 수 있는 날. 첫 달은 첫 날부터, 그 밖에는 1일 … 마지막 날. */
export function dayOptions(year: number, month: number, first?: PickedDate): number[] {
  const from = first && year === first.year && month === first.month ? first.day : 1;

  return Array.from({ length: daysInMonth(year, month) - from + 1 }, (_, index) => from + index);
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

/**
 * 고정 크기 격자에 넣기 위해 n개씩 자른다.
 *
 * 날짜와 상관없는 도구인데 여기 있다. 달력 42칸을 6줄로 자르려고 만든 자리고,
 * 지금은 예산 · 준비 현황 · 스타일 격자 셋이 쓴다 — 달력이 휠로 바뀌어 마지막
 * 날짜 쪽 사용처가 없어졌지만 셋이 부르고 있어 옮기지 않았다.
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }

  return rows;
}
