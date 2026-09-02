import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 업체 관계자 인증 심사 HTTP API. `vendor-claim-admin.ts`의 규칙 자체는
 * `vendor-claims.test.ts`가 이미 다 봤다 — 여기서는 관문(`/v1/admin/vendor-claims`)만 본다.
 */
describeWithDb('업체 관계자 인증 심사 API', () => {
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

  async function aPendingClaim() {
    const applicant = await signInAs(test, `claimant-${Math.random()}`);

    const vendor = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ('심사용 업체', 'hall', '서울', 'public_data') RETURNING id`
    );
    const vendorId = vendor.rows[0]!.id;

    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendor_claims
         (vendor_id, claimant_user_id, claimed_role, method, contact_email, listed_at)
       VALUES ($1, $2, '대표', 'listed_email', 'owner@example.com', '홈페이지 하단')
       RETURNING id`,
      [vendorId, applicant.userId]
    );

    return { claimId: rows[0]!.id, vendorId, applicantUserId: applicant.userId };
  }

  it('운영자가 아니면 403이다', async () => {
    const session = await signInAs(test, `not-operator-${Math.random()}`);

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/vendor-claims',
      headers: session.headers,
    });

    expect(response.statusCode).toBe(403);
  });

  it('운영자는 대기 목록을 보고, 상세를 보고, 승인할 수 있다', async () => {
    const operator = await anOperatorSession();
    const { claimId } = await aPendingClaim();

    const list = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/vendor-claims',
      headers: operator.headers,
    });

    expect(list.statusCode).toBe(200);
    const claims = list.json<{ claims: { id: string }[] }>().claims;
    expect(claims.map((c) => c.id)).toContain(claimId);

    const detail = await test.app.inject({
      method: 'GET',
      url: `/v1/admin/vendor-claims/${claimId}`,
      headers: operator.headers,
    });

    expect(detail.statusCode).toBe(200);
    expect(detail.json<{ status: string }>().status).toBe('pending');

    const approve = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/vendor-claims/${claimId}/approve`,
      headers: operator.headers,
      payload: { note: '공식 도메인 주소로 회신 확인' },
    });

    expect(approve.statusCode).toBe(200);

    const after = await test.app.inject({
      method: 'GET',
      url: `/v1/admin/vendor-claims/${claimId}`,
      headers: operator.headers,
    });

    expect(after.json<{ status: string }>().status).toBe('approved');
  });

  it('없는 신청 id는 404다', async () => {
    const operator = await anOperatorSession();

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/vendor-claims/00000000-0000-4000-8000-000000000000',
      headers: operator.headers,
    });

    expect(response.statusCode).toBe(404);
  });

  it('이미 결정된 신청을 다시 결정하면 400이다 — 도메인 규칙 위반', async () => {
    const operator = await anOperatorSession();
    const { claimId } = await aPendingClaim();

    await test.app.inject({
      method: 'POST',
      url: `/v1/admin/vendor-claims/${claimId}/approve`,
      headers: operator.headers,
      payload: { note: '확인 완료' },
    });

    const again = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/vendor-claims/${claimId}/reject`,
      headers: operator.headers,
      payload: { note: '다시' },
    });

    expect(again.statusCode).toBe(400);
    expect(again.json<{ error: { message: string } }>().error.message).toContain('이미');
  });
});
