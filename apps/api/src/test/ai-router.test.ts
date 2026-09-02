import type { Analyzer } from '../analysis/analyzer';
import type { Extraction } from '../analysis/schema';
import { runOnce } from '../analysis/worker';
import {
  createTestApp,
  createWedding,
  extractionFixture,
  resetDatabase,
  signInAs,
  type TestApp,
} from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 문서 분석 앞의 관문. 화면데이터구조 스펙 7.3.
 *
 * 여기서 지키는 것은 셋이다.
 *
 *   1. **부른 것은 센다.** 세지 않으면 예산은 장식이다 — `ai_budget_status`가 지출을
 *      0으로 보면 한도를 걸어도 걸리지 않는다.
 *   2. **실패한 호출도 센다.** 성공률을 내려면 실패를 세야 하고, 실패해도 돈은 나간다.
 *   3. **못 부른 것은 고장이 아니다.** `internal`로 적으면 화면이 다시 시도하라고
 *      말하는데, 다시 시도해도 같은 결과다.
 */
describeWithDb('문서 분석 관문', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  const extraction = (): Extraction => extractionFixture();

  function fakeAnalyzer(result: Extraction | Error): Analyzer {
    return {
      analyze: async () => {
        if (result instanceof Error) throw result;

        return { extraction: result, usage: { inputTokens: 1200, outputTokens: 340 } };
      },
    };
  }

  /** 업로드 → 완료까지 밟아 분석 대기열에 한 건을 만든다. */
  async function queueAnalysis() {
    const { headers, userId } = await signInAs(test, `user-${Math.random()}`);
    const weddingId = await createWedding(test, headers);

    const upload = await test.app.inject({
      method: 'POST',
      url: '/v1/documents/uploads',
      headers,
      payload: { weddingId, pages: [{ mimeType: 'image/jpeg', sizeBytes: 1000 }] },
    });

    const { rawDocumentId, uploads } = upload.json<{
      rawDocumentId: string;
      uploads: { uploadUrl: string; storageKey: string }[];
    }>();

    for (const target of uploads) {
      await test.app.inject({
        method: 'PUT',
        url: `/dev-storage/${encodeURIComponent(target.storageKey)}`,
        payload: Buffer.from('문서'),
        headers: { 'content-type': 'image/jpeg' },
      });
    }

    const done = await test.app.inject({
      method: 'POST',
      url: `/v1/documents/${rawDocumentId}/complete`,
      headers,
      payload: { weddingId },
    });

    return { userId, analysisId: done.json<{ analysisId: string }>().analysisId };
  }

  const usageRows = async () =>
    (
      await test.pool.query<{
        feature: string;
        model: string;
        user_id: string | null;
        succeeded: boolean;
        estimated_cost_usd: string | null;
      }>('SELECT feature, model, user_id, succeeded, estimated_cost_usd FROM structured.ai_usage')
    ).rows;

  const analysisState = async (analysisId: string) =>
    (
      await test.pool.query<{ status: string; failure_reason: string | null }>(
        'SELECT status, failure_reason FROM structured.analyses WHERE id = $1',
        [analysisId]
      )
    ).rows[0]!;

  const deps = (analyzer: Analyzer, dailyCallLimit?: number | null) => ({
    pool: test.pool,
    storage: test.context.storage,
    analyzer,
    model: 'test-analysis',
    dailyCallLimit,
  });

  it('문서를 읽으면 호출 한 건이 남는다', async () => {
    // 이 줄이 없어서 예산을 걸어도 문서 분석에는 걸리지 않았다.
    const { userId } = await queueAnalysis();

    await runOnce(deps(fakeAnalyzer(extraction())));

    const rows = await usageRows();

    expect(rows).toHaveLength(1);
    expect(rows[0]!.feature).toBe('document_extraction');
    expect(rows[0]!.model).toBe('test-analysis');
    expect(rows[0]!.user_id).toBe(userId);
    expect(rows[0]!.succeeded).toBe(true);
  });

  it('실패한 호출도 남는다', async () => {
    // 성공률을 내려면 실패를 세야 한다. 실패해도 돈은 나간다.
    const { analysisId } = await queueAnalysis();

    await expect(runOnce(deps(fakeAnalyzer(new Error('모델이 죽었다'))))).rejects.toThrow();

    const rows = await usageRows();

    expect(rows).toHaveLength(1);
    expect(rows[0]!.succeeded).toBe(false);
    expect((await analysisState(analysisId)).failure_reason).toBe('internal');
  });

  it('예산이 바닥나면 부르지 않고, 고장이라고 적지 않는다', async () => {
    const { analysisId } = await queueAnalysis();
    const operator = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users (is_operator) VALUES (true) RETURNING id'
    );

    // 이미 다 쓴 것으로 만든다. 예산 1달러에 지출 2달러.
    await test.pool.query(
      `INSERT INTO structured.ai_budgets (feature, month, budget_usd, set_by)
       VALUES ('document_extraction', date_trunc('month', now())::date, 1, $1)`,
      [operator.rows[0]!.id]
    );
    await test.pool.query(
      `INSERT INTO structured.ai_usage
         (feature, model, input_tokens, output_tokens, estimated_cost_usd, succeeded)
       VALUES ('document_extraction', 'claude-opus-5', 0, 0, 2, true)`
    );

    const before = (await usageRows()).length;

    await runOnce(deps(fakeAnalyzer(extraction())));

    // 부르지 않았으므로 새 줄이 없다.
    expect(await usageRows()).toHaveLength(before);
    expect(await analysisState(analysisId)).toEqual({
      status: 'failed',
      failure_reason: 'unavailable',
    });
  });

  it('하루 한도를 넘기면 부르지 않는다', async () => {
    const { userId, analysisId } = await queueAnalysis();

    await test.pool.query(
      `INSERT INTO structured.ai_usage
         (feature, user_id, model, input_tokens, output_tokens, succeeded)
       VALUES ('document_extraction', $1, 'test-analysis', 10, 10, true)`,
      [userId]
    );

    await runOnce(deps(fakeAnalyzer(extraction()), 1));

    expect(await usageRows()).toHaveLength(1);
    expect((await analysisState(analysisId)).failure_reason).toBe('unavailable');
  });

  it('한도를 정하지 않았으면 막지 않는다', async () => {
    /*
     * 정해지기 전에는 숫자를 지어내지 않는다. 지어낸 한도를 걸어두면 실제로 얼마나
     * 부르는지 재보기도 전에 막힌다.
     */
    const { userId, analysisId } = await queueAnalysis();

    for (let i = 0; i < 5; i += 1) {
      await test.pool.query(
        `INSERT INTO structured.ai_usage
           (feature, user_id, model, input_tokens, output_tokens, succeeded)
         VALUES ('document_extraction', $1, 'test-analysis', 10, 10, true)`,
        [userId]
      );
    }

    await runOnce(deps(fakeAnalyzer(extraction())));

    expect((await analysisState(analysisId)).status).toBe('succeeded');
  });

  it('어제 부른 것은 오늘 한도에 들어가지 않는다', async () => {
    const { userId, analysisId } = await queueAnalysis();

    await test.pool.query(
      `INSERT INTO structured.ai_usage
         (feature, user_id, model, input_tokens, output_tokens, succeeded, requested_at)
       VALUES ('document_extraction', $1, 'test-analysis', 10, 10, true, now() - interval '1 day')`,
      [userId]
    );

    await runOnce(deps(fakeAnalyzer(extraction()), 1));

    expect((await analysisState(analysisId)).status).toBe('succeeded');
  });

  it('탈퇴해도 비용 기록은 남고 사람만 지워진다', async () => {
    // 기록까지 사라지면 그 달의 합계가 조용히 줄고 예산이 넉넉해 보인다.
    const { userId } = await queueAnalysis();

    await runOnce(deps(fakeAnalyzer(extraction())));
    await test.pool.query('DELETE FROM structured.users WHERE id = $1', [userId]);

    const rows = await usageRows();

    expect(rows).toHaveLength(1);
    expect(rows[0]!.user_id).toBeNull();
  });
});
