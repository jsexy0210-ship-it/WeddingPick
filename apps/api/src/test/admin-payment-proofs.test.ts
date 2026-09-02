import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 결제인증-업체 잇기 HTTP API. `payment-proof-admin.ts`의 규칙 자체는
 * `payment-proof-admin.test.ts`가 이미 다 봤다 — 여기서는 관문만 본다.
 */
describeWithDb('결제인증 잇기 API', () => {
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

  async function aVendor(name = '가온예식홀'): Promise<string> {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ($1, 'hall', '서울', 'public_data') RETURNING id`,
      [name]
    );

    return rows[0]!.id;
  }

  async function anUnmatchedProof(merchantName = '가온예식홀'): Promise<string> {
    const reporter = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
    );

    const proof = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.payment_proofs
         (reporter_user_id, vendor_id, merchant_name, paid_amount, paid_at)
       VALUES ($1, NULL, $2, 3000000, now())
       RETURNING id`,
      [reporter.rows[0]!.id, merchantName]
    );

    return proof.rows[0]!.id;
  }

  it('운영자가 아니면 403이다', async () => {
    const session = await signInAs(test, `not-operator-${Math.random()}`);

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/payment-proofs/unlinked',
      headers: session.headers,
    });

    expect(response.statusCode).toBe(403);
  });

  it('운영자는 미연결 목록을 보고, 후보를 보고, 이을 수 있다', async () => {
    const operator = await anOperatorSession();
    const vendorId = await aVendor();
    const proofId = await anUnmatchedProof();

    const unlinked = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/payment-proofs/unlinked',
      headers: operator.headers,
    });

    expect(unlinked.statusCode).toBe(200);
    const list = unlinked.json<{ unlinked: { id: string; candidateCount: number }[] }>().unlinked;
    expect(list.find((p) => p.id === proofId)?.candidateCount).toBe(1);

    const detail = await test.app.inject({
      method: 'GET',
      url: `/v1/admin/payment-proofs/${proofId}`,
      headers: operator.headers,
    });

    expect(detail.statusCode).toBe(200);
    expect(detail.json<{ candidates: { id: string }[] }>().candidates.map((c) => c.id)).toContain(
      vendorId
    );

    const link = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/payment-proofs/${proofId}/link`,
      headers: operator.headers,
      payload: { vendorId },
    });

    expect(link.statusCode).toBe(200);

    const after = await test.app.inject({
      method: 'GET',
      url: `/v1/admin/payment-proofs/${proofId}`,
      headers: operator.headers,
    });

    expect(after.json<{ vendorId: string | null }>().vendorId).toBe(vendorId);
  });

  it('없는 결제인증은 404다', async () => {
    const operator = await anOperatorSession();

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/payment-proofs/00000000-0000-4000-8000-000000000000',
      headers: operator.headers,
    });

    expect(response.statusCode).toBe(404);
  });

  it('없는 업체와는 이을 수 없다 — 도메인 규칙 위반은 400이다', async () => {
    const operator = await anOperatorSession();
    const proofId = await anUnmatchedProof();

    const response = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/payment-proofs/${proofId}/link`,
      headers: operator.headers,
      payload: { vendorId: '00000000-0000-4000-8000-000000000000' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { message: string } }>().error.message).toContain('없는 업체다');
  });
});
