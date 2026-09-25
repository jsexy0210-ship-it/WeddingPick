import { createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

type Body = { groups: { key: string; vendors: { id: string; name: string; category: string }[] }[] };

/**
 * Pick 묶음별 «내 조건에 맞는 곳» — `GET /v1/me/pick-recommendations`
 * (2026-09-25 대표 지시 「Pick 메뉴 카테고리별로 각각 5개씩」).
 *
 * 지키는 것: 묶음마다 5곳을 넘지 않는다 · 담아둔 곳은 빠진다 · 온보딩에서 정한 업종은
 * 권하지 않는다 · 온보딩 지역이 맞는 곳이 먼저 선다 · 묶음 안 업종을 번갈아 뽑는다.
 */
describeWithDb('Pick 묶음별 추천', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function createVendor(name: string, category: string, region = '서울') {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ($1, $2::vendor_category, $3, 'public_data') RETURNING id`,
      [name, category, region]
    );

    return rows[0]!.id;
  }

  const get = (headers: Record<string, string>) =>
    test.app.inject({ method: 'GET', url: '/v1/me/pick-recommendations', headers });

  const group = (body: Body, key: string) => body.groups.find((row) => row.key === key)!;

  it('로그인하지 않으면 부를 수 없다', async () => {
    expect((await get({})).statusCode).toBe(401);
  });

  it('묶음 넷이 준비 순서로 오고, 묶음마다 5곳을 넘지 않는다', async () => {
    const { headers } = await signInAs(test);
    await createWedding(test, headers);
    for (let index = 1; index <= 7; index += 1) await createVendor(`웨딩홀 ${index}`, 'hall');

    const response = await get(headers);
    expect(response.statusCode).toBe(200);
    const body = response.json<Body>();

    expect(body.groups.map((row) => row.key)).toEqual(['start', 'sdm', 'ceremony', 'goods']);
    expect(group(body, 'start').vendors).toHaveLength(5);
    expect(group(body, 'sdm').vendors).toHaveLength(0);
  });

  it('담아둔 곳은 추천에서 빠진다 — 후보 줄에 이미 있다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);
    const picked = await createVendor('담은 웨딩홀', 'hall');
    await createVendor('안 담은 웨딩홀', 'hall');
    await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/candidates`,
      headers,
      payload: { vendorId: picked },
    });

    const names = group((await get(headers)).json<Body>(), 'start').vendors.map((vendor) => vendor.name);

    expect(names).toEqual(['안 담은 웨딩홀']);
  });

  it('온보딩에서 이미 정한 업종은 권하지 않는다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);
    await test.pool.query(
      `UPDATE structured.weddings SET prepared_categories = ARRAY['hall']::vendor_category[] WHERE id = $1`,
      [weddingId]
    );
    await createVendor('웨딩홀', 'hall');

    expect(group((await get(headers)).json<Body>(), 'start').vendors).toEqual([]);
  });

  it('온보딩 지역이 맞는 곳이 먼저 선다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);
    await test.pool.query(`UPDATE structured.weddings SET region = '부산' WHERE id = $1`, [weddingId]);
    await createVendor('가 서울 웨딩홀', 'hall', '서울');
    await createVendor('나 부산 웨딩홀', 'hall', '부산');

    const names = group((await get(headers)).json<Body>(), 'start').vendors.map((vendor) => vendor.name);

    expect(names[0]).toBe('나 부산 웨딩홀');
  });

  it('묶음 안 업종을 번갈아 뽑는다 — 한 업종이 다섯 자리를 다 차지하지 않는다', async () => {
    const { headers } = await signInAs(test);
    await createWedding(test, headers);
    for (let index = 1; index <= 5; index += 1) await createVendor(`스튜디오 ${index}`, 'studio');
    /* 이름순이면 맨 뒤다 — 번갈아 뽑지 않으면 스튜디오 다섯이 자리를 다 차지한다. */
    await createVendor('힣 드레스', 'dress');

    const categories = group((await get(headers)).json<Body>(), 'sdm').vendors.map((vendor) => vendor.category);

    expect(categories).toHaveLength(5);
    expect(categories).toContain('dress');
  });
});
