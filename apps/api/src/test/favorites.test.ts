import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb('관심업체', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function createVendor(name: string) {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ($1, 'hall', '서울', 'public_data') RETURNING id`,
      [name]
    );
    return rows[0]!.id;
  }

  it('하트를 누르면 개인 관심업체 목록에만 저장된다', async () => {
    const me = await signInAs(test, 'favorite-owner');
    const vendorId = await createVendor('관심홀');

    const created = await test.app.inject({
      method: 'POST',
      url: '/v1/me/favorite-vendors',
      headers: me.headers,
      payload: { vendorId },
    });
    expect(created.statusCode).toBe(201);

    const listed = await test.app.inject({
      method: 'GET',
      url: '/v1/me/favorite-vendors',
      headers: me.headers,
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json<{ total: number; items: { vendorId: string }[] }>()).toMatchObject({
      total: 1,
      items: [{ vendorId }],
    });

    const picks = await test.pool.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM structured.vendor_candidates WHERE vendor_id = $1',
      [vendorId]
    );
    expect(Number(picks.rows[0]!.n)).toBe(0);
  });

  it('관심업체는 다른 사용자와 섞이지 않는다', async () => {
    const owner = await signInAs(test, 'favorite-owner');
    const other = await signInAs(test, 'favorite-other');
    const vendorId = await createVendor('개인관심홀');

    await test.app.inject({
      method: 'POST',
      url: '/v1/me/favorite-vendors',
      headers: owner.headers,
      payload: { vendorId },
    });

    const listed = await test.app.inject({
      method: 'GET',
      url: '/v1/me/favorite-vendors',
      headers: other.headers,
    });
    expect(listed.json<{ total: number }>().total).toBe(0);
  });

  it('30곳을 넘어도 관심업체를 계속 저장할 수 있다', async () => {
    const me = await signInAs(test, 'favorite-many');

    for (let index = 0; index < 31; index += 1) {
      const vendorId = await createVendor(`관심홀${index}`);
      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/me/favorite-vendors',
        headers: me.headers,
        payload: { vendorId },
      });
      expect(response.statusCode).toBe(201);
    }

    const listed = await test.app.inject({
      method: 'GET',
      url: '/v1/me/favorite-vendors',
      headers: me.headers,
    });
    expect(listed.json<{ total: number }>().total).toBe(31);
  });

  it('하트를 다시 누르면 관심업체에서만 빠진다', async () => {
    const me = await signInAs(test, 'favorite-remove');
    const vendorId = await createVendor('삭제관심홀');

    await test.app.inject({
      method: 'POST',
      url: '/v1/me/favorite-vendors',
      headers: me.headers,
      payload: { vendorId },
    });

    expect((await test.app.inject({
      method: 'DELETE',
      url: `/v1/me/favorite-vendors/${vendorId}`,
      headers: me.headers,
    })).statusCode).toBe(204);

    const listed = await test.app.inject({
      method: 'GET',
      url: '/v1/me/favorite-vendors',
      headers: me.headers,
    });
    expect(listed.json<{ total: number }>().total).toBe(0);
  });
});
