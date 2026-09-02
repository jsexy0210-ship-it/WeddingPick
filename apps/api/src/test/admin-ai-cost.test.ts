import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * AI 사용량·예산 HTTP API. `ai-cost-admin.ts`는 이전엔 `require.main ===
 * module` 관문이 없어 가져오기만 해도 CLI가 실행됐다 — 이번에 라우트로 열면서
 * 그 관문과 `setBudget`/`clearBudget`의 `requireOperator` 확인(원래 아예
 * 없었다)을 같이 넣었다.
 */
describeWithDb('AI 사용량·예산 API', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function anOperatorSession() {
    const session = await signInAs(test, `operator-${Math.random()}`);
    await test.pool.query('UPDATE structured.users SET is_operator = true WHERE id = $1', [
      session.userId,
    ]);

    return session;
  }

  async function anAiUsageRow() {
    await test.pool.query(
      `INSERT INTO structured.ai_usage
         (feature, model, input_tokens, output_tokens, estimated_cost_usd, succeeded)
       VALUES ('document_extraction', 'claude-haiku-4-5', 1000, 200, 0.01, true)`
    );
  }

  it('운영자가 아니면 403이다', async () => {
    const session = await signInAs(test, `not-operator-${Math.random()}`);

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/ai-cost/status',
      headers: session.headers,
    });

    expect(response.statusCode).toBe(403);
  });

  it('운영자는 이번 달 상태·사용량을 보고, 한도를 정하고 없앨 수 있다', async () => {
    const operator = await anOperatorSession();
    await anAiUsageRow();

    const status = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/ai-cost/status',
      headers: operator.headers,
    });

    expect(status.statusCode).toBe(200);
    const statusBody = status.json<{
      status: { feature: string; spentUsd: string; state: string }[];
    }>().status;
    const documentExtraction = statusBody.find((s) => s.feature === 'document_extraction');
    expect(documentExtraction?.state).toBe('unlimited');

    const usage = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/ai-cost/usage',
      headers: operator.headers,
    });

    expect(usage.statusCode).toBe(200);
    expect(usage.json<{ usage: { requestCount: number }[] }>().usage[0]?.requestCount).toBe(1);

    const setBudget = await test.app.inject({
      method: 'POST',
      url: '/v1/admin/ai-cost/budget',
      headers: operator.headers,
      payload: { feature: 'document_extraction', amountUsd: 10 },
    });

    expect(setBudget.statusCode).toBe(200);

    const afterSet = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/ai-cost/status',
      headers: operator.headers,
    });

    const afterSetBody = afterSet
      .json<{ status: { feature: string; budgetUsd: string | null }[] }>()
      .status.find((s) => s.feature === 'document_extraction');
    expect(afterSetBody?.budgetUsd).toBe('10.00');

    const clearBudget = await test.app.inject({
      method: 'DELETE',
      url: '/v1/admin/ai-cost/budget/document_extraction',
      headers: operator.headers,
    });

    expect(clearBudget.statusCode).toBe(200);

    const afterClear = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/ai-cost/status',
      headers: operator.headers,
    });

    const afterClearBody = afterClear
      .json<{ status: { feature: string; budgetUsd: string | null }[] }>()
      .status.find((s) => s.feature === 'document_extraction');
    expect(afterClearBody?.budgetUsd).toBeNull();
  });

  it('알 수 없는 기능으로 한도를 정하면 400이다', async () => {
    const operator = await anOperatorSession();

    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/admin/ai-cost/budget',
      headers: operator.headers,
      payload: { feature: 'not_a_real_feature', amountUsd: 10 },
    });

    expect(response.statusCode).toBe(400);
  });
});
