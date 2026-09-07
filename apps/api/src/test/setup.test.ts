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
 * 최소 온보딩. 통합정책 v3.10 §3 — 받는 것은 **예식일과 지역**이다.
 *
 * 이름은 받지 않는다. 그것이 이 화면의 요점이라 여기서 지킨다 — 이름을 도로
 * 필수로 만들려는 사람이 이 테스트를 먼저 만난다.
 */
describeWithDb('최소 온보딩', () => {
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
      payload: { weddingDate: future(231), region: '서울', ...over },
    });
  }

  const me = (headers: Record<string, string>) =>
    test.app.inject({ method: 'GET', url: '/v1/me', headers });

  it('처음에는 설정이 끝나지 않은 상태다', async () => {
    const { headers } = await signInAs(test);

    const body = (await me(headers)).json<{
      displayName: string | null;
      weddingDate: string | null;
      region: string | null;
      setupComplete: boolean;
    }>();

    expect(body.displayName).toBeNull();
    expect(body.weddingDate).toBeNull();
    expect(body.region).toBeNull();
    expect(body.setupComplete).toBe(false);
  });

  it('예식일과 지역을 한 번에 저장한다', async () => {
    const { headers } = await signInAs(test);

    const response = await setup(headers);

    expect(response.statusCode).toBe(200);

    const body = (await me(headers)).json<{
      weddingDate: string;
      region: string;
      weddingId: string;
      setupComplete: boolean;
    }>();

    expect(body.weddingDate).toBe(future(231));
    expect(body.region).toBe('서울');
    expect(body.setupComplete).toBe(true);
    // 웨딩이 없으면 여기서 만든다. "먼저 웨딩을 만드세요"라고 할 자리가 아니다.
    expect(body.weddingId).toBeTruthy();
  });

  it('응답이 /v1/me와 같은 모양이다', async () => {
    /*
     * 계약이 두 경로에 같은 응답을 적어뒀다. 서버가 몇 칸만 채워 보내도 서버는
     * 조용하고 앱이 검증에서 처음 깨지므로, 여기서 두 응답을 통째로 견준다.
     */
    const { headers } = await signInAs(test);

    const saved = (await setup(headers)).json<Record<string, unknown>>();
    const read = (await me(headers)).json<Record<string, unknown>>();

    expect(saved).toEqual(read);
  });

  it('이름 없이도 설정이 끝난다', async () => {
    // v3.10 §3: 닉네임은 최초 필수입력에서 뺀다.
    const { headers } = await signInAs(test);

    await setup(headers);

    const body = (await me(headers)).json<{ displayName: string | null; setupComplete: boolean }>();

    expect(body.displayName).toBeNull();
    expect(body.setupComplete).toBe(true);
  });

  it('지역이 없으면 등록할 수 없다', async () => {
    const { headers } = await signInAs(test);

    expect((await setup(headers, { region: '' })).statusCode).toBe(400);
    expect((await setup(headers, { region: '   ' })).statusCode).toBe(400);
  });

  it('이미 있는 웨딩에는 값만 채운다', async () => {
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

  it('오늘과 과거는 예식일이 될 수 없다', async () => {
    // 결혼식은 미래다.
    const { headers } = await signInAs(test);
    const today = new Date().toISOString().slice(0, 10);

    expect((await setup(headers, { weddingDate: today })).statusCode).toBe(400);
    expect((await setup(headers, { weddingDate: future(-1) })).statusCode).toBe(400);
  });

  it('다시 부르면 덮어쓴다', async () => {
    // "입력한 정보는 언제든 설정에서 바꿀 수 있어요"
    const { headers } = await signInAs(test);

    await setup(headers);
    await setup(headers, { weddingDate: future(100), region: '부산' });

    const body = (await me(headers)).json<{ weddingDate: string; region: string }>();

    expect(body.weddingDate).toBe(future(100));
    expect(body.region).toBe('부산');
  });

  it('총예산은 구간 선택이고 아직 모르겠어요가 null이다', async () => {
    const { headers } = await signInAs(test);

    await setup(headers, { budgetBracket: '30m_40m' });
    const saved = (
      await me(headers)
    ).json<{ budgetBracket: string | null; budgetAmount: number | null }>();

    expect(saved.budgetBracket).toBe('30m_40m');
    // budget_amount는 구간의 상한값을 서버가 파생한 것이다 — top3 추천이 숫자로 쓴다.
    expect(saved.budgetAmount).toBe(40_000_000);

    // 명시적인 null은 "아직 모르겠어요"가 아니라 "안 정함"이다. 되돌릴 수 있어야 한다.
    await setup(headers, { budgetBracket: null });
    const cleared = (
      await me(headers)
    ).json<{ budgetBracket: string | null; budgetAmount: number | null }>();

    expect(cleared.budgetBracket).toBeNull();
    expect(cleared.budgetAmount).toBeNull();
  });

  it('4,000만원 이상은 상한이 없어 budgetAmount가 null이다', async () => {
    const { headers } = await signInAs(test);

    await setup(headers, { budgetBracket: 'over_40m' });
    const body = (
      await me(headers)
    ).json<{ budgetBracket: string | null; budgetAmount: number | null }>();

    expect(body.budgetBracket).toBe('over_40m');
    expect(body.budgetAmount).toBeNull();
  });

  it('예산을 안 보내면 건드리지 않는다', async () => {
    /*
     * 안 보낸 것과 null을 보낸 것은 다르다. 같게 다루면 예식일만 고치러 온
     * 사람이 적어둔 예산을 잃는다.
     */
    const { headers } = await signInAs(test);

    await setup(headers, { budgetBracket: '30m_40m' });
    await setup(headers, { weddingDate: future(120) });

    expect(
      (await me(headers)).json<{ budgetBracket: string | null }>().budgetBracket
    ).toBe('30m_40m');
  });

  it('로그인해야 등록할 수 있다', async () => {
    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/me/setup',
      payload: { weddingDate: future(231), region: '서울' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('부를 이름은 MY에서 따로 정한다', async () => {
    const { headers } = await signInAs(test);

    const name = (displayName: string | null) =>
      test.app.inject({
        method: 'POST',
        url: '/v1/me/display-name',
        headers,
        payload: { displayName },
      });

    expect((await name('지선')).statusCode).toBe(200);
    expect((await me(headers)).json<{ displayName: string | null }>().displayName).toBe('지선');

    // 한 번 적었다고 영영 못 지우게 할 이유가 없다.
    expect((await name(null)).statusCode).toBe(200);
    expect((await me(headers)).json<{ displayName: string | null }>().displayName).toBeNull();
  });

  it('초성이나 모음만으로는 이름이 될 수 없다', async () => {
    const { headers } = await signInAs(test);

    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/me/display-name',
      headers,
      payload: { displayName: 'ㅈㅅ' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { message: string } }>().error.message).toContain('초성');
  });

  it('다섯 자를 넘기면 막는다', async () => {
    const { headers } = await signInAs(test);

    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/me/display-name',
      headers,
      payload: { displayName: '일이삼사오육' },
    });

    expect(response.statusCode).toBe(400);
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
      /*
       * 0046이 두 칸을 더했다 — age_gate·age_checked_at. 이후 0078(v3.13 §3.5)이
       * 생년월일 계산을 자기 신고 체크박스로 바꾸며 age_verified·age_verified_at
       * 두 칸을 더 얹었다. 옛 칸은 지우지 않았으니(마이그레이션 위험 최소화) 다섯
       * 칸이 함께 남는다 — 전부 **판정과 시각**이지 값이 아니다. 생년월일 자체는
       * 받지도 저장하지도 않는다.
       */
      'activated_at',
      'age_checked_at',
      'age_gate',
      'age_verified',
      'age_verified_at',
      'created_at',
      'deleted_at',
      'display_name',
      // 값이 아니라 사용자가 직접 이름을 정했는지 표시하는 덮어쓰기 방지 플래그다.
      'display_name_user_set',
      'id',
      'is_operator',
    ]);
  });
});
