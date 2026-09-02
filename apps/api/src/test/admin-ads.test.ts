import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 광고 지면 HTTP API. `ad-admin.ts`는 이전엔 `require.main === module` 관문이
 * 없어 가져오기만 해도 CLI가 실행됐다 — 이번에 라우트로 열면서 그 관문과
 * `requireOperator` 확인(원래 아예 없었다)을 같이 넣었다.
 */
describeWithDb('광고 지면 API', () => {
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

  async function aVendor(): Promise<string> {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ('광고용 홀', 'hall', '서울', 'public_data') RETURNING id`
    );

    return rows[0]!.id;
  }

  it('운영자가 아니면 403이다', async () => {
    const session = await signInAs(test, `not-operator-${Math.random()}`);

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/ads/placements',
      headers: session.headers,
    });

    expect(response.statusCode).toBe(403);
  });

  it('광고가 건드릴 수 없는 지면 목록을 준다', async () => {
    const operator = await anOperatorSession();

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/ads/firewall',
      headers: operator.headers,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ protectedSurfaces: { surface: string; label: string }[] }>();
    expect(body.protectedSurfaces.length).toBeGreaterThan(0);
  });

  it('운영자는 자리를 잡고, 목록에서 보고, 내릴 수 있다', async () => {
    const operator = await anOperatorSession();
    const vendorId = await aVendor();

    const add = await test.app.inject({
      method: 'POST',
      url: '/v1/admin/ads/placements',
      headers: operator.headers,
      payload: {
        vendorId,
        surface: 'search',
        tier: 'standard',
        startsOn: '2026-09-01',
        endsOn: '2026-09-30',
      },
    });

    expect(add.statusCode).toBe(201);
    const { id } = add.json<{ id: string }>();

    const list = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/ads/placements',
      headers: operator.headers,
    });

    expect(list.statusCode).toBe(200);
    expect(list.json<{ placements: { id: string }[] }>().placements.map((p) => p.id)).toContain(
      id
    );

    const remove = await test.app.inject({
      method: 'DELETE',
      url: `/v1/admin/ads/placements/${id}`,
      headers: operator.headers,
    });

    expect(remove.statusCode).toBe(200);

    const after = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/ads/placements',
      headers: operator.headers,
    });

    expect(
      after.json<{ placements: { id: string }[] }>().placements.map((p) => p.id)
    ).not.toContain(id);
  });

  it('없는 자리를 내리면 404다', async () => {
    const operator = await anOperatorSession();

    const response = await test.app.inject({
      method: 'DELETE',
      url: '/v1/admin/ads/placements/00000000-0000-4000-8000-000000000000',
      headers: operator.headers,
    });

    expect(response.statusCode).toBe(404);
  });
});
