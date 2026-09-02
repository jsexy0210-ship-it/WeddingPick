import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 개인정보 재검토 HTTP API. `pii-admin.ts`의 규칙 자체는 `pii-review.test.ts`가
 * 이미 다 봤다 — 여기서는 관문만 본다.
 */
describeWithDb('개인정보 재검토 API', () => {
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

  async function aQuoteWithContractTerm() {
    const owner = await signInAs(test, `owner-${Math.random()}`);
    const vendor = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ('심사용 홀', 'hall', '서울', 'public_data') RETURNING id`
    );
    const wedding = await createWeddingFor(owner.userId);
    const quote = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.quotes
         (wedding_id, source, doc_type, vendor_id, product_key, total_amount)
       VALUES ($1, 'ai_extraction', 'contract', $2, 'k', 32800000) RETURNING id`,
      [wedding, vendor.rows[0]!.id]
    );
    await test.pool.query(
      `INSERT INTO structured.contract_terms (quote_id, category, body)
       VALUES ($1, 'refund', '연락처: 010-2345-6789')`,
      [quote.rows[0]!.id]
    );

    return quote.rows[0]!.id;
  }

  async function createWeddingFor(userId: string): Promise<string> {
    const wedding = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.weddings (owner_user_id) VALUES ($1) RETURNING id',
      [userId]
    );

    return wedding.rows[0]!.id;
  }

  it('운영자가 아니면 403이다', async () => {
    const session = await signInAs(test, `not-operator-${Math.random()}`);

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/pii-reviews',
      headers: session.headers,
    });

    expect(response.statusCode).toBe(403);
  });

  it('운영자는 대기 목록을 보고, 상세를 보고, 클린 확인할 수 있다', async () => {
    const operator = await anOperatorSession();
    const quoteId = await aQuoteWithContractTerm();

    const list = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/pii-reviews',
      headers: operator.headers,
    });

    expect(list.statusCode).toBe(200);
    const reviews = list.json<{ reviews: { id: string; hintCount: number }[] }>().reviews;
    const listed = reviews.find((r) => r.id === quoteId);
    expect(listed?.hintCount).toBeGreaterThan(0);

    const detail = await test.app.inject({
      method: 'GET',
      url: `/v1/admin/pii-reviews/${quoteId}`,
      headers: operator.headers,
    });

    expect(detail.statusCode).toBe(200);
    expect(detail.json<{ status: string }>().status).toBe('pending');

    const clean = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/pii-reviews/${quoteId}/clean`,
      headers: operator.headers,
    });

    expect(clean.statusCode).toBe(200);

    const after = await test.app.inject({
      method: 'GET',
      url: `/v1/admin/pii-reviews/${quoteId}`,
      headers: operator.headers,
    });

    expect(after.json<{ status: string }>().status).toBe('clean');
  });

  it('지운 값을 기록하면 검토가 끝난다', async () => {
    const operator = await anOperatorSession();
    const quoteId = await aQuoteWithContractTerm();

    const response = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/pii-reviews/${quoteId}/redact`,
      headers: operator.headers,
      payload: { field: 'contractTerms', kind: 'phone' },
    });

    expect(response.statusCode).toBe(200);

    const detail = await test.app.inject({
      method: 'GET',
      url: `/v1/admin/pii-reviews/${quoteId}`,
      headers: operator.headers,
    });

    expect(detail.json<{ status: string }>().status).toBe('redacted');
  });

  it('없는 문서는 404다', async () => {
    const operator = await anOperatorSession();

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/pii-reviews/00000000-0000-4000-8000-000000000000',
      headers: operator.headers,
    });

    expect(response.statusCode).toBe(404);
  });

  it('이미 검토를 마친 문서를 다시 클린 확인하면 400이다', async () => {
    const operator = await anOperatorSession();
    const quoteId = await aQuoteWithContractTerm();

    await test.app.inject({
      method: 'POST',
      url: `/v1/admin/pii-reviews/${quoteId}/clean`,
      headers: operator.headers,
    });

    const again = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/pii-reviews/${quoteId}/clean`,
      headers: operator.headers,
    });

    expect(again.statusCode).toBe(400);
  });
});
