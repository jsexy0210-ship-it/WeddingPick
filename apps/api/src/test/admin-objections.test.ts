import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

const BODY =
  '음식이 따뜻하게 나왔고 직원분들이 동선을 잘 안내해 주셨습니다. 주차는 조금 붐비는 편이었습니다.';

/**
 * 후기 이의 처리 HTTP API. `holdReview`/`resolveObjection`의 규칙 자체는
 * `objections.test.ts`가 이미 다 봤다 — 여기서는 관문만 본다.
 * `objection-admin.ts`는 이전엔 `require.main === module` 관문이 없어
 * 가져오기만 해도 CLI가 실행됐다 — 이번에 라우트로 열면서 그 관문을 넣었다.
 */
describeWithDb('후기 이의 처리 API', () => {
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

  async function aReview(): Promise<string> {
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

    return written.json<{ reviewId: string }>().reviewId;
  }

  it('운영자가 아니면 403이다', async () => {
    const session = await signInAs(test, `not-operator-${Math.random()}`);

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/objections',
      headers: session.headers,
    });

    expect(response.statusCode).toBe(403);
  });

  it('운영자는 내려두고, 목록에서 보고, 다시 올릴 수 있다', async () => {
    const operator = await anOperatorSession();
    const reviewId = await aReview();

    const hold = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/objections/${reviewId}/hold`,
      headers: operator.headers,
      payload: { note: '업체가 사실과 다르다고 이의 제기' },
    });

    expect(hold.statusCode).toBe(200);

    const list = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/objections',
      headers: operator.headers,
    });

    expect(list.statusCode).toBe(200);
    expect(
      list.json<{ reviews: { id: string; expired: boolean }[] }>().reviews.map((r) => r.id)
    ).toContain(reviewId);

    const resolve = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/objections/${reviewId}/resolve`,
      headers: operator.headers,
      payload: { to: 'restore', note: '계약 사실 확인됨' },
    });

    expect(resolve.statusCode).toBe(200);

    const after = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/objections',
      headers: operator.headers,
    });

    expect(
      after.json<{ reviews: { id: string }[] }>().reviews.map((r) => r.id)
    ).not.toContain(reviewId);
  });

  it('게시 중이 아닌 후기는 내려둘 수 없다 — 도메인 규칙 위반은 400이다', async () => {
    const operator = await anOperatorSession();
    const reviewId = await aReview();

    await test.app.inject({
      method: 'POST',
      url: `/v1/admin/objections/${reviewId}/hold`,
      headers: operator.headers,
      payload: { note: '이의 제기됨' },
    });

    const again = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/objections/${reviewId}/hold`,
      headers: operator.headers,
      payload: { note: '한 번 더' },
    });

    expect(again.statusCode).toBe(400);
    expect(again.json<{ error: { message: string } }>().error.message).toContain(
      '게시 중인 후기만'
    );
  });
});
