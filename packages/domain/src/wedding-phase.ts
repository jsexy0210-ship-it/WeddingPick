import { daysUntil } from './profile';

/**
 * 결혼 준비 중인가, 예식이 끝났는가. 최종통합정책 v2.0 D-4 · 원문 34번.
 *
 * **저장하지 않고 계산한다.** 핸드오프가 명시한 규칙이고("저장해두면 반드시
 * 어긋난다"), 여기서는 더 분명하다 — 아무 일도 일어나지 않아도 **시간이 지나면
 * 저절로 바뀌는 값**이다. 저장하면 그 값을 바꿔줄 사람이나 배치가 필요해지고,
 * 그게 멈추면 예식이 끝난 사람이 영영 준비 중으로 남는다.
 */

export const WEDDING_PHASES = ['preparing', 'completed'] as const;

export type WeddingPhase = (typeof WEDDING_PHASES)[number];

export const WEDDING_PHASE_LABEL: Record<WeddingPhase, string> = {
  preparing: '결혼 준비 중',
  completed: '예식 완료',
};

/**
 * 예식일이 지났는가.
 *
 * **예식 당일은 아직 준비 중이다.** 그날 아침에 앱을 열면 오늘이 예식일이라고
 * 말해야지, 끝났다고 말하면 안 된다.
 *
 * 예식일을 등록하지 않은 사람은 준비 중이다 — 모르는 것을 끝났다고 하지 않는다.
 */
export function weddingPhase(weddingDate: string | null, now: Date = new Date()): WeddingPhase {
  if (weddingDate === null) return 'preparing';

  return daysUntil(weddingDate, now) < 0 ? 'completed' : 'preparing';
}

/**
 * 준비 단계 알림을 보낼 때인가. D-4.
 *
 * 예식이 끝난 사람에게 "드레스 투어를 예약해보세요"라고 보내는 것은 안내가
 * 아니라 실례다.
 */
export function shouldSendPreparationNudges(phase: WeddingPhase): boolean {
  return phase === 'preparing';
}

/**
 * 예식 완료 뒤에 권할 것. D-4가 정한 셋이다.
 *
 * **계정을 제한하지 않는다**(원문 34번). 지출·일정·결제내역·후기·관심업체는 그대로
 * 볼 수 있고, 여기 있는 것은 막는 목록이 아니라 **권하는 목록**이다.
 */
export const COMPLETED_ACTIONS = [
  {
    key: 'review',
    title: '이용후기를 남겨주세요',
    description: '다음 사람이 같은 자리에서 헤매지 않게 도와줄 수 있어요',
  },
  {
    key: 'payment',
    title: '남은 Pick 인증 자료를 올려주세요',
    description: '잔금까지 등록하면 총지출이 맞아떨어져요',
  },
  {
    key: 'expenses',
    title: '총지출을 정리해보세요',
    description: '얼마를 어디에 썼는지 한눈에 볼 수 있어요',
  },
] as const;

export type CompletedAction = (typeof COMPLETED_ACTIONS)[number];

export const COMPLETED_GREETING = '결혼을 축하해요';
