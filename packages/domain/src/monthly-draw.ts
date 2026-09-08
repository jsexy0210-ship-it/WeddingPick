/**
 * 월간 웨딩지원금. 최종통합정책 §31.
 *
 * 응모 조건 3개(예식일과 지역 · Pick 인증 1건 · 배우자 연결)를 채운 회차에 자동
 * 응모된다. 회차당 1커플, Npay 5만원(핸드오프 v3.22 · WP-EVT-005). 룰렛·경쟁형
 * 방식은 사용하지 않는다 — 추첨은 조용히 이루어진다.
 *
 * **운영 기간을 화면에 적지 않는다.** 「매달」 「~까지」 「마감」 「당첨 확률」처럼 운영이
 * 바뀌면 틀리는 숫자는 문구에 넣지 않는다. 「새 회차가 열리면 알려드려요」로 쓴다.
 *
 * 화면 상태: 응모 전 → 응모 완료 → 발표 대기 → 당첨 / 미당첨.
 *
 * **지급 시점을 약속하지 않는다.** 추첨일이 고정돼 있지 않고, 어뷰징 검증
 * 결과에 따라 늦어질 수 있다. 화면이 날짜를 적으면 지키지 못할 약속이 된다.
 */

export const MONTHLY_DRAW_AMOUNT_KRW = 50_000;

/** 회차당 당첨 커플 수. 핸드오프 v3.22 이벤트 예산(월간 웨딩지원금 50,000원 × 1커플). */
export const MONTHLY_DRAW_WINNERS_PER_MONTH = 1;

/** 월 최대 예산 = 당첨 인원 × 1인 지급액. */
export const MONTHLY_DRAW_BUDGET_KRW = MONTHLY_DRAW_AMOUNT_KRW * MONTHLY_DRAW_WINNERS_PER_MONTH;

/**
 * 화면이 보여주는 응모 상태.
 *
 * 서버에서 내려오는 상태를 화면이 그대로 쓴다. 화면이 상태를 계산하면 서버와
 * 어긋날 수 있고, 어긋나면 아무도 눈치채지 못한다.
 */
export const MONTHLY_DRAW_STATUSES = [
  'not_entered', // 응모 조건을 아직 다 채우지 않음
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
  not_entered: '조건을 채우면 자동으로 응모돼요',
  entered: '응모됐어요. 당첨자를 알림으로 알려드려요',
  pending: '당첨자를 확인하고 있어요. 결과가 나오면 알림으로 알려드려요',
  won: '당첨됐어요. Npay로 보내드릴게요',
  not_won: '이번 회차는 미당첨이에요. 다음 회차에 다시 응모할 수 있어요',
};

/** 진입 안내. 조건을 먼저 말한다. 기간 · 인원 · 확률을 적지 않는다. */
export const MONTHLY_DRAW_NOTICE = '조건을 채우면 자동으로 응모돼요. 새 회차가 열리면 알려드려요';

/**
 * 응모 조건 3개. 순서가 화면 순서다(WP-EVT-005 · WP-SHT-017).
 *
 * 미션 4개와 다르다 — 미션은 앱을 익히는 순서고, 응모 조건은 실 제보와 배우자
 * 연결이라는 데이터가 생기는 행동이다.
 */
export const MONTHLY_DRAW_CONDITION_KEYS = ['wedding_set', 'payment_proof', 'partner'] as const;

export type MonthlyDrawConditionKey = (typeof MONTHLY_DRAW_CONDITION_KEYS)[number];

export const MONTHLY_DRAW_CONDITION_LABEL: Record<MonthlyDrawConditionKey, string> = {
  wedding_set: '예식일과 지역 설정',
  payment_proof: 'Pick 인증 1건 이상',
  partner: '배우자와 연결',
};

export type MonthlyDrawCondition = {
  key: MonthlyDrawConditionKey;
  label: string;
  done: boolean;
};

/**
 * 혜택 안내 시트(WP-SHT-017) 제목. 남은 조건 수로 만든다.
 *
 * 0개면 시트를 띄우지 않고 응모 완료 알림으로 대신한다 — 그때는 null.
 */
export function benefitSheetTitle(remaining: number): string | null {
  switch (remaining) {
    case 0:
      return null;
    case 1:
      return '하나만 더 하면';
    case 2:
      return '두 가지만 더 하면';
    default:
      return '세 가지만 하면';
  }
}

/** 응모 완료 알림(WP-SHT-017 · 남은 조건 0개). */
export const MONTHLY_DRAW_ENTERED_NOTIFICATION = {
  title: '웨딩지원금에 응모됐어요',
  body: '조건을 다 채워 이번 회차에 자동으로 응모됐어요. 당첨자를 알림으로 알려드려요',
} as const;

/** 응모 기준 달. 'YYYY-MM' 형식. */
export function drawMonthOf(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
