import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

async function createPlanner(name = '공개플래너') {
  const { rows } = await test.pool.query<{ id: string }>(
    `INSERT INTO structured.planners
       (name, regions, listing_status, listing_source, listed_at)
     VALUES ($1, ARRAY['서울'], 'public', 'public_data', now()) RETURNING id`,
    [name]
  );

  return rows[0]!.id;
}

async function submit(headers: Record<string, string>, payload: Record<string, unknown>) {
  return await test.app.inject({ method: 'POST', url: '/v1/inquiries', headers, payload });
}

describeWithDb('문의 창구', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('로그인하지 않으면 보낼 수 없다', async () => {
    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/inquiries',
      payload: { category: 'other', body: '문의합니다' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('접수만 되고 처리되지 않는다', async () => {
    const { headers } = await signInAs(test);

    const response = await submit(headers, { category: 'other', body: '문의합니다' });

    // 서비스정책서 6번의 증빙 재검토는 사람이 한다. 계약에 'received'밖에 없다.
    expect(response.statusCode).toBe(202);
    expect(response.json().status).toBe('received');
  });

  it('정해지지 않은 기한을 약속하지 않는다', async () => {
    const { headers } = await signInAs(test);

    const body = (await submit(headers, { category: 'other', body: '문의합니다' })).json();

    expect(body.acknowledgement).toContain('아직 정하지 못했어요');
    expect(body.acknowledgement).not.toMatch(/\d+일 안에/);
  });

  it('빈 내용은 받지 않는다', async () => {
    const { headers } = await signInAs(test);

    expect((await submit(headers, { category: 'other', body: '   ' })).statusCode).toBe(400);
  });

  it('노출 중단 요청은 누구를 내릴지 있어야 한다', async () => {
    const { headers } = await signInAs(test);
    const plannerId = await createPlanner();

    expect(
      (await submit(headers, { category: 'planner_delisting', body: '내려주세요' })).statusCode
    ).toBe(400);

    expect(
      (
        await submit(headers, {
          category: 'planner_delisting',
          body: '내려주세요',
          subject: { kind: 'planner', id: plannerId },
        })
      ).statusCode
    ).toBe(202);
  });

  it('노출 중단 요청에 업체를 가리킬 수 없다', async () => {
    const { headers } = await signInAs(test);
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (category, name, region, source)
       VALUES ('hall', '가나홀', '서울 강남구', 'public_data') RETURNING id`
    );

    // DB 제약이 막는다. 플래너를 내리는 요청인데 업체를 가리키면 처리할 수 없다.
    const response = await submit(headers, {
      category: 'planner_delisting',
      body: '내려주세요',
      subject: { kind: 'vendor', id: rows[0]!.id },
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('접수 자체가 이력의 첫 줄로 남는다', async () => {
    const { headers } = await signInAs(test);
    const body = (await submit(headers, { category: 'other', body: '문의합니다' })).json();

    // 서비스정책서 6-5: 처리 이력은 내부 로그로 보관한다.
    const { rows } = await test.pool.query<{ to_status: string; from_status: string | null }>(
      'SELECT from_status, to_status FROM structured.inquiry_events WHERE inquiry_id = $1',
      [body.inquiryId]
    );

    expect(rows).toEqual([{ from_status: null, to_status: 'received' }]);
  });

  it('답할 방법이 없는 문의는 스키마가 막는다', async () => {
    // 로그인 없이 받는 창구가 생겼을 때를 대비한 제약이다.
    await expect(
      test.pool.query(
        `INSERT INTO structured.inquiries (category, body) VALUES ('other', '문의합니다')`
      )
    ).rejects.toThrow(/inquiry_has_reply_route/);
  });

  it('사람 없이 결론이 나지 않는다', async () => {
    const { headers } = await signInAs(test);
    const inquiryId = (await submit(headers, { category: 'other', body: '문의합니다' })).json()
      .inquiryId;

    await expect(
      test.pool.query(
        `UPDATE structured.inquiries SET status = 'answered', decided_at = now(),
                resolution = '처리했습니다' WHERE id = $1`,
        [inquiryId]
      )
    ).rejects.toThrow(/decision_has_reviewer/);
  });

  it('내 문의만 보인다', async () => {
    const me = await signInAs(test, 'me');
    const stranger = await signInAs(test, 'stranger');

    const mine = (await submit(me.headers, { category: 'other', body: '내 문의' })).json();
    await submit(stranger.headers, { category: 'other', body: '남의 문의' });

    const list = await test.app.inject({
      method: 'GET',
      url: '/v1/inquiries',
      headers: me.headers,
    });

    expect(list.json().inquiries.map((i: { body: string }) => i.body)).toEqual(['내 문의']);

    const other = await test.app.inject({
      method: 'GET',
      url: `/v1/inquiries/${mine.inquiryId}`,
      headers: stranger.headers,
    });

    expect(other.statusCode).toBe(403);
  });

  it('결론이 나면 처리 내용이 보낸 사람에게 보인다', async () => {
    const { headers, userId } = await signInAs(test);
    const inquiryId = (await submit(headers, { category: 'other', body: '문의합니다' })).json()
      .inquiryId;

    await test.pool.query(
      `UPDATE structured.inquiries
       SET status = 'answered', decided_at = now(), decided_by = $2, resolution = '고쳤습니다'
       WHERE id = $1`,
      [inquiryId, userId]
    );

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/inquiries/${inquiryId}`,
      headers,
    });

    expect(response.json()).toMatchObject({ status: 'answered', resolution: '고쳤습니다' });
  });
});
