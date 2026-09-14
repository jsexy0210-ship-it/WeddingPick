import { readPaymentProof } from '../analysis/proof-pipeline';
import type { PaymentProofReader, ProofReading } from '../analysis/payment-reader';
import { createTestApp, resetDatabase, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

const MODELS = { cheap: 'claude-haiku-4-5', strong: 'claude-opus-5' };

const IMAGES = [{ mimeType: 'image/jpeg', bytes: Buffer.from('사진인 셈 치자') }];

const GOOD: ProofReading = {
  merchantName: '가온예식홀',
  paidAmount: 3_000_000,
  paidAt: '2026-05-20T14:23:00.000Z',
  method: 'card',
  maskedIdentifiers: ['card_number'],
  rejection: null,
  confidence: 0.9,
};

/** 부른 모델을 기록하는 가짜. 실제 호출은 돈이 들고 결과가 매번 다르다. */
function fakeReader(byModel: Record<string, Partial<ProofReading>>): PaymentProofReader & {
  calls: string[];
} {
  const calls: string[] = [];

  return {
    calls,
    async read(_images, model) {
      calls.push(model);

      return {
        reading: { ...GOOD, ...byModel[model] },
        model,
        usage: { inputTokens: 1000, outputTokens: 100, cachedInputTokens: 0 },
      };
    },
  };
}

/**
 * 스펙 7.3의 처리 순서가 코드에서 지켜지는가.
 *
 *   규칙 파서 → (못 읽었으면) 저비용 모델 → (확신 낮으면) 상위 모델
 *
 * 각 단계가 앞 단계 실패에만 도는지를 여기서 지킨다. 순서가 무너지면 비용이
 * 조용히 늘어나고, 늘어난 뒤에야 청구서로 알게 된다.
 */
describeWithDb('결제내역 읽기 순서', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  const SMS = ['[Web발신]', '신한카드 승인', '3,000,000원 일시불', '2026-05-20 14:23', '가온예식홀'].join(
    '\n'
  );

  it('규칙으로 읽히면 모델을 부르지 않는다', async () => {
    const reader = fakeReader({});

    const result = await readPaymentProof({
      pool: test.pool,
      reader,
      models: MODELS,
      text: SMS,
      images: IMAGES,
    });

    expect(result.route).toBe('rules');
    // 이미지를 함께 줬어도 부르지 않는다. 규칙으로 끝났으면 끝난 것이다.
    expect(reader.calls).toEqual([]);
    expect(result.reading.merchantName).toBe('가온예식홀');

    const usage = await test.pool.query('SELECT 1 FROM structured.ai_usage');
    expect(usage.rows).toHaveLength(0);
  });

  it('취소 문자는 모델로 넘기지 않는다', async () => {
    const reader = fakeReader({});

    const result = await readPaymentProof({
      pool: test.pool,
      reader,
      models: MODELS,
      text: '신한카드 승인취소 3,000,000원 2026-05-22 가온예식홀',
      images: IMAGES,
    });

    // 읽을 것이 없어서가 아니라 읽으면 안 돼서다.
    expect(reader.calls).toEqual([]);
    expect(result.reading.rejection).toContain('취소');
  });

  it('규칙이 못 읽으면 저비용 모델을 먼저 부른다', async () => {
    const reader = fakeReader({});

    const result = await readPaymentProof({
      pool: test.pool,
      reader,
      models: MODELS,
      images: IMAGES,
    });

    expect(reader.calls).toEqual([MODELS.cheap]);
    expect(result.route).toBe('cheap_model');
  });

  it('확신이 낮으면 상위 모델로 한 번 더 부른다', async () => {
    const reader = fakeReader({
      [MODELS.cheap]: { confidence: 0.4 },
      [MODELS.strong]: { confidence: 0.95, merchantName: '가온예식홀 강남점' },
    });

    const result = await readPaymentProof({
      pool: test.pool,
      reader,
      models: MODELS,
      images: IMAGES,
    });

    expect(reader.calls).toEqual([MODELS.cheap, MODELS.strong]);
    expect(result.route).toBe('strong_model');
    expect(result.reading.merchantName).toBe('가온예식홀 강남점');
  });

  it('저비용 모델이 취소라고 보면 상위 모델에 다시 묻지 않는다', async () => {
    /*
     * 안 된다는 답을 살 때까지 묻는 것과 같다. 취소는 확신이 낮아도 취소다.
     */
    const reader = fakeReader({
      [MODELS.cheap]: { confidence: 0.3, rejection: '취소 안내로 보입니다.' },
    });

    const result = await readPaymentProof({
      pool: test.pool,
      reader,
      models: MODELS,
      images: IMAGES,
    });

    expect(reader.calls).toEqual([MODELS.cheap]);
    expect(result.reading.rejection).toBeTruthy();
  });
});

describeWithDb('AI 사용량 기록', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('호출마다 한 줄씩 남는다', async () => {
    const reader = fakeReader({ [MODELS.cheap]: { confidence: 0.4 } });

    await readPaymentProof({ pool: test.pool, reader, models: MODELS, images: IMAGES });

    const { rows } = await test.pool.query<{
      model: string;
      escalated_from: string | null;
      estimated_cost_usd: string | null;
      user_corrected: boolean | null;
    }>('SELECT model, escalated_from, estimated_cost_usd, user_corrected FROM structured.ai_usage ORDER BY requested_at');

    // 합계만 두면 성공률도 escalation률도 되돌릴 수 없다.
    expect(rows).toHaveLength(2);
    expect(rows[0]!.escalated_from).toBeNull();
    expect(rows[1]!.escalated_from).toBe(MODELS.cheap);
    // 아직 모름이다. false로 시작하면 등록 없이 떠난 사람이 "그대로 썼다"가 된다.
    expect(rows[0]!.user_corrected).toBeNull();
  });

  it('단가를 아는 모델은 비용이 계산된다', async () => {
    const reader = fakeReader({});

    await readPaymentProof({ pool: test.pool, reader, models: MODELS, images: IMAGES });

    const { rows } = await test.pool.query<{ estimated_cost_usd: string }>(
      'SELECT estimated_cost_usd FROM structured.ai_usage'
    );

    // haiku 4.5: 입력 1,000토큰 × $1/1M + 출력 100토큰 × $5/1M
    expect(Number(rows[0]!.estimated_cost_usd)).toBeCloseTo(0.0015, 6);
  });

  it('단가를 모르는 모델은 0이 아니라 빈칸이다', async () => {
    /*
     * 0으로 두면 "공짜였다"로 읽히고 합계에 조용히 섞인다. 그러면 예산이 실제보다
     * 넉넉해 보이고, 넘긴 뒤에야 알게 된다.
     */
    const reader = fakeReader({});

    await readPaymentProof({
      pool: test.pool,
      reader,
      models: { cheap: '아직-단가를-모르는-모델', strong: MODELS.strong },
      images: IMAGES,
    });

    const { rows } = await test.pool.query<{
      estimated_cost_usd: string | null;
      uncosted: string;
    }>(
      `SELECT u.estimated_cost_usd,
              (SELECT uncosted_count FROM structured.ai_budget_status
               WHERE feature = 'payment_proof_vision') AS uncosted
       FROM structured.ai_usage u`
    );

    expect(rows[0]!.estimated_cost_usd).toBeNull();
    // 빠졌다는 것이 보인다.
    expect(Number(rows[0]!.uncosted)).toBe(1);
  });

  it('실패한 호출도 남는다', async () => {
    const failing: PaymentProofReader = {
      async read() {
        throw new Error('모델이 답하지 않았다');
      },
    };

    await expect(
      readPaymentProof({ pool: test.pool, reader: failing, models: MODELS, images: IMAGES })
    ).rejects.toThrow();

    const { rows } = await test.pool.query<{ succeeded: boolean }>(
      'SELECT succeeded FROM structured.ai_usage'
    );

    // 성공률을 내려면 실패도 세야 한다.
    expect(rows).toHaveLength(1);
    expect(rows[0]!.succeeded).toBe(false);
  });

  it('지표를 기능별로 낸다', async () => {
    const reader = fakeReader({ [MODELS.cheap]: { confidence: 0.4 } });

    await readPaymentProof({ pool: test.pool, reader, models: MODELS, images: IMAGES });

    const { rows } = await test.pool.query<{
      request_count: string;
      escalation_rate: string;
      user_correction_rate: string | null;
      correction_unknown_count: string;
    }>(
      `SELECT sum(request_count) AS request_count,
              avg(escalation_rate) AS escalation_rate,
              avg(user_correction_rate) AS user_correction_rate,
              sum(correction_unknown_count) AS correction_unknown_count
       FROM structured.ai_usage_monthly
       WHERE feature = 'payment_proof_vision'`
    );

    expect(Number(rows[0]!.request_count)).toBe(2);
    // 아직 아무도 확인하지 않았으므로 수정률은 없다 — 0이 아니다.
    expect(rows[0]!.user_correction_rate).toBeNull();
    expect(Number(rows[0]!.correction_unknown_count)).toBe(2);
  });
});

describeWithDb('예산', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('예산이 없으면 한도가 없다', async () => {
    const { rows } = await test.pool.query<{ state: string }>(
      `SELECT state FROM structured.ai_budget_status WHERE feature = 'payment_proof_vision'`
    );

    // 지어낸 한도를 걸어두면 재보기도 전에 막힌다.
    expect(rows[0]!.state).toBe('unlimited');
  });

  it('예산을 넘기면 모델을 부르지 않는다', async () => {
    await test.pool.query(
      `INSERT INTO structured.ai_budgets (feature, month, budget_usd)
       VALUES ('payment_proof_vision', date_trunc('month', now())::date, 0.01)`
    );

    await test.pool.query(
      `INSERT INTO structured.ai_usage
         (feature, model, input_tokens, output_tokens, estimated_cost_usd, succeeded)
       VALUES ('payment_proof_vision', 'claude-haiku-4-5', 1000, 100, 0.02, true)`
    );

    const reader = fakeReader({});

    const result = await readPaymentProof({
      pool: test.pool,
      reader,
      models: MODELS,
      text: '신한카드 승인 3,000,000원',
      images: IMAGES,
    });

    expect(reader.calls).toEqual([]);
    expect(result.route).toBe('rules_only_budget');
  });

  it('예산이 바닥나도 등록은 막지 않는다', async () => {
    /*
     * 스펙 7.3의 마지막 줄 — "AI가 죽어도 핵심 서비스는 정상 동작해야 함".
     * 예산 소진은 AI가 죽은 것과 같은 상태다.
     */
    await test.pool.query(
      `INSERT INTO structured.ai_budgets (feature, month, budget_usd)
       VALUES ('payment_proof_vision', date_trunc('month', now())::date, 0.01)`
    );
    await test.pool.query(
      `INSERT INTO structured.ai_usage
         (feature, model, input_tokens, output_tokens, estimated_cost_usd, succeeded)
       VALUES ('payment_proof_vision', 'claude-haiku-4-5', 1000, 100, 0.02, true)`
    );

    // 가맹점이 없어 규칙만으로는 못 끝낸다 — 그래야 예산 갈래까지 간다.
    const result = await readPaymentProof({
      pool: test.pool,
      reader: fakeReader({}),
      models: MODELS,
      text: '신한카드 승인 3,000,000원 2026-05-20',
      images: IMAGES,
    });

    // 규칙이 읽은 것은 버리지 않고 그대로 온다. 그리고 무엇이 되는지 알려준다.
    expect(result.reading.paidAmount).toBe(3_000_000);
    expect(result.reading.paidAt?.slice(0, 10)).toBe('2026-05-20');
    /*
     * 예전 안내는 «직접 적어주시면 그대로 올라가요»였다. v3.24가 수동 입력과
     * 문자 붙여넣기를 폐기한 뒤로는 없는 길을 가리키는 말이라, 접수는 됐다는
     * 사실로 바꿨다.
     */
    expect(result.notice).toContain('접수됐고');
    expect(result.notice).not.toContain('직접 적어주시면');
    // 화면에 나가는 말에 AI가 없다.
    expect(result.notice).not.toContain('AI');
  });
});
