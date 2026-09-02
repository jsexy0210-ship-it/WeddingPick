import { ObjectionRefused, holdReview, resolveObjection } from '../objection-decide';
import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

const BODY =
  '음식이 따뜻하게 나왔고 직원분들이 동선을 잘 안내해 주셨습니다. 주차는 조금 붐비는 편이었습니다.';

/**
 * 후기 이의 처리. 서비스정책서 6번 · 정보통신망법 제44조의2.
 *
 * **내려두는 것과 지우는 것은 다르다.** 확인 결과 문제가 없으면 다시 올라간다.
 * 그리고 **기간이 지나면 사람의 손을 기다리지 않고 다시 보인다** — 기한 없는
 * 임시조치는 반론권이 아니라 검열이다.
 */
describeWithDb('후기 이의 처리', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function anOperator(): Promise<string> {
    const { rows } = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users (is_operator) VALUES (true) RETURNING id'
    );

    return rows[0]!.id;
  }

  async function aReview(): Promise<{ reviewId: string; vendorId: string; authorId: string }> {
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

    return {
      reviewId: written.json<{ reviewId: string }>().reviewId,
      vendorId: vendor.rows[0]!.id,
      authorId: author.userId,
    };
  }

  const isVisible = async (reviewId: string) =>
    (await test.pool.query('SELECT 1 FROM structured.visible_reviews WHERE id = $1', [reviewId]))
      .rowCount === 1;

  const notificationsOf = async (userId: string) =>
    (
      await test.pool.query<{ title: string; body: string }>(
        'SELECT title, body FROM structured.notifications WHERE user_id = $1 ORDER BY created_at',
        [userId]
      )
    ).rows;

  it('이의가 들어오면 확인하는 동안 내려둔다', async () => {
    const { reviewId, authorId } = await aReview();

    expect(await isVisible(reviewId)).toBe(true);

    await holdReview(test.pool, {
      reviewId,
      by: await anOperator(),
      note: '업체가 사실과 다르다고 이의 제기',
    });

    expect(await isVisible(reviewId)).toBe(false);

    // 내 글이 안 보이는데 이유를 모르는 상태를 만들지 않는다.
    const notices = await notificationsOf(authorId);

    expect(notices).toHaveLength(1);
    expect(notices[0]!.title).toBe('내 후기가 확인 중이에요');
    // 이의를 낸 쪽의 주장을 우리가 옮기지 않는다.
    expect(notices[0]!.body).not.toContain('사실과 다르다');
  });

  it('기간이 지나면 사람의 손을 기다리지 않고 다시 보인다', async () => {
    /*
     * 0020은 30일 상한을 트리거로 지켰지만, 그 트리거가 막는 것은 더 긴 기간을 적어
     * 넣는 일뿐이었다. 아무도 손대지 않으면 영영 내려가 있었다.
     */
    const { reviewId } = await aReview();

    await holdReview(test.pool, { reviewId, by: await anOperator(), note: '확인 중' });

    expect(await isVisible(reviewId)).toBe(false);

    await test.pool.query(
      `UPDATE structured.reviews SET objection_hold_until = now() - interval '1 minute'
       WHERE id = $1`,
      [reviewId]
    );

    expect(await isVisible(reviewId)).toBe(true);
    // 저장된 상태는 사람이 정한 그대로다. 보이는지는 다른 질문이다.
    const { rows } = await test.pool.query<{ status: string }>(
      'SELECT status FROM structured.reviews WHERE id = $1',
      [reviewId]
    );

    expect(rows[0]!.status).toBe('under_objection');
  });

  it('기간이 지난 것도 점수에 다시 들어간다', async () => {
    // 보이는 후기와 점수에 들어가는 후기가 같은 계산을 쓴다.
    const { reviewId } = await aReview();

    // 확인 배지는 근거를 가리켜야 한다(0029). 심사자와 견적이 함께 있어야 붙는다.
    const operator = await anOperator();
    const wedding = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.weddings (owner_user_id) VALUES ($1) RETURNING id',
      [operator]
    );
    const quote = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.quotes (wedding_id, source, total_amount)
       VALUES ($1, 'user_quote', 32800000) RETURNING id`,
      [wedding.rows[0]!.id]
    );

    await test.pool.query(
      `UPDATE structured.reviews SET verification = 'contract', verified_at = now(),
              verified_by = $2, verified_quote_id = $3 WHERE id = $1`,
      [reviewId, operator, quote.rows[0]!.id]
    );
    await holdReview(test.pool, { reviewId, by: operator, note: '확인 중' });

    const scored = async () =>
      (await test.pool.query('SELECT 1 FROM structured.scored_reviews WHERE id = $1', [reviewId]))
        .rowCount;

    expect(await scored()).toBe(0);

    await test.pool.query(
      `UPDATE structured.reviews SET objection_hold_until = now() - interval '1 minute'
       WHERE id = $1`,
      [reviewId]
    );

    expect(await scored()).toBe(1);
  });

  it('확인 결과 문제가 없으면 다시 올린다', async () => {
    const { reviewId, authorId } = await aReview();
    const operator = await anOperator();

    await holdReview(test.pool, { reviewId, by: operator, note: '확인 중' });
    await resolveObjection(test.pool, {
      reviewId,
      to: 'restore',
      by: operator,
      note: '계약 사실 확인됨',
    });

    expect(await isVisible(reviewId)).toBe(true);
    expect((await notificationsOf(authorId))[1]!.title).toBe('내 후기가 다시 보여요');

    const { rows } = await test.pool.query<{ status: string; hold: Date | null }>(
      'SELECT status, objection_hold_until AS hold FROM structured.reviews WHERE id = $1',
      [reviewId]
    );

    expect(rows[0]).toEqual({ status: 'published', hold: null });
  });

  it('내리면 다시 보이지 않는다', async () => {
    const { reviewId, authorId } = await aReview();
    const operator = await anOperator();

    await holdReview(test.pool, { reviewId, by: operator, note: '확인 중' });
    await resolveObjection(test.pool, {
      reviewId,
      to: 'remove',
      by: operator,
      note: '허위 사실로 확인됨',
    });

    expect(await isVisible(reviewId)).toBe(false);
    expect((await notificationsOf(authorId))[1]!.title).toBe('내 후기를 내렸어요');
    // 사유를 그대로 보내지 않는다. 문의 창구로 안내한다.
    expect((await notificationsOf(authorId))[1]!.body).not.toContain('허위');
  });

  it('결론에는 사람과 이유가 남는다', async () => {
    const { reviewId } = await aReview();
    const operator = await anOperator();

    await holdReview(test.pool, { reviewId, by: operator, note: '확인 중' });
    await resolveObjection(test.pool, {
      reviewId,
      to: 'restore',
      by: operator,
      note: '계약 사실 확인됨',
    });

    const { rows } = await test.pool.query<{ step: string; decision: string; actor: string }>(
      `SELECT step, decision, actor_user_id AS actor FROM structured.decisions
       WHERE workflow = 'review_objection' AND subject_id = $1 ORDER BY created_at`,
      [reviewId]
    );

    expect(rows).toEqual([
      { step: 'hold', decision: 'under_objection', actor: operator },
      { step: 'resolve', decision: 'published', actor: operator },
    ]);
  });

  it('30일을 넘겨 내려둘 수 없다', async () => {
    // 상한은 우리가 정한 값이 아니라 법이 정한 값이다.
    const { reviewId } = await aReview();

    await expect(
      holdReview(test.pool, { reviewId, by: await anOperator(), note: '확인 중', days: 31 })
    ).rejects.toThrow(ObjectionRefused);
  });

  it('게시 중인 후기만 내려둘 수 있고, 확인 중인 것만 결론 낼 수 있다', async () => {
    const { reviewId } = await aReview();
    const operator = await anOperator();

    await expect(
      resolveObjection(test.pool, { reviewId, to: 'restore', by: operator, note: '없는 이의' })
    ).rejects.toThrow(ObjectionRefused);

    await holdReview(test.pool, { reviewId, by: operator, note: '확인 중' });

    await expect(
      holdReview(test.pool, { reviewId, by: operator, note: '또 내려두기' })
    ).rejects.toThrow(ObjectionRefused);
  });
});
