import { createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

type Body = {
  groups: {
    category: string;
    categoryLabel: string;
    state: string;
    pickCount: number;
    vendors: { id: string; name: string; rating: { average: number; count: number } | null }[];
  }[];
  remaining: number;
  remainingCategories: string[];
};

/**
 * Pick 추천 — 2026-09-15 대표 사양 §4~§14. `GET /v1/me/recommendations`.
 *
 * **여기서 지키는 것은 「화면을 만들었다」로는 확인되지 않는 것들이다**(§25). 업종을 정하면
 * 그 업종이 빠지고 다음이 올라오는지, 담아둔 곳이 자기 업종에 나오는지, 홈과 전체 페이지가
 * 같은 순서를 보는지 — 셋 다 **상태가 바뀐 뒤에만** 드러난다.
 */
describeWithDb('Pick 추천', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function createVendor(name: string, category: string) {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ($1, $2::vendor_category, '서울', 'public_data') RETURNING id`,
      [name, category]
    );

    return rows[0]!.id;
  }

  const get = (headers: Record<string, string>, query = '') =>
    test.app.inject({ method: 'GET', url: `/v1/me/recommendations${query}`, headers });

  const pick = (headers: Record<string, string>, weddingId: string, vendorId: string) =>
    test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/candidates`,
      headers,
      payload: { vendorId },
    });

  const decide = (headers: Record<string, string>, weddingId: string, category: string, vendorId: string) =>
    test.app.inject({
      method: 'PUT',
      url: `/v1/weddings/${weddingId}/decisions`,
      headers,
      payload: { category, vendorId },
    });

  it('로그인하지 않으면 부를 수 없다 — 준비 상태가 웨딩에 매달려 있다', async () => {
    expect((await get({})).statusCode).toBe(401);
  });

  it('아무것도 안 정했으면 준비 순서대로 선다 (§11)', async () => {
    const { headers } = await signInAs(test);
    await createWedding(test, headers);

    const body = (await get(headers)).json<Body>();

    /* 준비 순서(PREPARATION_CATEGORIES)의 앞 셋. 결정사가 맨 앞이다. */
    expect(body.groups.slice(0, 3).map((group) => group.category)).toEqual([
      'wedding_info_company',
      'hall',
      'studio',
    ]);
    expect(body.groups.every((group) => group.state === 'NOT_STARTED')).toBe(true);
  });

  it('담아둔 곳이 많은 업종이 먼저 선다 — 비교 → 담아둠 → 시작 전 (§11)', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);

    /* 허니문은 준비 순서의 맨 뒤인데, 두 곳을 담아 COMPARING이 되면 맨 앞으로 온다. */
    await pick(headers, weddingId, await createVendor('허니문 가', 'honeymoon'));
    await pick(headers, weddingId, await createVendor('허니문 나', 'honeymoon'));
    await pick(headers, weddingId, await createVendor('예물 가', 'goods'));

    const body = (await get(headers)).json<Body>();

    expect(body.groups[0]!.category).toBe('honeymoon');
    expect(body.groups[0]!.state).toBe('COMPARING');
    expect(body.groups[1]!.category).toBe('goods');
    expect(body.groups[1]!.state).toBe('SHORTLISTED');
  });

  /*
   * §7의 「펼침 내용」. 자기가 담은 곳이 자기 업종에 없으면 §8의 흐름(추천 → 보기 → Pick →
   * 비교 → 결정)이 거기서 끊긴다 — 사용자는 자기 Pick이 어디 갔는지부터 찾는다.
   */
  it('담아둔 업종에는 그 사람이 Pick한 곳이 나온다 (§7)', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);
    await createVendor('안 담은 웨딩홀', 'hall');
    await pick(headers, weddingId, await createVendor('담아둔 웨딩홀', 'hall'));

    const body = (await get(headers)).json<Body>();
    const hall = body.groups.find((group) => group.category === 'hall')!;

    expect(hall.state).toBe('SHORTLISTED');
    expect(hall.vendors.map((vendor) => vendor.name)).toEqual(['담아둔 웨딩홀']);
  });

  /* 사양 §8의 핵심. 이것이 깨지면 홈이 이미 끝난 준비를 계속 권한다. */
  it('업종을 정하면 목록에서 빠지고 다음 업종이 첫째가 된다 (§8)', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);
    const vendorId = await createVendor('정할 웨딩홀', 'hall');

    await pick(headers, weddingId, vendorId);
    expect((await get(headers)).json<Body>().groups[0]!.category).toBe('hall');

    expect((await decide(headers, weddingId, 'hall', vendorId)).statusCode).toBeLessThan(300);

    const after = (await get(headers)).json<Body>();

    expect(after.groups.some((group) => group.category === 'hall')).toBe(false);
    expect(after.groups[0]!.category).toBe('wedding_info_company');
  });

  /*
   * 홈은 셋만 그리고 전체 페이지는 다 그린다. 「아직 결정하지 않은 준비가 N개 있어요」가
   * 보이는 수로 세면 홈에서는 늘 3이 되고, 그 줄은 아무것도 말하지 않게 된다.
   */
  it('limit은 보여줄 업종만 자르고 남은 수는 전체를 센다 (§9 · §12)', async () => {
    const { headers } = await signInAs(test);
    await createWedding(test, headers);

    const all = (await get(headers)).json<Body>();
    const home = (await get(headers, '?limit=3')).json<Body>();

    expect(home.groups).toHaveLength(3);
    expect(all.groups.length).toBeGreaterThan(3);
    /* 자른 쪽과 안 자른 쪽이 같은 수를 말한다 — 홈과 전체 페이지가 같은 상태다(§14). */
    expect(home.remaining).toBe(all.remaining);
    expect(home.remainingCategories).toEqual(all.remainingCategories);
    /* 홈이 그리는 셋은 전체의 앞 셋과 같다. 두 화면의 순서가 갈리지 않는다. */
    expect(home.groups.map((g) => g.category)).toEqual(
      all.groups.slice(0, 3).map((g) => g.category)
    );
  });

  /*
   * 확인된 후기가 문턱(5건)에 못 미치면 별점을 만들지 않는다. 「0.0」도 아니고 「-」도
   * 아니라 **칸 자체가 null**이어야 화면이 그 줄을 안 그린다.
   */
  it('후기가 없는 업체는 별점 칸이 null이다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);
    await pick(headers, weddingId, await createVendor('후기 없는 웨딩홀', 'hall'));

    const body = (await get(headers)).json<Body>();
    const hall = body.groups.find((group) => group.category === 'hall')!;

    expect(hall.vendors[0]!.rating).toBeNull();
  });
});
