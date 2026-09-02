import type { AiFeature } from './ai-cost';

/**
 * AI를 부르기 전에 지나는 관문. 화면데이터구조 스펙 7.3.
 *
 * 스펙이 정한 순서는 이렇다:
 *
 *   DB 재사용 → 캐시 → 함수 → 규칙 엔진 → 이벤트 자동화 → 저비용 AI → 고성능 AI
 *
 * 이 파일은 그 순서의 **마지막 두 칸 앞에 있는 문**이다. 부를 수 있는지를 먼저 묻고,
 * 못 부르면 왜 못 부르는지를 이름으로 남긴다.
 *
 * **모르는 것을 0으로 세지 않는다.** 한도를 정한 적이 없으면 `unlimited`이고, 그건
 * "제한 0회"가 아니다. 예산과 같은 규칙이다 — 정해지기 전에는 숫자를 지어내지 않는다.
 * 지어낸 한도를 걸어두면 실제로 얼마나 부르는지 재보기도 전에 막히고, 왜 막혔는지는
 * 아무도 모른다.
 */

export type DailyCallState =
  | { kind: 'unlimited' }
  | { kind: 'within'; used: number; limit: number; remaining: number }
  | { kind: 'exceeded'; used: number; limit: number };

/**
 * 오늘 이 사람이 더 부를 수 있는가.
 *
 * `limit`이 없으면 한도를 정한 적이 없다는 뜻이다. 0은 다른 뜻이다 — 한 번도 부르지
 * 못하게 막겠다는 결정이고, 그건 누군가 그렇게 정했을 때만 나온다.
 */
export function dailyCallState(input: {
  used: number;
  limit?: number | null;
}): DailyCallState {
  const { limit } = input;

  if (limit === null || limit === undefined) return { kind: 'unlimited' };

  return input.used >= limit
    ? { kind: 'exceeded', used: input.used, limit }
    : { kind: 'within', used: input.used, limit, remaining: limit - input.used };
}

/**
 * 왜 부르지 못했는가.
 *
 * `null`이면 부를 수 있다. 이름을 남기는 이유는 **한 가지 이유로 뭉뚱그리지 않기
 * 위해서다** — 예산이 바닥난 것과 그 사람이 오늘 많이 부른 것은 다른 일이고,
 * 운영이 해야 할 일도 다르다.
 */
export type CallBlock = 'budget' | 'daily_limit';

export function blockedReason(input: {
  budgetExceeded: boolean;
  daily: DailyCallState;
}): CallBlock | null {
  // 예산을 먼저 본다. 돈이 없으면 누가 부르든 못 부른다.
  if (input.budgetExceeded) return 'budget';
  if (input.daily.kind === 'exceeded') return 'daily_limit';

  return null;
}

/**
 * 부르지 못했을 때 화면이 그대로 보여줄 말.
 *
 * **고장났다고 말하지 않는다.** 고장이 아니라 지금 부를 수 없는 것이고, 다시
 * 시도하라고 하면 같은 결과를 다시 받는다. 그리고 `AI`라는 말을 쓰지 않는다 —
 * 사용자에게 그건 우리 사정이지 그 사람의 사정이 아니다.
 */
export const CALL_BLOCKED_NOTICE =
  '지금은 문서를 읽어드릴 수 없어요. 문의 창구로 알려주시면 확인해드려요.';

/** 운영 도구가 읽는 말. 사용자 화면과 달리 무엇이 막았는지 그대로 적는다. */
export const CALL_BLOCK_LABEL: Record<CallBlock, string> = {
  budget: '월 예산 소진',
  daily_limit: '사용자 일일 호출 한도 초과',
};

/** 이 기능이 사람 단위 한도를 갖는가. 문서 분석과 자유 질의처럼 사람이 부르는 것만. */
export function hasPerUserLimit(feature: AiFeature): boolean {
  return feature !== 'payment_proof_vision';
}
