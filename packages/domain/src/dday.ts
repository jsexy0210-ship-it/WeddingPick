import { formatCount } from './format-number';

/**
 * D-day 표기 — 앱 전체가 **이 두 함수만** 쓴다.
 *
 * 2026-09-26 대표 감사(운영에서 재현): 웨딩노트가 예식 하루 전에 「남은 1주」를, 다음 주 구간에
 * 「D--1」을 보여줬다. 화면마다 `` `D-${days}` ``를 따로 적어서 음수가 오면 부호가 두 번 붙었고,
 * 주 단위 줄은 7일 미만을 1주로 올려 셌다. 부호 · 0 · 단위 규칙을 한 곳으로 모은다.
 *
 * 입력 `days`는 `daysUntil(예식일, 기준일)` — 예식일이 앞이면 양수, 당일 0, 지났으면 음수다.
 */

/**
 * `D-236` · `D-DAY` · `D+3`.
 *
 * - 양수: `D-N` — 정본 `React_Native/note.jsx` WP-NOTE-001 「D-236」 · home.js 「D-2」.
 * - 0: `D-DAY` — SPEC §13.6 «D-day 계산» 표(온보딩 · 홈이 먼저 쓰던 값).
 * - 음수: `D+N` — 지난 날을 센다. `D--1`처럼 부호를 겹치지 않는다.
 *
 * 숫자는 공용 한국어 포맷(`formatCount`)을 거친다 — 1,000일 이상이면 쉼표가 붙는다.
 */
export function formatDday(days: number): string {
  if (days === 0) return 'D-DAY';

  return `D${days > 0 ? '-' : '+'}${formatCount(Math.abs(days))}`;
}

/** 주 단위로 세기 시작하는 날수. 이보다 적게 남으면 일 단위로 적는다. */
export const WEEK_DAYS = 7;

/**
 * D-day 카드 아래 한 줄 — 예식까지 남은 기간.
 *
 * - 7일 이상: `남은 N주` — 주는 올림이다. 정본 WP-NOTE-001 「D-236 · 남은 34주」(236 ÷ 7 = 33.7 → 34).
 * - 1~6일: `남은 N일` — 7일이 안 되는 기간을 「1주」로 올려 세지 않는다(예식 전날이 「남은 1주」였다).
 * - 당일: `예식이 곧이에요` — 이 화면이 전부터 쓰던 문구를 그대로 둔다.
 * - 지난 뒤: `null` — 「남은」 기간이 없다. 화면은 줄을 그리지 않는다.
 */
export function formatRemainingUntilWedding(days: number): string | null {
  if (days < 0) return null;
  if (days === 0) return '예식이 곧이에요';
  if (days < WEEK_DAYS) return `남은 ${formatCount(days)}일`;

  return `남은 ${formatCount(Math.ceil(days / WEEK_DAYS))}주`;
}
