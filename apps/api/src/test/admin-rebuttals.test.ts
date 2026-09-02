import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

const BODY =
  '음식이 따뜻하게 나왔고 직원분들이 동선을 잘 안내해 주셨습니다. 주차는 조금 붐비는 편이었습니다.';
const REBUTTAL = '해당 날짜에는 주차 안내 인원을 두 명 더 배치했습니다. 확인해보겠습니다.';

/**
 * 업체 반론 심사 HTTP API. `decideRebuttal`의 규칙 자체는 `rebuttals.test.ts`가
 * 이미 다 봤다 — 여기서는 관문만 본다. `rebuttal-admin.ts`는 이전엔
 * `require.main === module` 관문이 없어 가져오기만 해도 CLI가 실행됐다.
 */
describeWithDb('업체 반론 심사 API', () => {
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

  async function aRebuttal(): Promise<string> {
    const vendor = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ('가온예식홀', 'hall', '서울', 'public_data') RETURNING id`
    );
    const author = await signInAs(test, `author-${Math.random()}`);
    const written = await test.app.inject({
      method: 'POST',
      url: `/v1/vendors/${vendor.rows[0]!.id}/reviews`,
      headers: author.headers,
      payload: {
        role: 'contractor',
        overall: 2,
        title: '주차가 아쉬웠습니다',
        body: BODY,
        aspects: [{ key: 'food_taste', rating: 3 }],
      },
    });
    const reviewId = written.json<{ reviewId: string }>().reviewId;

    const vendorRep = await signInAs(test, `vendor-rep-${Math.random()}`);
    const submitted = await test.app.inject({
      method: 'POST',
      url: '/v1/rebuttals',
      headers: vendorRep.headers,
      payload: { reviewId, claimedRole: '가온예식홀 예약팀장', body: REBUTTAL },
    });

    return submitted.json<{ rebuttalId: string }>().rebuttalId;
  }

  it('운영자가 아니면 403이다', async () => {
    const session = await signInAs(test, `not-operator-${Math.random()}`);

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/rebuttals',
      headers: session.headers,
    });

    expect(response.statusCode).toBe(403);
  });

  it('운영자는 대기 목록을 보고, 상세를 보고, 게시할 수 있다', async () => {
    const operator = await anOperatorSession();
    const rebuttalId = await aRebuttal();

    const list = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/rebuttals',
      headers: operator.headers,
    });

    expect(list.statusCode).toBe(200);
    expect(list.json<{ rebuttals: { id: string }[] }>().rebuttals.map((r) => r.id)).toContain(
      rebuttalId
    );

    const detail = await test.app.inject({
      method: 'GET',
      url: `/v1/admin/rebuttals/${rebuttalId}`,
      headers: operator.headers,
    });

    expect(detail.statusCode).toBe(200);
    expect(detail.json<{ status: string; verifiedRole: string | null }>().status).toBe('pending');

    const publish = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/rebuttals/${rebuttalId}/publish`,
      headers: operator.headers,
      payload: { note: '관계자 인증 없이 확인됨', withoutClaim: true },
    });

    expect(publish.statusCode).toBe(200);

    const after = await test.app.inject({
      method: 'GET',
      url: `/v1/admin/rebuttals/${rebuttalId}`,
      headers: operator.headers,
    });

    expect(after.json<{ status: string }>().status).toBe('published');
  });

  it('없는 반론은 404다', async () => {
    const operator = await anOperatorSession();

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/rebuttals/00000000-0000-4000-8000-000000000000',
      headers: operator.headers,
    });

    expect(response.statusCode).toBe(404);
  });

  it('관계자 인증 없이 게시하려면 withoutClaim이 필요하다 — 400이다', async () => {
    const operator = await anOperatorSession();
    const rebuttalId = await aRebuttal();

    const response = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/rebuttals/${rebuttalId}/publish`,
      headers: operator.headers,
      payload: { note: '확인 없이 게시 시도' },
    });

    expect(response.statusCode).toBe(400);
  });
});
