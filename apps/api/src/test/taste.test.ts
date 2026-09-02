import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

type TasteList = { tastes: string[] };

/**
 * 취향. 홈 C-1 시안 1 — 사진 넉 장으로 «어떤 결혼식을 원하세요?»를 받는 자리.
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

  const put = (headers: Record<string, string>, tastes: string[]) =>
    test.app.inject({ method: 'PUT', url: '/v1/me/taste', headers, payload: { tastes } });

  it('고른 적이 없으면 빈 배열을 준다', async () => {
    const { headers } = await signInAs(test);

    expect((await get(headers)).tastes).toEqual([]);

    const stored = await test.pool.query('SELECT 1 FROM structured.taste_preferences');
    expect(stored.rows).toHaveLength(0);
  });

  it('고른 것을 그대로 돌려준다', async () => {
    const { headers } = await signInAs(test);

    const response = await put(headers, ['white', 'flower']);
    expect(response.statusCode).toBe(200);
    expect(response.json<TasteList>().tastes).toEqual(['white', 'flower']);

    expect((await get(headers)).tastes).toEqual(['white', 'flower']);
  });

  it('다시 보내면 이전 값을 덮어쓴다', async () => {
    // "추가"가 아니라 "지금 고른 전체"를 보내는 계약이다 — 하나를 눌러 빼면
    // 그 값이 빠진 배열이 온다.
    const { headers } = await signInAs(test);

    await put(headers, ['white', 'flower']);
    await put(headers, ['classic']);

    expect((await get(headers)).tastes).toEqual(['classic']);
  });

  it('모르는 값은 거절한다', async () => {
    // 사진 시안에 없는 값이 서버에 남으면 화면이 빈 칸을 그린다.
    const { headers } = await signInAs(test);

    expect((await put(headers, ['not-a-real-taste'])).statusCode).toBe(400);
  });

  it('남의 취향을 보지 않는다', async () => {
    const other = await signInAs(test, 'other-user');
    await put(other.headers, ['classic']);

    const me = await signInAs(test, 'me');

    expect((await get(me.headers)).tastes).toEqual([]);
  });

  it('로그인해야 볼 수 있다', async () => {
    expect((await test.app.inject({ method: 'GET', url: '/v1/me/taste' })).statusCode).toBe(401);
  });
});
