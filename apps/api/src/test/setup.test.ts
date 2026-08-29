import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/** 오늘보다 뒤인 날. 결혼식은 미래여야 한다. */
function future(days: number): string {
  const date = new Date();

  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
}

/**
 * 이름·예식일 등록. 핸드오프 2번 — 스킵할 수 없는 화면이다.
 *
 * 둘을 한 번에 받는 것이 요점이다. 따로 받으면 이름만 넣고 나간 사람이 생기고,
 * 그 사람의 홈은 이름은 부르는데 D-Day가 없는 반쪽이 된다.
 */
describeWithDb('이름·예식일 등록', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function setup(headers: Record<string, string>, over: Record<string, unknown> = {}) {
    return await test.app.inject({
      method: 'POST',
      url: '/v1/me/setup',
      headers,
      payload: { displayName: '지선', weddingDate: future(231), ...over },
    });
  }

  const me = (headers: Record<string, string>) =>
    test.app.inject({ method: 'GET', url: '/v1/me', headers });

  it('처음에는 설정이 끝나지 않은 상태다', async () => {
    const { headers } = await signInAs(test);

    const body = (await me(headers)).json<{
      displayName: string | null;
      weddingDate: string | null;
      setupComplete: boolean;
    }>();

    expect(body.displayName).toBeNull();
    expect(body.weddingDate).toBeNull();
    expect(body.setupComplete).toBe(false);
  });

  it('둘을 한 번에 저장한다', async () => {
    const { headers } = await signInAs(test);

    const response = await setup(headers);

    expect(response.statusCode).toBe(200);

    const body = (await me(headers)).json<{
      displayName: string;
      weddingDate: string;
      weddingId: string;
      setupComplete: boolean;
    }>();

    expect(body.displayName).toBe('지선');
    expect(body.setupComplete).toBe(true);
    // 웨딩이 없으면 여기서 만든다. "먼저 웨딩을 만드세요"라고 할 자리가 아니다.
    expect(body.weddingId).toBeTruthy();
  });

  it('이미 있는 웨딩에는 날짜만 채운다', async () => {
    const { headers } = await signInAs(test);

    const created = await test.app.inject({
      method: 'POST',
      url: '/v1/weddings',
      headers,
      payload: {},
    });

    await setup(headers);

    const weddings = await test.pool.query('SELECT 1 FROM structured.weddings');

    // 웨딩이 둘로 늘어나면 견적도 후보도 둘로 갈린다.
    expect(weddings.rows).toHaveLength(1);
    expect(created.statusCode).toBe(201);
  });

  it('초성이나 모음만으로는 등록할 수 없다', async () => {
    const { headers } = await signInAs(test);

    const response = await setup(headers, { displayName: 'ㅈㅅ' });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { message: string } }>().error.message).toContain('초성');
  });

  it('다섯 자를 넘기면 막는다', async () => {
    const { headers } = await signInAs(test);

    expect((await setup(headers, { displayName: '일이삼사오육' })).statusCode).toBe(400);
  });

  it('오늘과 과거는 예식일이 될 수 없다', async () => {
    // 결혼식은 미래다.
    const { headers } = await signInAs(test);
    const today = new Date().toISOString().slice(0, 10);

    expect((await setup(headers, { weddingDate: today })).statusCode).toBe(400);
    expect((await setup(headers, { weddingDate: future(-1) })).statusCode).toBe(400);
  });

  it('다시 부르면 덮어쓴다', async () => {
    // 핸드오프: "입력한 정보는 언제든 설정에서 바꿀 수 있어요"
    const { headers } = await signInAs(test);

    await setup(headers);
    await setup(headers, { displayName: '민준', weddingDate: future(100) });

    const body = (await me(headers)).json<{ displayName: string; weddingDate: string }>();

    expect(body.displayName).toBe('민준');
    expect(body.weddingDate).toBe(future(100));
  });

  it('로그인해야 등록할 수 있다', async () => {
    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/me/setup',
      payload: { displayName: '지선', weddingDate: future(231) },
    });

    expect(response.statusCode).toBe(401);
  });

  it('이름은 users에 두는 유일한 개인정보다', async () => {
    /*
     * 0001이 "이름·연락처 같은 개인정보는 여기 두지 않는다"고 적었다. 0030이 한 칸을
     * 열었고, 그 칸이 하나뿐이라는 것을 여기서 지킨다 — 다음에 연락처를 붙이려는
     * 사람이 이 테스트를 먼저 만난다.
     */
    const columns = await test.pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'structured' AND table_name = 'users'
       ORDER BY column_name`
    );

    expect(columns.rows.map((row) => row.column_name)).toEqual([
      'created_at',
      'deleted_at',
      'display_name',
      'id',
      'is_operator',
    ]);
  });
});
