/**
 * 화면에 나가는 모든 숫자는 이 함수를 거친다(2026-09-15 대표 지시 — 「항상 모든
 * 숫자는 천단위 [,] 처리한다」). 로케일을 `'ko-KR'`로 못 박는다 — 로케일 없이
 * `toLocaleString()`을 부르면 기기 설정을 따라가서 독일어 기기에서 `1.234`,
 * 프랑스어 기기에서 `1 234`가 된다. 한국 사용자가 외국어로 맞춰둔 기기를 쓰면
 * 숫자 표기가 바뀌는 자리다.
 *
 * 금액(원 · 만원) 표기는 별도 규칙이 붙어 있어 이 함수를 쓰지 않는다 —
 * `manwon`/`rangeLabel`(disclosure.ts) · `formatWon`(withdrawal.ts) ·
 * `priceLine`(guide-price.ts)를 그대로 쓴다.
 */
export function formatCount(value: number): string {
  return value.toLocaleString('ko-KR');
}
