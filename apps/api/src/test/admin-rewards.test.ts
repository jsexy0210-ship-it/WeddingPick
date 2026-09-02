import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 보상 지급 확인 HTTP API. `reward-admin.ts`는 이전엔 `require.main ===
 * module` 관문이 없어 가져오기만 해도 CLI가 실행됐다 — 이번에 라우트로 열면서
 * 그 관문과 `decideReward`의 `requireOperator` 확인(돈이 오가는 결정인데도
 * 원래 아예 없었다)을 같이 넣었다.
 */
describeWithDb('보상 지급 확인 API', () => {
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

  async function aRewardGrant(status: 'earned' | 'held' = 'earned') {
    const inviter = await signInAs(test, `inviter-${Math.random()}`);
    const invited = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
    );
    const referral = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.referrals (inviter_user_id, invited_user_id)
       VALUES ($1, $2) RETURNING id`,
      [inviter.userId, invited.rows[0]!.id]
    );
    const grant = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.reward_grants
         (user_id, kind, amount_krw, status, reason_code, referral_id)
       VALUES ($1, 'referral', 3000, $2::reward_status, 'seed', $3) RETURNING id`,
      [inviter.userId, status, referral.rows[0]!.id]
    );

    return { grantId: grant.rows[0]!.id, inviter };
  }

  it('운영자가 아니면 403이다', async () => {
    const session = await signInAs(test, `not-operator-${Math.random()}`);

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/rewards',
      headers: session.headers,
    });

    expect(response.statusCode).toBe(403);
  });

  it('운영자는 지급 대기 목록을 보고, 지급으로 적을 수 있다', async () => {
    const operator = await anOperatorSession();
    const { grantId } = await aRewardGrant('earned');

    const list = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/rewards',
      headers: operator.headers,
    });

    expect(list.statusCode).toBe(200);
    expect(list.json<{ grants: { id: string; amountKrw: number }[] }>().grants.map((g) => g.id)).toContain(
      grantId
    );

    const paid = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/rewards/${grantId}/paid`,
      headers: operator.headers,
      payload: { note: 'NPay 송금 완료' },
    });

    expect(paid.statusCode).toBe(200);

    const after = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/rewards',
      headers: operator.headers,
    });

    expect(
      after.json<{ grants: { id: string }[] }>().grants.map((g) => g.id)
    ).not.toContain(grantId);
  });

  it('held 목록은 별도로 조회하고, 차단할 수 있다', async () => {
    const operator = await anOperatorSession();
    const { grantId } = await aRewardGrant('held');

    const held = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/rewards/held',
      headers: operator.headers,
    });

    expect(held.statusCode).toBe(200);
    expect(held.json<{ grants: { id: string }[] }>().grants.map((g) => g.id)).toContain(grantId);

    const block = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/rewards/${grantId}/block`,
      headers: operator.headers,
      payload: { note: '중복 계정으로 확인됨' },
    });

    expect(block.statusCode).toBe(200);
  });

  it('받는 본인은 지급할 수 없다 — 도메인 규칙 위반은 400이다', async () => {
    const { grantId, inviter } = await aRewardGrant('earned');
    await test.pool.query('UPDATE structured.users SET is_operator = true WHERE id = $1', [
      inviter.userId,
    ]);

    const response = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/rewards/${grantId}/paid`,
      headers: inviter.headers,
      payload: { note: '자기 자신 지급 시도' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { message: string } }>().error.message).toContain(
      '받는 본인'
    );
  });
});
