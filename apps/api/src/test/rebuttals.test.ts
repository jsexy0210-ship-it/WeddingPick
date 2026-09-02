import { decideRebuttal } from '../rebuttal-decide';
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

  /**
   * 반론은 후기를 지우지 않고 옆에 붙는다. 붙었다는 사실을 작성자가 모르면,
   * 자기 글 아래에 남의 말이 실린 것을 남이 먼저 안다.
   */
  describe('게시되면 후기 작성자도 안다', () => {
    async function anOperator(): Promise<string> {
      const { rows } = await test.pool.query<{ id: string }>(
        'INSERT INTO structured.users (is_operator) VALUES (true) RETURNING id'
      );
      return rows[0]!.id;
    }

    const notificationsOf = async (userId: string) =>
      (
        await test.pool.query<{ kind: string; title: string; body: string; target_id: string }>(
          `SELECT kind, title, body, target_id FROM structured.notifications
           WHERE user_id = $1 ORDER BY created_at`,
          [userId]
        )
      ).rows;

    async function authorOf(reviewId: string): Promise<string> {
      const { rows } = await test.pool.query<{ author_user_id: string }>(
        'SELECT author_user_id FROM structured.reviews WHERE id = $1',
        [reviewId]
      );
      return rows[0]!.author_user_id;
    }

    it('게시하면 작성자에게 알림이 간다', async () => {
      const { reviewId } = await aReview();
      const vendorSide = await signInAs(test, 'vendor-staff');
      const { rebuttalId } = (await submit(vendorSide.headers, reviewId)).json<{
        rebuttalId: string;
      }>();

      await decideRebuttal(test.pool, {
        id: rebuttalId,
        to: 'published',
        by: await anOperator(),
        note: '사업자등록증으로 소속 확인',
        withoutClaim: true,
      });

      const forAuthor = await notificationsOf(await authorOf(reviewId));

      expect(forAuthor).toHaveLength(1);
      expect(forAuthor[0]!.kind).toBe('rebuttal');
      expect(forAuthor[0]!.target_id).toBe(reviewId);
      // 심사 메모는 심사자가 소속을 무엇으로 확인했는지 적은 내부 기록이다.
      expect(forAuthor[0]!.body).not.toContain('사업자등록증');
    });

    it('게시하지 않기로 하면 작성자에게는 아무것도 가지 않는다', async () => {
      const { reviewId } = await aReview();
      const vendorSide = await signInAs(test, 'vendor-staff');
      const { rebuttalId } = (await submit(vendorSide.headers, reviewId)).json<{
        rebuttalId: string;
      }>();

      await decideRebuttal(test.pool, {
        id: rebuttalId,
        to: 'rejected',
        by: await anOperator(),
        note: '소속을 확인하지 못했다',
      });

      // 작성자에게는 일어나지 않은 일이다.
      expect(await notificationsOf(await authorOf(reviewId))).toHaveLength(0);
      // 낸 사람은 결론을 받는다.
      expect(await notificationsOf(vendorSide.userId)).toHaveLength(1);
    });
  });

  /**
   * 소속을 무엇으로 확인했는지가 **구조로** 남는다. v2.0 26번.
   *
   * 지금까지는 사람이 앱 밖에서 확인하고 `--note`에 적었다. 글로만 남으면 인증으로
   * 확인한 것과 눈으로 확인한 것이 같은 줄로 보이고, 나중에 되짚을 수 없다.
   */
  describe('무엇으로 확인했는지가 남는다', () => {
    async function anOperator(): Promise<string> {
      const { rows } = await test.pool.query<{ id: string }>(
        'INSERT INTO structured.users (is_operator) VALUES (true) RETURNING id'
      );
      return rows[0]!.id;
    }

    async function pending(): Promise<{ rebuttalId: string; vendorId: string; claimant: string }> {
      const { vendorId, reviewId } = await aReview();
      const vendorSide = await signInAs(test, 'vendor-staff');
      const { rebuttalId } = (await submit(vendorSide.headers, reviewId)).json<{
        rebuttalId: string;
      }>();

      return { rebuttalId, vendorId, claimant: vendorSide.userId };
    }

    const decisionOf = async (rebuttalId: string) =>
      (
        await test.pool.query<{ reason_code: string; evidence_refs: { kind: string }[] }>(
          `SELECT reason_code, evidence_refs FROM structured.decisions
           WHERE workflow = 'rebuttal_review' AND subject_id = $1`,
          [rebuttalId]
        )
      ).rows[0]!;

    it('인증도 없고 밝히지도 않으면 싣지 않는다', async () => {
      const { rebuttalId } = await pending();

      await expect(
        decideRebuttal(test.pool, {
          id: rebuttalId,
          to: 'published',
          by: await anOperator(),
          note: '확인함',
        })
      ).rejects.toThrow(/관계자 인증/);
    });

    it('승인된 인증이 있으면 그것을 근거로 가리킨다', async () => {
      const { rebuttalId, vendorId, claimant } = await pending();
      const operator = await anOperator();

      const claim = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.vendor_claims
           (vendor_id, claimant_user_id, claimed_role, method, contact_email,
            status, decided_at, decided_by)
         VALUES ($1, $2, '예약팀장', 'official_domain_email', 'staff@gaon.example',
                 'approved', now(), $3)
         RETURNING id`,
        [vendorId, claimant, operator]
      );

      await decideRebuttal(test.pool, {
        id: rebuttalId,
        to: 'published',
        by: operator,
        note: '공식 도메인 이메일로 확인',
      });

      const decision = await decisionOf(rebuttalId);

      expect(decision.reason_code).toBe('affiliation_verified');
      expect(decision.evidence_refs).toContainEqual({
        kind: 'vendor_claim',
        id: claim.rows[0]!.id,
      });
    });

    it('밖에서 확인했으면 그 길로 갔다는 것이 남는다', async () => {
      // 같은 결론이라도 확인한 방법이 다르다. 같은 줄로 보이면 되짚을 수 없다.
      const { rebuttalId } = await pending();

      await decideRebuttal(test.pool, {
        id: rebuttalId,
        to: 'published',
        by: await anOperator(),
        note: '사업자등록증 원본을 대면 확인',
        withoutClaim: true,
      });

      expect((await decisionOf(rebuttalId)).reason_code).toBe('affiliation_verified_offline');
    });

    it('싣지 않기로 하는 데는 인증이 필요 없다', async () => {
      // 막는 것은 싣는 쪽이다. 거절에 인증을 요구하면 아무것도 정리할 수 없다.
      const { rebuttalId } = await pending();

      await expect(
        decideRebuttal(test.pool, {
          id: rebuttalId,
          to: 'rejected',
          by: await anOperator(),
          note: '반론이 아니라 홍보 글이다',
        })
      ).resolves.toBeUndefined();
    });
  });
});
