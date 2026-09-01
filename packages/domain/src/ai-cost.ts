/**
 * AI 호출의 비용과 예산.
 *
 * 화면데이터구조 스펙 7.3이 요구한 것 — 기능별 호출 수·토큰·추정 비용·성공률·
 * escalation률·사용자 수정률을 기록하고, 기능별 월 예산을 걸 수 있어야 한다.
 *
 * **재는 것과 정하는 것을 나눈다.** 단가는 우리가 정하는 값이 아니라 받아 적는
 * 값이고(아래), 예산은 우리가 정하는 값이다. 둘을 한 표에 두면 단가가 바뀔 때
 * 예산까지 흔들린다.
 */

/** AI를 부르는 자리. 스펙 7.2가 P1은 셋으로 제한했다. */
export const AI_FEATURES = [
  'document_extraction',
  'payment_proof_vision',
  'visit_note',
  'free_query',
] as const;

export type AiFeature = (typeof AI_FEATURES)[number];

/**
 * 비용을 어느 기능이 썼는지. **관리자·운영 화면에서만 쓴다.**
 *
 * 사용자 앱은 이 표를 보지 않는다. 그래서 v3.13 §O-1이 사용자 UI에서 막은 말이
 * 여기 남아 있어도 된다 — 운영자가 보는 자리에서는 무엇의 비용인지가 정확해야
 * 하고, `Pick 인증 읽기`라고 적으면 어느 파이프라인인지 짚기 어려워진다.
 */
export const AI_FEATURE_LABEL: Record<AiFeature, string> = {
  document_extraction: '문서 분석',
  payment_proof_vision: '결제내역 읽기',
  visit_note: '방문노트 정리',
  free_query: '자유 질의',
};

/**
 * 백만 토큰당 단가(USD).
 *
 * **우리가 정한 값이 아니다.** Anthropic이 공개한 값을 받아 적은 것이고, 언제
 * 받아 적었는지를 함께 남긴다 — 값이 바뀌면 여기가 낡는다. 낡은 것을 모른 채
 * 쓰는 것보다 언제 적은 값인지 보이는 편이 낫다.
 *
 * 기준일: 2026-06-24.
 */
export const MODEL_PRICES_USD_PER_MILLION: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

export const MODEL_PRICES_AS_OF = '2026-06-24';

/**
 * 이 호출이 얼마였는지. 모르는 모델이면 null이다 — 0으로 두지 않는다.
 *
 * 0은 "공짜였다"로 읽히고, 합계에 조용히 섞여 예산을 실제보다 넉넉해 보이게 만든다.
 * 모르면 모른다고 두고, 합계에서 빠졌다는 것이 보이게 한다.
 */
export function estimateCostUsd(input: {
  model: string;
  inputTokens: number;
  outputTokens: number;
}): number | null {
  const price = MODEL_PRICES_USD_PER_MILLION[input.model];

  if (!price) return null;

  const cost =
    (input.inputTokens / 1_000_000) * price.input +
    (input.outputTokens / 1_000_000) * price.output;

  // 소수점 여섯 자리. 한 번 호출이 0.000001달러 아래면 반올림해도 합계가 흔들리지 않는다.
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * 기능별 월 예산(USD). **아직 정해지지 않았다.**
 *
 * 문의 응답 기한(INQUIRY_RESPONSE_BUSINESS_DAYS)과 같은 규칙이다 — 정해지기 전에는
 * 숫자를 지어내지 않는다. null이면 한도가 없는 것이고, 그 사실이 화면과 운영 도구에
 * 그대로 보인다.
 *
 * 지어낸 한도를 걸어두면 더 나쁘다: 실제로 얼마가 드는지 재보기도 전에 호출이
 * 막히고, 왜 막혔는지는 아무도 모른다.
 */
export const MONTHLY_BUDGET_USD: Record<AiFeature, number | null> = {
  document_extraction: null,
  payment_proof_vision: null,
  visit_note: null,
  free_query: null,
};

export type BudgetState =
  | { kind: 'unlimited' }
  | { kind: 'within'; spentUsd: number; budgetUsd: number; remainingUsd: number }
  | { kind: 'exceeded'; spentUsd: number; budgetUsd: number };

export function budgetState(input: {
  feature: AiFeature;
  spentUsd: number;
  budgetUsd?: number | null;
}): BudgetState {
  const budget = input.budgetUsd ?? MONTHLY_BUDGET_USD[input.feature];

  if (budget === null || budget === undefined) {
    return { kind: 'unlimited' };
  }

  return input.spentUsd >= budget
    ? { kind: 'exceeded', spentUsd: input.spentUsd, budgetUsd: budget }
    : {
        kind: 'within',
        spentUsd: input.spentUsd,
        budgetUsd: budget,
        remainingUsd: Math.round((budget - input.spentUsd) * 1_000_000) / 1_000_000,
      };
}

/**
 * 예산을 넘었을 때 무엇을 할 것인가. 스펙 7.3이 순서를 정해뒀다.
 *
 *   상위 AI 호출 제한 → 사용자 선택형 확인 → 직접입력
 *
 * **서비스가 멈추지는 않는다.** 스펙 7.3의 마지막 줄이 "AI가 죽어도 핵심 서비스는
 * 정상 동작해야 함"이다. 예산이 바닥나면 읽어주는 것을 멈출 뿐, 등록은 그대로 된다.
 */
export type BudgetFallback = 'escalate' | 'cheapest_only' | 'ask_user';

export function fallbackFor(state: BudgetState): BudgetFallback {
  return state.kind === 'exceeded' ? 'ask_user' : 'escalate';
}

/** 예산이 바닥났을 때 화면이 그대로 보여줄 말. AI를 입에 올리지 않는다. */
export const BUDGET_EXHAUSTED_NOTICE =
  '지금은 사진에서 자동으로 읽어드리지 못해요. 안내 문자를 붙여넣거나 직접 적어주시면 그대로 올라가요.';
