import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

const BODY = '음식이 따뜻하게 나왔고 직원분들이 동선을 잘 안내해 주셨습니다. 주차는 조금 붐비는 편이었습니다.';
const REBUTTAL = '해당 날짜에는 주차 안내 인원을 두 명 더 배치했습니다. 확인해보겠습니다.';

/**
 * 업체 반론.
 *
 * 후기를 가리는 임시조치와 **다른 길이다** — 가리는 대신 옆에 말을 더한다.
 * 대신 사람이 확인하기 전에는 붙지 않는다: 업체라고 말하기만 하면 누구나 남의
 * 후기 아래에 글을 실을 수 있게 되면 안 된다.
 */
describeWithDb('업체 반론', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function aReview() {
    const vendor = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ('가온예식홀', 'hall', '서울', 'public_data') RETURNING id`
    );
    const author = await signInAs(test, 'review-author');

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

    expect(written.statusCode).toBe(201);

    return {
      vendorId: vendor.rows[0]!.id,
      reviewId: written.json<{ reviewId: string }>().reviewId,
    };
  }

  const submit = (
    headers: Record<string, string>,
    reviewId: string,
    over: Record<string, unknown> = {}
  ) =>
    test.app.inject({
      method: 'POST',
      url: '/v1/rebuttals',
      headers,
      payload: {
        reviewId,
        claimedRole: '가온예식홀 예약팀장',
        body: REBUTTAL,
        ...over,
      },
    });

  async function publish(rebuttalId: string) {
    const operator = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users (is_operator) VALUES (true) RETURNING id'
    );

    await test.pool.query(
      `UPDATE structured.review_rebuttals
       SET status = 'published', decided_at = now(), decided_by = $2,
           decision_note = '사업자등록증으로 소속 확인'
       WHERE id = $1`,
      [rebuttalId, operator.rows[0]!.id]
    );
  }

  const listReviews = (vendorId: string) =>
    test.app.inject({ method: 'GET', url: `/v1/vendors/${vendorId}/reviews` });

  it('넣어도 바로 붙지 않는다', async () => {
    /*
     * 이 경로에는 status를 정할 자리가 없다. 넣으면 확인 중으로 들어가고, 사람이
     * 결정해야 후기 옆에 붙는다.
     */
    const { vendorId, reviewId } = await aReview();
    const vendorSide = await signInAs(test, 'vendor-staff');

    const response = await submit(vendorSide.headers, reviewId);

    expect(response.statusCode).toBe(201);

    const reviews = listReviews(vendorId);
    expect((await reviews).json<{ reviews: { rebuttal: unknown }[] }>().reviews[0]!.rebuttal)
      .toBeNull();
  });

  it('사람이 게시하기로 하면 후기 옆에 붙는다', async () => {
    const { vendorId, reviewId } = await aReview();
    const vendorSide = await signInAs(test, 'vendor-staff');

    const { rebuttalId } = (await submit(vendorSide.headers, reviewId)).json<{
      rebuttalId: string;
    }>();

    await publish(rebuttalId);

    const reviews = (await listReviews(vendorId)).json<{
      reviews: { rebuttal: { claimedRole: string; body: string } | null }[];
    }>();

    expect(reviews.reviews[0]!.rebuttal).toEqual({
      claimedRole: '가온예식홀 예약팀장',
      body: REBUTTAL,
      publishedAt: expect.any(String),
    });
  });

  it('게시하지 않기로 한 반론은 붙지 않는다', async () => {
    const { vendorId, reviewId } = await aReview();
    const vendorSide = await signInAs(test, 'vendor-staff');
    const { rebuttalId } = (await submit(vendorSide.headers, reviewId)).json<{
      rebuttalId: string;
    }>();

    const operator = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users (is_operator) VALUES (true) RETURNING id'
    );
    await test.pool.query(
      `UPDATE structured.review_rebuttals
       SET status = 'rejected', decided_at = now(), decided_by = $2, decision_note = '소속 확인 불가'
       WHERE id = $1`,
      [rebuttalId, operator.rows[0]!.id]
    );

    const reviews = (await listReviews(vendorId)).json<{ reviews: { rebuttal: unknown }[] }>();

    expect(reviews.reviews[0]!.rebuttal).toBeNull();
  });

  it('소속을 밝히지 않으면 받지 않는다', async () => {
    // 누가 하는 말인지 모르는 반론은 또 하나의 익명 글일 뿐이다.
    const { reviewId } = await aReview();
    const vendorSide = await signInAs(test, 'vendor-staff');

    const response = await submit(vendorSide.headers, reviewId, { claimedRole: '   ' });

    expect(response.statusCode).toBe(400);
  });

  it('한 줄짜리 반박은 받지 않는다', async () => {
    const { reviewId } = await aReview();
    const vendorSide = await signInAs(test, 'vendor-staff');

    const response = await submit(vendorSide.headers, reviewId, { body: '사실이 아닙니다' });

    expect(response.statusCode).toBe(400);
  });

  it('후기 하나에 반론 하나다', async () => {
    const { reviewId } = await aReview();
    const first = await signInAs(test, 'vendor-staff');
    const second = await signInAs(test, 'another-staff');

    expect((await submit(first.headers, reviewId)).statusCode).toBe(201);

    const again = await submit(second.headers, reviewId);

    expect(again.statusCode).toBe(409);
  });

  it('없는 후기에는 붙일 수 없다', async () => {
    const vendorSide = await signInAs(test, 'vendor-staff');

    const response = await submit(vendorSide.headers, '00000000-0000-4000-8000-000000000000');

    expect(response.statusCode).toBe(404);
  });

  it('확인 중인 것만 고칠 수 있다', async () => {
    /*
     * 게시된 글을 고칠 수 있게 두면, 확인받은 글과 실제로 붙어 있는 글이 달라진다.
     */
    const { reviewId } = await aReview();
    const vendorSide = await signInAs(test, 'vendor-staff');
    const { rebuttalId } = (await submit(vendorSide.headers, reviewId)).json<{
      rebuttalId: string;
    }>();

    const edit = (id: string) =>
      test.app.inject({
        method: 'PUT',
        url: `/v1/rebuttals/${id}`,
        headers: vendorSide.headers,
        payload: { claimedRole: '가온예식홀 지배인', body: `${REBUTTAL} 다시 확인했습니다.` },
      });

    expect((await edit(rebuttalId)).statusCode).toBe(204);

    await publish(rebuttalId);

    expect((await edit(rebuttalId)).statusCode).toBe(409);
  });

  it('남의 반론은 고칠 수도 지울 수도 없다', async () => {
    const { reviewId } = await aReview();
    const vendorSide = await signInAs(test, 'vendor-staff');
    const { rebuttalId } = (await submit(vendorSide.headers, reviewId)).json<{
      rebuttalId: string;
    }>();

    const stranger = await signInAs(test, 'stranger');

    const edited = await test.app.inject({
      method: 'PUT',
      url: `/v1/rebuttals/${rebuttalId}`,
      headers: stranger.headers,
      payload: { claimedRole: '아무개', body: `${REBUTTAL} 제가 고칩니다.` },
    });
    const removed = await test.app.inject({
      method: 'DELETE',
      url: `/v1/rebuttals/${rebuttalId}`,
      headers: stranger.headers,
    });

    expect(edited.statusCode).toBe(404);
    expect(removed.statusCode).toBe(404);
  });

  it('게시된 뒤에도 자기 말은 거둘 수 있다', async () => {
    const { vendorId, reviewId } = await aReview();
    const vendorSide = await signInAs(test, 'vendor-staff');
    const { rebuttalId } = (await submit(vendorSide.headers, reviewId)).json<{
      rebuttalId: string;
    }>();

    await publish(rebuttalId);

    const removed = await test.app.inject({
      method: 'DELETE',
      url: `/v1/rebuttals/${rebuttalId}`,
      headers: vendorSide.headers,
    });

    expect(removed.statusCode).toBe(204);
    expect(
      (await listReviews(vendorId)).json<{ reviews: { rebuttal: unknown }[] }>().reviews[0]!
        .rebuttal
    ).toBeNull();
  });

  it('내가 낸 반론은 원본 후기와 함께 온다', async () => {
    // 반론만 세우면 무엇에 대한 답인지 알 수 없다.
    const { reviewId } = await aReview();
    const vendorSide = await signInAs(test, 'vendor-staff');
    await submit(vendorSide.headers, reviewId);

    const mine = (
      await test.app.inject({ method: 'GET', url: '/v1/me/rebuttals', headers: vendorSide.headers })
    ).json<{
      rebuttals: {
        statusLabel: string;
        statusNote: string;
        review: { id: string; vendorName: string; title: string };
      }[];
    }>();

    expect(mine.rebuttals).toHaveLength(1);
    expect(mine.rebuttals[0]!.statusLabel).toBe('확인 중');
    expect(mine.rebuttals[0]!.review.id).toBe(reviewId);
    expect(mine.rebuttals[0]!.review.vendorName).toBe('가온예식홀');
  });

  it('로그인해야 낼 수 있다', async () => {
    const { reviewId } = await aReview();

    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/rebuttals',
      payload: { reviewId, claimedRole: '가온예식홀 예약팀장', body: REBUTTAL },
    });

    expect(response.statusCode).toBe(401);
  });
});
