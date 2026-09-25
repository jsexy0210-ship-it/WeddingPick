/**
 * 예식일 시트의 날짜 범위 계산.
 *
 * 2026-09-25에 휠 3열(WP-APP-023)을 OS 날짜 선택기로 바꾸면서 연 · 월 · 일 목록과
 * 굴린 값을 맞추던 계산(`yearOptions` · `monthOptions` · `dayOptions` · `normalizeDate` ·
 * `clampDay` · `splitIso`)은 쓰는 곳이 없어져 지웠다. 없는 날짜는 OS 선택기가 내주지 않고, 과거는
 * 선택기의 min(`firstSelectable`)으로 막는다.
 */

/** 고를 수 있는 해의 수 — 올해부터 5년 뒤까지(SPEC §13.7 «올해부터 5년 뒤»). 선택기의 max가 된다. */
export const YEAR_SPAN = 6;

const pad = (value: number) => String(value).padStart(2, '0');

export function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export type PickedDate = { year: number; month: number; day: number };

/**
 * 고를 수 있는 첫 날 — 내일. 오늘과 과거는 고를 수 없다(domain `isSelectableWeddingDate`
 * · 결혼식은 미래다). 날짜 선택기의 min이 이 날이다.
 */
export function firstSelectable(today: Date): PickedDate {
  const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  return { year: next.getFullYear(), month: next.getMonth() + 1, day: next.getDate() };
}

/**
 * 고정 크기 격자에 넣기 위해 n개씩 자른다.
 *
 * 날짜와 상관없는 도구인데 여기 있다. 달력 42칸을 6줄로 자르려고 만든 자리고,
 * 지금은 예산 · 준비 현황 · 스타일 격자 셋이 쓴다 — 날짜 쪽 사용처는 없어졌지만 셋이 부르고 있어 옮기지 않았다.
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }

  return rows;
}
