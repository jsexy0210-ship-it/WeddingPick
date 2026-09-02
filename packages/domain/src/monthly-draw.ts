/**
 * 월간 웨딩지원금. 최종통합정책 §31.
 *
 * 4개 미션을 모두 마친 달에 자동 응모된다. 매월 2명 추첨, 1인 NPay 5만원.
 * 룰렛·경쟁형 방식은 사용하지 않는다 — 추첨은 조용히 이루어진다.
 *
 * 화면 상태: 응모 전 → 응모 완료 → 발표 대기 → 당첨 / 미당첨.
 *
 * **지급 시점을 약속하지 않는다.** 추첨일이 고정돼 있지 않고, 어뷰징 검증
 * 결과에 따라 늦어질 수 있다. 화면이 날짜를 적으면 지키지 못할 약속이 된다.
 */

export const MONTHLY_DRAW_AMOUNT_KRW = 50_000;

/** 매월 당첨 인원. 정책 §31. */
export const MONTHLY_DRAW_WINNERS_PER_MONTH = 2;

/** 월 최대 예산 = 당첨 인원 × 1인 지급액. */
export const MONTHLY_DRAW_BUDGET_KRW = MONTHLY_DRAW_AMOUNT_KRW * MONTHLY_DRAW_WINNERS_PER_MONTH;

/**
 * 화면이 보여주는 응모 상태.
 *
 * 서버에서 내려오는 상태를 화면이 그대로 쓴다. 화면이 상태를 계산하면 서버와
 * 어긋날 수 있고, 어긋나면 아무도 눈치채지 못한다.
 */
export const MONTHLY_DRAW_STATUSES = [
  'not_entered', // 미션을 아직 다 마치지 않았거나 이번 달 미션을 완료하지 않음
  'entered',     // 이번 달 응모 완료, 발표 전
  'pending',     // 이번 달 응모 완료, 발표일 경과 후 결과 확인 중
  'won',         // 이번 달 당첨
  'not_won',     // 이번 달 미당첨
] as const;

export type MonthlyDrawStatus = (typeof MONTHLY_DRAW_STATUSES)[number];

export const MONTHLY_DRAW_STATUS_LABEL: Record<MonthlyDrawStatus, string> = {
  not_entered: '응모 전',
  entered: '응모 완료',
  pending: '발표 대기',
  won: '당첨',
  not_won: '미당첨',
};

/**
 * 화면에 적는 설명.
 *
 * 상태마다 다른 말을 한다. 금액보다 조건과 절차를 먼저 말한다.
 */
export const MONTHLY_DRAW_STATUS_NOTE: Record<MonthlyDrawStatus, string> = {
  not_entered: '4개 미션을 모두 마치면 이번 달 추첨에 자동으로 응모돼요',
  entered: '이번 달 추첨에 응모됐어요. 발표되면 알림으로 알려드려요',
  pending: '당첨자를 확인하고 있어요. 결과가 나오면 알림으로 알려드려요',
  won: '당첨됐어요. NPay로 지급 절차를 안내드려요',
  not_won: '이번 달은 아쉽게 당첨되지 않았어요. 다음 달에도 자동으로 응모돼요',
};

/** 진입 안내. 조건을 먼저 말한다. */
export const MONTHLY_DRAW_NOTICE =
  '4개 미션을 모두 마치면 매달 추첨에 자동으로 응모돼요. 매월 2명을 뽑아 NPay 5만원을 드려요';

/** 응모 기준 달. 'YYYY-MM' 형식. */
export function drawMonthOf(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
