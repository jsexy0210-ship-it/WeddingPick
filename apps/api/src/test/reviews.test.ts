import { MINIMUM_REVIEW_COUNT } from '@weddingpick/domain';

import { createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 후기는 가격 다음으로 조작 압력이 센 자리다. 광고비로 노출은 살 수 있어도 평가는
 * 살 수 없다(서비스정책서 5번). 여기서 지키는 것은 그 경계다.
 */
describeWithDb('이용 후기', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  const BODY = '음식이 따뜻하게 나왔고 직원분들이 동선을 잘 안내해 주셨습니다. 주차는 조금 붐비는 편이었습니다.';

  async function createVendor(category = 'hall') {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ('가온예식홀', $1::vendor_category, '서울', 'public_data') RETURNING id`,
      [category]
    );

    return rows[0]!.id;
  }

  /** 심사를 통과한 계약 문서 하나. 등급은 승인으로만 오른다. */
  async function approvedContract(userId: string, weddingId: string, vendorId: string) {
    const quote = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.quotes
         (wedding_id, doc_type, vendor_id, product_name, product_key, total_amount,
          contract_date, verification_level, source, confirmed_at)
       VALUES ($1, 'contract', $2, '그랜드볼룸', $3, 30000000, '2026-06-01', 'L2',
               'contract_verified', now())
       RETURNING id`,
      [weddingId, vendorId, `${vendorId}:그랜드볼룸`]
    );

    const reviewer = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
    );

    await test.pool.query(
      `INSERT INTO structured.verification_requests
         (quote_id, requested_by, target_level, status, decided_at, decided_by)
       VALUES ($1, $2, 'L2', 'approved', now(), $3)`,
      [quote.rows[0]!.id, userId, reviewer.rows[0]!.id]
    );

    return { quoteId: quote.rows[0]!.id, reviewerId: reviewer.rows[0]!.id };
  }

  async function write(
    headers: Record<string, string>,
    vendorId: string,
    over: Record<string, unknown> = {}
  ) {
    return await test.app.inject({
      method: 'POST',
      url: `/v1/vendors/${vendorId}/reviews`,
      headers,
      payload: {
        role: 'contractor',
        overall: 4,
        title: '식사가 좋았습니다',
        body: BODY,
        aspects: [{ key: 'food_taste', rating: 5 }],
        ...over,
      },
    });
  }

  it('쓰기 전에 무엇을 묻는지와 어디까지 확인되는지 알려준다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createVendor();

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}/review-form`,
      headers,
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<{
      roles: { value: string; label: string; aspects: { key: string; label: string }[] }[];
      verification: { value: string; label: string; note: string };
      alreadyWritten: boolean;
    }>();

    // 하객은 계약 조건도 추가비용도 모른다. 모르는 것을 물으면 짐작이 점수가 된다.
    const guest = body.roles.find((role) => role.value === 'guest')!;
    const contractor = body.roles.find((role) => role.value === 'contractor')!;

    expect(guest.aspects.map((a) => a.key)).toContain('parking');
    expect(guest.aspects.map((a) => a.key)).not.toContain('extra_cost');
    expect(contractor.aspects.map((a) => a.key)).toContain('extra_cost');

    // 화면에 나갈 것은 우리말 이름이지 내부 키가 아니다.
    expect(guest.label).toBe('하객');
    expect(guest.aspects.every((a) => /[가-힣]/.test(a.label))).toBe(true);

    // 다 쓰고 나서 "미인증입니다"라고 하면 그건 통보다.
    expect(body.verification.value).toBe('unverified');
    expect(body.verification.note.length).toBeGreaterThan(0);
    expect(body.alreadyWritten).toBe(false);
  });

  it('작성자가 자기 후기를 계약 확인이라고 말할 수 없다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createVendor();

    // 계약서를 인증한 적이 없는 사람이 계약 확인을 달라고 보낸다.
    const response = await write(headers, vendorId, { verification: 'contract' });

    expect(response.statusCode).toBe(201);
    expect(response.json<{ verification: string }>().verification).toBe('unverified');
  });

  it('인증을 마친 문서가 있으면 증빙을 다시 받지 않는다', async () => {
    const { headers, userId } = await signInAs(test);
    const vendorId = await createVendor();
    const weddingId = await createWedding(test, headers);

    await approvedContract(userId, weddingId, vendorId);

    const response = await write(headers, vendorId);

    expect(response.statusCode).toBe(201);
    expect(response.json<{ verification: string }>().verification).toBe('contract');
    expect(response.json<{ verificationLabel: string }>().verificationLabel).toBe('계약 확인');
  });

  it('심사자 없이 오른 등급으로는 확인해 주지 않는다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createVendor();
    const weddingId = await createWedding(test, headers);

    // 승인 기록 없이 등급만 올라간 문서. 지금 코드에는 그런 길이 없지만, 생기더라도
    // 그 길이 조용히 "확인된 후기"를 찍어내지 못해야 한다.
    await test.pool.query(
      `INSERT INTO structured.quotes
         (wedding_id, doc_type, vendor_id, product_name, product_key, total_amount,
          contract_date, verification_level, source)
       VALUES ($1, 'contract', $2, '그랜드볼룸', $3, 30000000, '2026-06-01', 'L3',
               'contract_verified')`,
      [weddingId, vendorId, `${vendorId}:그랜드볼룸`]
    );

    const response = await write(headers, vendorId);

    expect(response.json<{ verification: string }>().verification).toBe('unverified');
  });

  it('묻지 않은 항목은 받지 않는다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createVendor();

    const response = await write(headers, vendorId, {
      role: 'guest',
      aspects: [{ key: 'extra_cost', rating: 1 }],
    });

    expect(response.statusCode).toBe(400);
  });

  it('업종에 없는 항목도 받지 않는다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createVendor('sdm');

    // 'parking'은 웨딩홀 항목이다. 스튜디오에는 없다.
    const response = await write(headers, vendorId, {
      aspects: [{ key: 'parking', rating: 5 }],
    });

    expect(response.statusCode).toBe(400);
  });

  it('한 줄짜리는 받지 않는다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createVendor();

    const response = await write(headers, vendorId, { body: '좋았어요' });

    expect(response.statusCode).toBe(400);
  });

  it('한 사람이 한 업체에 하나', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createVendor();

    expect((await write(headers, vendorId)).statusCode).toBe(201);

    const second = await write(headers, vendorId);

    expect(second.statusCode).toBe(409);
  });

  it('미인증 후기는 보이되 이용점수를 움직이지 않는다', async () => {
    const vendorId = await createVendor();

    // 확인 기준을 넘길 만큼 미인증 후기를 쌓는다.
    for (let index = 0; index < MINIMUM_REVIEW_COUNT + 2; index += 1) {
      const { headers } = await signInAs(test, `apple-user-${index}`);
      const response = await write(headers, vendorId, { overall: 5 });

      expect(response.statusCode).toBe(201);
    }

    const { headers } = await signInAs(test, 'apple-reader');
    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}/reviews`,
      headers,
    });

    const body = response.json<{
      reviews: unknown[];
      usageScore: { available: boolean; reason?: string };
      caveat: string;
    }>();

    // 글은 다 보인다.
    expect(body.reviews).toHaveLength(MINIMUM_REVIEW_COUNT + 2);
    // 점수는 만들어지지 않는다. 누구나 쓸 수 있는 글이 점수를 움직이면 그 점수는
    // 사고팔 수 있는 것이 된다.
    expect(body.usageScore.available).toBe(false);
    expect(body.caveat.length).toBeGreaterThan(0);

    const detail = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}`,
      headers,
    });

    expect(detail.json<{ usageScore: { available: boolean } }>().usageScore.available).toBe(false);
  });

  it('확인된 후기가 기준만큼 모이면 점수가 생긴다', async () => {
    const vendorId = await createVendor();

    for (let index = 0; index < MINIMUM_REVIEW_COUNT; index += 1) {
      const { headers, userId } = await signInAs(test, `apple-user-${index}`);
      const weddingId = await createWedding(test, headers);

      await approvedContract(userId, weddingId, vendorId);

      const response = await write(headers, vendorId, {
        overall: 4,
        aspects: [
          { key: 'food_taste', rating: 5 },
          { key: 'parking', rating: 2 },
        ],
      });

      expect(response.json<{ verification: string }>().verification).toBe('contract');
    }

    const { headers } = await signInAs(test, 'apple-reader');
    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}/reviews`,
      headers,
    });

    const score = response.json<{
      usageScore: {
        available: true;
        average: number;
        count: number;
        aspects: { key: string; label: string; average: number }[];
      };
    }>().usageScore;

    expect(score.available).toBe(true);
    expect(score.count).toBe(MINIMUM_REVIEW_COUNT);
    expect(score.average).toBe(4);

    // "별점 다섯 개"만 남기지 않는다. 무엇이 좋았고 나빴는지가 사라진다.
    const parking = score.aspects.find((aspect) => aspect.key === 'parking')!;

    expect(parking.label).toBe('주차');
    expect(parking.average).toBe(2);
  });

  it('이의 확인 중인 글은 보이지 않는다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createVendor();
    const created = await write(headers, vendorId);
    const reviewId = created.json<{ reviewId: string }>().reviewId;

    await test.pool.query(
      `UPDATE structured.reviews
       SET status = 'under_objection', objection_hold_until = now() + interval '30 days'
       WHERE id = $1`,
      [reviewId]
    );

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}/reviews`,
      headers,
    });

    expect(response.json<{ reviews: unknown[] }>().reviews).toHaveLength(0);
  });

  it('임시조치는 30일을 넘길 수 없다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createVendor();
    const reviewId = (await write(headers, vendorId)).json<{ reviewId: string }>().reviewId;

    // 정보통신망법 제44조의2가 정한 상한. 길게 잡으면 이의 제기가 곧 삭제가 된다.
    await expect(
      test.pool.query(
        `UPDATE structured.reviews
         SET status = 'under_objection', objection_hold_until = now() + interval '31 days'
         WHERE id = $1`,
        [reviewId]
      )
    ).rejects.toThrow(/44조의2/);
  });

  it('신고만으로 글이 내려가지 않는다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createVendor();
    const reviewId = (await write(headers, vendorId)).json<{ reviewId: string }>().reviewId;

    const reporter = await signInAs(test, 'apple-reporter');
    const response = await test.app.inject({
      method: 'POST',
      url: `/v1/reviews/${reviewId}/reports`,
      headers: reporter.headers,
      payload: { reason: 'false_content', note: '가보지 않은 곳입니다' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json<{ status: string }>().status).toBe('received');

    // 접수됐을 뿐이다. 결론에는 사람이 남는다.
    const stored = await test.pool.query<{ decided_at: Date | null }>(
      'SELECT decided_at FROM structured.review_reports WHERE review_id = $1',
      [reviewId]
    );

    expect(stored.rows[0]!.decided_at).toBeNull();

    const list = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}/reviews`,
      headers,
    });

    expect(list.json<{ reviews: unknown[] }>().reviews).toHaveLength(1);
  });

  it('작성자를 밝히지 않는다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createVendor();

    await write(headers, vendorId);

    const other = await signInAs(test, 'apple-other');
    const asOther = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}/reviews`,
      headers: other.headers,
    });

    const [review] = asOther.json<{ reviews: Record<string, unknown>[] }>().reviews;

    expect(review).toBeDefined();
    expect(Object.keys(review!)).not.toContain('authorUserId');
    // 내가 쓴 글인지만 알 수 있다. 고치거나 지우려면 그것이 필요하다.
    expect(review!.mine).toBe(false);

    const asAuthor = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}/reviews`,
      headers,
    });

    expect(asAuthor.json<{ reviews: { mine: boolean }[] }>().reviews[0]!.mine).toBe(true);
  });

  it('없는 업체에는 쓸 수 없다', async () => {
    const { headers } = await signInAs(test);

    const response = await write(headers, '00000000-0000-0000-0000-000000000000');

    expect(response.statusCode).toBe(404);
  });
});

/**
 * 결정사 업체평가 — 체크리스트.
 *
 * 디자인 핸드오프 8번. 별점을 걷어내지 않고 업종으로 갈랐다 — 체크리스트 항목은
 * 결정사 계약에만 있는 것이라 웨딩홀 음식에는 쓸 수 없다.
 */
describeWithDb('결정사 체크리스트', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  const BODY =
    '가입 전에 들은 조건과 계약서가 같았고, 약정한 소개 횟수도 채워주셨습니다. 담당자 변경도 빨랐습니다.';

  /** 심사를 통과한 계약 문서 하나. 확인된 후기라야 점수에 들어간다. */
  async function approvedContract(userId: string, weddingId: string, vendorId: string) {
    const quote = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.quotes
         (wedding_id, doc_type, vendor_id, product_name, product_key, total_amount,
          contract_date, verification_level, source, confirmed_at)
       VALUES ($1, 'contract', $2, '노블레스', $3, 3000000, '2026-06-01', 'L2',
               'contract_verified', now())
       RETURNING id`,
      [weddingId, vendorId, `${vendorId}:${userId}`]
    );

    const reviewer = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
    );

    await test.pool.query(
      `INSERT INTO structured.verification_requests
         (quote_id, requested_by, target_level, status, decided_at, decided_by)
       VALUES ($1, $2, 'L2', 'approved', now(), $3)`,
      [quote.rows[0]!.id, userId, reviewer.rows[0]!.id]
    );
  }

  async function createAgency() {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ('가온결혼정보', 'wedding_info_company', '서울', 'public_data') RETURNING id`
    );

    return rows[0]!.id;
  }

  async function writeChecklist(
    headers: Record<string, string>,
    vendorId: string,
    over: Record<string, unknown> = {}
  ) {
    return await test.app.inject({
      method: 'POST',
      url: `/v1/vendors/${vendorId}/reviews`,
      headers,
      payload: {
        role: 'contractor',
        overall: 4,
        title: '설명대로였습니다',
        body: BODY,
        checklist: [
          { key: 'price_explained', answer: 'yes' },
          { key: 'pushed_too_hard', answer: 'no' },
          { key: 'operating_normally', answer: 'unknown' },
        ],
        ...over,
      },
    });
  }

  it('결정사에는 체크리스트를 묻는다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createAgency();

    const form = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}/review-form`,
      headers,
    });

    const body = form.json<{
      evaluationMode: string;
      checklist: { key: string; question: string }[];
      roles: { aspects: unknown[] }[];
    }>();

    expect(body.evaluationMode).toBe('checklist');
    expect(body.checklist.length).toBeGreaterThan(0);
    // 실제로 묻는 문장이 온다. 막대 이름만으로는 무엇을 묻는지 모른다.
    expect(body.checklist[0]!.question).toContain('?');
    // 별점 항목은 비어 있다.
    expect(body.roles.every((role) => role.aspects.length === 0)).toBe(true);
  });

  it('웨딩홀에는 여전히 별점을 묻는다', async () => {
    const { headers } = await signInAs(test);
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ('가온예식홀', 'hall', '서울', 'public_data') RETURNING id`
    );

    const form = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${rows[0]!.id}/review-form`,
      headers,
    });

    const body = form.json<{ evaluationMode: string; checklist: unknown[] }>();

    expect(body.evaluationMode).toBe('rating');
    expect(body.checklist).toEqual([]);
  });

  it('모름도 저장한다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createAgency();

    expect((await writeChecklist(headers, vendorId)).statusCode).toBe(201);

    // 답하지 않은 것과 모른다고 답한 것은 다르다.
    const stored = await test.pool.query<{ answer: string }>(
      `SELECT answer FROM structured.review_checklist_answers WHERE item = 'operating_normally'`
    );

    expect(stored.rows[0]!.answer).toBe('unknown');
  });

  it('업종에 맞지 않는 방식은 받지 않는다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createAgency();

    const response = await writeChecklist(headers, vendorId, {
      checklist: [],
      aspects: [{ key: 'food_taste', rating: 5 }],
    });

    expect(response.statusCode).toBe(400);
  });

  it('한 후기에 두 방식을 섞을 수 없다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createAgency();
    const created = await writeChecklist(headers, vendorId);
    const reviewId = created.json<{ reviewId: string }>().reviewId;

    /*
     * 라우트가 막지만 스키마도 막는다. 섞이면 업체평가에 별점 막대와 비율 막대가
     * 나란히 서고, 읽는 사람은 두 숫자가 같은 것을 재는 줄 안다.
     */
    await expect(
      test.pool.query(
        'INSERT INTO structured.review_aspects (review_id, aspect, rating) VALUES ($1, $2, $3)',
        [reviewId, 'food_taste', 5]
      )
    ).rejects.toThrow(/함께 쓸 수 없다/);
  });

  it('표본이 모이면 항목별 환산값을 준다', async () => {
    const vendorId = await createAgency();

    // 이용점수 자체의 표본 기준과 항목별 기준을 둘 다 넘긴다.
    for (let index = 0; index < 5; index += 1) {
      const { headers, userId } = await signInAs(test, `apple-user-${index}`);
      const weddingId = await createWedding(test, headers);

      await approvedContract(userId, weddingId, vendorId);
      await writeChecklist(headers, vendorId, {
        checklist: [
          { key: 'price_explained', answer: index === 0 ? 'no' : 'yes' },
          { key: 'pushed_too_hard', answer: 'no' },
        ],
      });
    }

    const { headers } = await signInAs(test, 'apple-reader');
    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}/reviews`,
      headers,
    });

    const score = response.json<{
      usageScore: {
        available: true;
        aspects: unknown[];
        checklist: { key: string; percent: number; collecting: boolean }[];
        caption: string;
      };
    }>().usageScore;

    expect(score.available).toBe(true);
    // 별점 배열은 비어 있다. 4.2점과 78%는 다른 것을 잰다.
    expect(score.aspects).toEqual([]);

    const price = score.checklist.find((item) => item.key === 'price_explained')!;

    expect(price.collecting).toBe(false);
    expect(price.percent).toBe(80);

    // '예'가 나쁜 답인 항목은 뒤집어 센다.
    const pushed = score.checklist.find((item) => item.key === 'pushed_too_hard')!;

    expect(pushed.percent).toBe(100);
    expect(score.caption).toContain('별점이 아니라');
  });
});
