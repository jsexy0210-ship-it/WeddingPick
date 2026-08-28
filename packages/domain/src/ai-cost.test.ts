import {
  AI_FEATURES,
  BUDGET_EXHAUSTED_NOTICE,
  MODEL_PRICES_AS_OF,
  MONTHLY_BUDGET_USD,
  budgetState,
  estimateCostUsd,
  fallbackFor,
} from './ai-cost';

describe('비용 추정', () => {
  it('토큰과 단가로 센다', () => {
    // haiku 4.5: 입력 $1/1M, 출력 $5/1M
    expect(
      estimateCostUsd({ model: 'claude-haiku-4-5', inputTokens: 1_000_000, outputTokens: 0 })
    ).toBe(1);
    expect(
      estimateCostUsd({ model: 'claude-haiku-4-5', inputTokens: 0, outputTokens: 1_000_000 })
    ).toBe(5);
  });

  it('모르는 모델은 0이 아니라 null이다', () => {
    /*
     * 0으로 두면 "공짜였다"로 읽히고 합계에 조용히 섞인다. 그러면 예산이 실제보다
     * 넉넉해 보이고, 넘긴 뒤에야 알게 된다.
     */
    expect(estimateCostUsd({ model: '없는모델', inputTokens: 1000, outputTokens: 100 })).toBeNull();
  });

  it('언제 적은 단가인지 남긴다', () => {
    // 우리가 정한 값이 아니라 받아 적은 값이다. 낡으면 낡은 줄 알아야 한다.
    expect(MODEL_PRICES_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('예산', () => {
  it('아직 정해지지 않았다', () => {
    /*
     * 문의 응답 기한과 같은 규칙 — 정해지기 전에는 숫자를 지어내지 않는다.
     * 지어낸 한도를 걸어두면 실제로 얼마가 드는지 재보기도 전에 호출이 막힌다.
     */
    for (const feature of AI_FEATURES) {
      expect(MONTHLY_BUDGET_USD[feature]).toBeNull();
    }
  });

  it('한도가 없으면 없다고 말한다', () => {
    expect(budgetState({ feature: 'payment_proof_vision', spentUsd: 999 })).toEqual({
      kind: 'unlimited',
    });
  });

  it('한도 안이면 남은 금액을 준다', () => {
    const state = budgetState({
      feature: 'payment_proof_vision',
      spentUsd: 3,
      budgetUsd: 10,
    });

    expect(state).toEqual({ kind: 'within', spentUsd: 3, budgetUsd: 10, remainingUsd: 7 });
  });

  it('같아지면 넘긴 것으로 본다', () => {
    // 딱 맞춘 뒤 한 번 더 부르면 넘는다. 경계에서 한 번 더 부르지 않는다.
    expect(
      budgetState({ feature: 'payment_proof_vision', spentUsd: 10, budgetUsd: 10 }).kind
    ).toBe('exceeded');
  });

  it('넘기면 사용자에게 묻는 쪽으로 간다', () => {
    // 스펙 7.3: 상위 AI 호출 제한 → 사용자 선택형 확인 → 직접입력
    expect(fallbackFor({ kind: 'exceeded', spentUsd: 11, budgetUsd: 10 })).toBe('ask_user');
    expect(fallbackFor({ kind: 'unlimited' })).toBe('escalate');
  });

  it('바닥나도 서비스가 멈춘다고 말하지 않는다', () => {
    // 스펙 7.3 마지막 줄 — AI가 죽어도 핵심 서비스는 정상 동작해야 한다.
    expect(BUDGET_EXHAUSTED_NOTICE).toContain('직접 적어주시면');
    // 그리고 화면 문구에 AI가 없다.
    expect(BUDGET_EXHAUSTED_NOTICE).not.toContain('AI');
  });
});
