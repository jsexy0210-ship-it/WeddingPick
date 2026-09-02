import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 회원탈퇴 운영자 개입 HTTP API. `withdrawal-admin.ts`의 조회·보류·해제·재시도를
 * 그대로 여닫는 관문(`/v1/admin/withdrawals`)만 본다 — 규칙 자체는
 * `withdrawal-admin.test.ts`가 이미 다 봤다.
 */
describeWithDb('회원탈퇴 운영자 개입 API', () => {
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

  async function aWithdrawnUser(): Promise<string> {
    const { rows } = await test.pool.query<{ id: string }>(
      "INSERT INTO structured.users (deleted_at) VALUES (now()) RETURNING id"
    );

    return rows[0]!.id;
  }

  it('운영자가 아니면 403이다', async () => {
    const session = await signInAs(test, `not-operator-${Math.random()}`);

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/withdrawals',
      headers: session.headers,
    });

    expect(response.statusCode).toBe(403);
  });

  it('로그인하지 않으면 401이다', async () => {
    const response = await test.app.inject({ method: 'GET', url: '/v1/admin/withdrawals' });

    expect(response.statusCode).toBe(401);
  });

  it('운영자는 탈퇴 대기 계정을 조회·보류·해제·재시도할 수 있다', async () => {
    const operator = await anOperatorSession();
    const userId = await aWithdrawnUser();

    const list = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/withdrawals',
      headers: operator.headers,
    });

    expect(list.statusCode).toBe(200);
    const listed = list.json<{ accounts: { userId: string; status: string }[] }>().accounts;
    expect(listed.find((a) => a.userId === userId)?.status).toBe('deletion_pending');

    const until = new Date(Date.now() + 60_000).toISOString();
    const hold = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/withdrawals/${userId}/hold`,
      headers: operator.headers,
      payload: { reason: '사고 의심', until },
    });

    expect(hold.statusCode).toBe(200);

    const resume = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/withdrawals/${userId}/resume`,
      headers: operator.headers,
      payload: { reason: '확인 완료' },
    });

    expect(resume.statusCode).toBe(200);

    const retry = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/withdrawals/${userId}/retry`,
      headers: operator.headers,
    });

    // 실패 기록이 없는 계정이라 규칙이 막는다 — 관문을 통과해 도메인 규칙까지
    // 닿았다는 것, 그리고 그 규칙 위반이 400으로 내려온다는 것만 본다.
    expect(retry.statusCode).toBe(400);
    expect(retry.json<{ error: { message: string } }>().error.message).toContain(
      '다시 시도할 실패 기록이 없는'
    );
  });

  it('사유 없이 보류를 걸 수 없다 — 도메인 규칙 위반은 400이다', async () => {
    const operator = await anOperatorSession();
    const userId = await aWithdrawnUser();

    const response = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/withdrawals/${userId}/hold`,
      headers: operator.headers,
      payload: { reason: '  ', until: new Date(Date.now() + 60_000).toISOString() },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { message: string } }>().error.message).toContain('보류 사유');
  });
});
