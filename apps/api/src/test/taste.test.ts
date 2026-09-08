import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

type TasteList = { category: string | null; keys: string[] };

/**
 * 취향. 온보딩 5/5(WP-APP-021) — 핸드오프 v3.19 «취향을 다음 미완료 업종 기준으로 개편».
 *
 * **한 업종의 취향만 둔다.** 다시 보내면 업종째 덮어쓴다.
 *
 * **행이 없으면 아직 안 고른 것으로 본다**(설정과 같은 관례) — 로그인한 모든
 * 사람에게 미리 빈 행을 만들지 않는다.
 */
describeWithDb('취향', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  const get = async (headers: Record<string, string>) =>
    (await test.app.inject({ method: 'GET', url: '/v1/me/taste', headers })).json<TasteList>();

  const put = (headers: Record<string, string>, payload: Record<string, unknown>) =>
    test.app.inject({ method: 'PUT', url: '/v1/me/taste', headers, payload });

  it('고른 적이 없으면 업종도 키도 없다', async () => {
    const { headers } = await signInAs(test);

    expect(await get(headers)).toEqual({ category: null, keys: [] });

    const stored = await test.pool.query('SELECT 1 FROM structured.taste_preferences');
    expect(stored.rows).toHaveLength(0);
  });

  it('고른 것을 업종과 함께 그대로 돌려준다', async () => {
    const { headers } = await signInAs(test);

    const response = await put(headers, { category: 'studio', keys: ['studio_white', 'studio_film'] });
    expect(response.statusCode).toBe(200);
    expect(response.json<TasteList>()).toEqual({ category: 'studio', keys: ['studio_white', 'studio_film'] });

    expect(await get(headers)).toEqual({ category: 'studio', keys: ['studio_white', 'studio_film'] });
  });

  it('다시 보내면 업종째 덮어쓴다', async () => {
    // "추가"가 아니라 "지금 고른 전체"를 보내는 계약이다 — 업종이 바뀌면 이전 업종의 키는 사라진다.
    const { headers } = await signInAs(test);

    await put(headers, { category: 'studio', keys: ['studio_white', 'studio_film'] });
    await put(headers, { category: 'hall', keys: ['hall_hotel'] });

    expect(await get(headers)).toEqual({ category: 'hall', keys: ['hall_hotel'] });
  });

  it('최소 1장 — 빈 배열은 거절한다', async () => {
    // 취향은 온보딩에서 유일한 필수 답이다(SPEC §13.6).
    const { headers } = await signInAs(test);

    expect((await put(headers, { category: 'hall', keys: [] })).statusCode).toBe(400);
  });

  it('그 업종 세트에 없는 키는 거절한다', async () => {
    // 다른 업종의 키가 서버에 남으면 화면이 빈 칸을 그린다.
    const { headers } = await signInAs(test);

    expect((await put(headers, { category: 'hall', keys: ['studio_white'] })).statusCode).toBe(400);
    expect((await put(headers, { category: 'hall', keys: ['not-a-real-taste'] })).statusCode).toBe(400);
    // 옛 계약(v3.18 이전)의 키도 더는 받지 않는다.
    expect((await put(headers, { category: 'studio', keys: ['white'] })).statusCode).toBe(400);
  });

  it('취향을 묻지 않는 업종은 거절한다', async () => {
    const { headers } = await signInAs(test);

    expect((await put(headers, { category: 'hair', keys: ['hair_x'] })).statusCode).toBe(400);
    expect((await put(headers, { category: 'etc', keys: ['x'] })).statusCode).toBe(400);
  });

  it('세트가 바뀌어 남은 모르는 키는 읽을 때 버린다', async () => {
    const { headers, userId } = await signInAs(test);

    await test.pool.query(
      `INSERT INTO structured.taste_preferences (user_id, taste_category, tastes)
       VALUES ($1, 'studio', '{studio_white,flower}')`,
      [userId]
    );

    expect(await get(headers)).toEqual({ category: 'studio', keys: ['studio_white'] });
  });

  it('남의 취향을 보지 않는다', async () => {
    const other = await signInAs(test, 'other-user');
    await put(other.headers, { category: 'hall', keys: ['hall_chapel'] });

    const me = await signInAs(test, 'me');

    expect(await get(me.headers)).toEqual({ category: null, keys: [] });
  });

  it('로그인해야 볼 수 있다', async () => {
    expect((await test.app.inject({ method: 'GET', url: '/v1/me/taste' })).statusCode).toBe(401);
  });
});
