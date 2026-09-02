import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 문의 처리 HTTP API. `inquiry-admin.ts`의 `moveStatus`는 여기서 처음으로
 * 라우트를 통해 검증한다 — 접수만 있고 처리 방법이 없으면 창구가 아니라
 * 우편함이다(서비스정책서 6번).
 */
describeWithDb('문의 처리 API', () => {
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

  async function anInquiry(): Promise<string> {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.inquiries (category, body, contact)
       VALUES ('other', '문의합니다', 'me@example.com') RETURNING id`
    );

    return rows[0]!.id;
  }

  it('운영자가 아니면 403이다', async () => {
    const session = await signInAs(test, `not-operator-${Math.random()}`);

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/inquiries',
      headers: session.headers,
    });

    expect(response.statusCode).toBe(403);
  });

  it('운영자는 대기 목록을 보고, 상세를 보고, 심사시작·답변할 수 있다', async () => {
    const operator = await anOperatorSession();
    const inquiryId = await anInquiry();

    const list = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/inquiries',
      headers: operator.headers,
    });

    expect(list.statusCode).toBe(200);
    expect(list.json<{ pending: { id: string }[] }>().pending.map((r) => r.id)).toContain(
      inquiryId
    );

    const review = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/inquiries/${inquiryId}/review`,
      headers: operator.headers,
    });

    expect(review.statusCode).toBe(200);

    const answer = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/inquiries/${inquiryId}/answer`,
      headers: operator.headers,
      payload: { resolution: '확인 후 처리했다.' },
    });

    expect(answer.statusCode).toBe(200);

    const detail = await test.app.inject({
      method: 'GET',
      url: `/v1/admin/inquiries/${inquiryId}`,
      headers: operator.headers,
    });

    const body = detail.json<{ status: string; resolution: string; events: unknown[] }>();
    expect(body.status).toBe('answered');
    expect(body.resolution).toBe('확인 후 처리했다.');
    // 접수 자체도 이력 한 줄로 남는다(트리거) — review·answer 두 번을 더해 셋.
    expect(body.events).toHaveLength(3);
  });

  it('없는 문의는 404다', async () => {
    const operator = await anOperatorSession();

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/inquiries/00000000-0000-4000-8000-000000000000',
      headers: operator.headers,
    });

    expect(response.statusCode).toBe(404);
  });

  it('플래너를 가리키지 않는 문의는 노출 중단을 걸 수 없다 — 400이다', async () => {
    const operator = await anOperatorSession();
    const inquiryId = await anInquiry();

    const response = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/inquiries/${inquiryId}/answer`,
      headers: operator.headers,
      payload: { resolution: '내렸다', withdrawPlanner: true },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { message: string } }>().error.message).toContain(
      '플래너를 가리키지 않는'
    );
  });
});
