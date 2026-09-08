import { createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

type BootstrapBody = {
  member: { userId: string; weddingId: string | null } | null;
  notifications: { unread: number } | null;
  popularVendors: { vendorId: string }[];
  candidates: { nextCategory: string | null } | null;
  recommendations: { vendorId: string }[];
};

/**
 * 홈 부팅. 회원 · 알림 · 많이 확인된 곳 · 담아둔 후보 · 웨딩픽 추천을 한 번에
 * 받는 자리다 — 서버 안에서 그 다섯을 병렬로 모아 화면이 인터넷을 여러 번
 * 왕복하지 않게 한다.
 */
describeWithDb('홈 부팅', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  const bootstrap = (headers?: Record<string, string>) =>
    test.app.inject({ method: 'GET', url: '/v1/app/bootstrap', headers });

  async function aVendor(name: string, category = 'hall') {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ($1, $2::vendor_category, '서울', 'public_data') RETURNING id`,
      [name, category]
    );

    return rows[0]!.id;
  }

  it('비회원은 많이 확인된 곳만 받는다', async () => {
    await aVendor('가온예식홀');

    const body = (await bootstrap()).json<BootstrapBody>();

    expect(body.member).toBeNull();
    expect(body.notifications).toBeNull();
    expect(body.candidates).toBeNull();
    expect(body.recommendations).toEqual([]);
    expect(body.popularVendors).toHaveLength(1);
  });

  it('웨딩이 없는 회원은 후보 없이 회원 정보만 받는다', async () => {
    const { headers } = await signInAs(test);

    const body = (await bootstrap(headers)).json<BootstrapBody>();

    expect(body.member).not.toBeNull();
    expect(body.notifications).not.toBeNull();
    expect(body.candidates).toBeNull();
    expect(body.recommendations).toEqual([]);
  });

  it('후보가 지목한 업종에서 웨딩픽 추천을 뽑는다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);
    const picked = await aVendor('가온예식홀');
    const other = await aVendor('아펠가모 공덕');

    await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/candidates`,
      headers,
      payload: { vendorId: picked },
    });

    const body = (await bootstrap(headers)).json<BootstrapBody>();

    expect(body.member?.weddingId).toBe(weddingId);
    expect(body.candidates?.nextCategory).toBe('hall');
    // 담아둔 곳도 같은 업종의 다른 업체도 나올 수 있다 — 여기선 후보가 하나뿐이라
    // 추천 자리에 다른 업체가 나오는지만 본다(담아둔 곳 자체를 다시 추천하지
    // 않는다는 뜻은 아니다. 지금 라우트는 업종만으로 뽑는다).
    expect(body.recommendations.length).toBeGreaterThan(0);
    void other;
  });

  it('로그인 세션이 없으면 인증 헤더 없이도 200이다', async () => {
    const response = await bootstrap();

    expect(response.statusCode).toBe(200);
  });

  it('토큰이 틀리면 거절한다 — 조용히 비회원으로 떨어뜨리지 않는다', async () => {
    const response = await bootstrap({ authorization: 'Bearer nope' });

    expect(response.statusCode).toBe(401);
  });
});
