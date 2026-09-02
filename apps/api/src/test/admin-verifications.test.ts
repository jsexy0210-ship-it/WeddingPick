import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 인증 심사 HTTP API. `verification-admin.ts`의 규칙 자체는
 * `verification-review.test.ts`가 이미 다 봤다 — 여기서는 관문만 본다.
 */
describeWithDb('인증 심사 API', () => {
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

  async function aPendingRequest(requesterId: string) {
    const wedding = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.weddings (owner_user_id) VALUES ($1) RETURNING id',
      [requesterId]
    );
    const quote = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.quotes (wedding_id, source, total_amount)
       VALUES ($1, 'user_quote', 32800000) RETURNING id`,
      [wedding.rows[0]!.id]
    );
    const request = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.verification_requests (quote_id, requested_by, target_level)
       VALUES ($1, $2, 'L2'::verification_level) RETURNING id`,
      [quote.rows[0]!.id, requesterId]
    );
    const document = await test.pool.query<{ id: string }>(
      'INSERT INTO originals.raw_documents (owner_user_id, page_count) VALUES ($1, 1) RETURNING id',
      [requesterId]
    );
    await test.pool.query(
      `INSERT INTO structured.verification_evidence (request_id, kind, raw_document_id)
       VALUES ($1, 'contract_document'::verification_evidence_kind, $2)`,
      [request.rows[0]!.id, document.rows[0]!.id]
    );

    return request.rows[0]!.id;
  }

  it('운영자가 아니면 403이다', async () => {
    const session = await signInAs(test, `not-operator-${Math.random()}`);

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/verifications',
      headers: session.headers,
    });

    expect(response.statusCode).toBe(403);
  });

  it('운영자는 대기 목록을 보고, 심사를 시작하고, 승인할 수 있다', async () => {
    const operator = await anOperatorSession();
    const applicant = await signInAs(test, `applicant-${Math.random()}`);
    const requestId = await aPendingRequest(applicant.userId);

    const list = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/verifications',
      headers: operator.headers,
    });

    expect(list.statusCode).toBe(200);
    expect(list.json<{ pending: { id: string }[] }>().pending.map((r) => r.id)).toContain(
      requestId
    );

    const review = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/verifications/${requestId}/review`,
      headers: operator.headers,
    });

    expect(review.statusCode).toBe(200);

    const approve = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/verifications/${requestId}/approve`,
      headers: operator.headers,
      payload: { note: '계약서 3면 도장 확인' },
    });

    expect(approve.statusCode).toBe(200);

    const detail = await test.app.inject({
      method: 'GET',
      url: `/v1/admin/verifications/${requestId}`,
      headers: operator.headers,
    });

    expect(detail.json<{ status: string }>().status).toBe('approved');
  });

  it('신청한 본인은 심사할 수 없다 — 도메인 규칙 위반은 400이다', async () => {
    const operator = await anOperatorSession();
    await test.pool.query('UPDATE structured.users SET is_operator = true WHERE id = $1', [
      operator.userId,
    ]);
    const requestId = await aPendingRequest(operator.userId);

    const response = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/verifications/${requestId}/reject`,
      headers: operator.headers,
      payload: { reason: '본인 심사 금지 확인' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { message: string } }>().error.message).toContain(
      '신청한 본인'
    );
  });

  it('밀린 신청 목록은 빈 배열도 정상 응답한다', async () => {
    const operator = await anOperatorSession();

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/verifications/backlog',
      headers: operator.headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ backlog: unknown[] }>().backlog).toEqual([]);
  });
});
