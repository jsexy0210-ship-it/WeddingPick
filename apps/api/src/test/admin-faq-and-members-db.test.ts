import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * FAQ 관리와 회원 추이.
 *
 * **여기서 보는 것은 「200이 오는가」가 아니다.** FAQ 라우트 다섯은 전부터 등록돼
 * 있었고 전부 성공을 돌려줬다 — GET은 빈 배열, POST는 임의 id, 나머지는 204.
 * 저장 단추가 눌리고 아무것도 남지 않았다. 그래서 **화면이 부르는 그대로 불렀을 때
 * 다음 조회에 그것이 보이는가**를 본다.
 */
describeWithDb('관리자 — FAQ · 회원 추이', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function operator(subject = `operator-${Math.random()}`) {
    const session = await signInAs(test, subject);
    await test.pool.query('UPDATE structured.users SET is_operator = true WHERE id = $1', [
      session.userId,
    ]);
    return session;
  }

  type FaqItem = {
    id: string;
    category: string;
    question: string;
    answer: string;
    order: number;
    published: boolean;
    editable?: boolean;
  };

  const list = async (headers: Record<string, string>) => {
    const response = await test.app.inject({ method: 'GET', url: '/v1/admin/faq', headers });

    expect(response.statusCode).toBe(200);

    return (response.json() as { items: FaqItem[] }).items;
  };

  it('등록 · 수정 · 삭제가 다음 조회에 그대로 보인다', async () => {
    const { headers } = await operator();

    const created = await test.app.inject({
      method: 'POST',
      url: '/v1/admin/faq',
      headers,
      payload: {
        category: '이용 안내',
        question: 'Pick 인증은 무엇인가요',
        answer: '금액을 알려주시면 구간을 보여드려요.',
        order: 2,
        published: true,
      },
    });

    expect(created.statusCode).toBe(200);

    const id = (created.json() as { id: string }).id;
    const afterCreate = (await list(headers)).find((item) => item.id === id);

    expect(afterCreate).toMatchObject({
      category: '이용 안내',
      question: 'Pick 인증은 무엇인가요',
      order: 2,
      published: true,
      editable: true,
    });

    const updated = await test.app.inject({
      method: 'PUT',
      url: `/v1/admin/faq/${id}`,
      headers,
      payload: {
        category: '이용 안내',
        question: 'Pick 인증은 무엇인가요',
        answer: '고친 답이에요.',
        order: 5,
        published: false,
      },
    });

    expect(updated.statusCode).toBe(204);
    expect((await list(headers)).find((item) => item.id === id)).toMatchObject({
      answer: '고친 답이에요.',
      order: 5,
      published: false,
    });

    const removed = await test.app.inject({
      method: 'DELETE',
      url: `/v1/admin/faq/${id}`,
      headers,
    });

    expect(removed.statusCode).toBe(204);
    expect((await list(headers)).some((item) => item.id === id)).toBe(false);
  });

  it('코드에 있는 항목은 함께 보이지만 잠겨 있다', async () => {
    const { headers } = await operator();
    const items = await list(headers);
    const locked = items.filter((item) => item.editable === false);

    expect(locked.length).toBeGreaterThan(0);

    const response = await test.app.inject({
      method: 'DELETE',
      url: `/v1/admin/faq/${locked[0]!.id}`,
      headers,
    });

    expect(response.statusCode).toBe(400);
  });

  it('회원 추이는 가입을 그 칸에 세고 탈퇴는 누적에서 뺀다', async () => {
    const { headers, userId } = await operator();

    /* 오늘 가입한 계정 하나를 탈퇴 처리한다 — 가입 수는 남고 누적에서는 빠져야 한다. */
    const { rows } = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users (deleted_at) VALUES (now()) RETURNING id'
    );

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/members-trend?bucket=day',
      headers,
    });

    expect(response.statusCode).toBe(200);

    const data = response.json() as {
      points: { at: string; signups: number; total: number }[];
      current: number;
    };
    const today = data.points.at(-1)!;

    expect(data.points).toHaveLength(14);
    /* 운영자 계정과 탈퇴 계정 둘이 오늘 들어왔다. */
    expect(today.signups).toBeGreaterThanOrEqual(2);
    /* 살아 있는 것은 운영자 하나뿐이다. */
    expect(today.total).toBe(1);
    expect(data.current).toBe(1);
    expect(rows[0]!.id).not.toBe(userId);
  });

  it('구간 이름이 아니면 거부한다', async () => {
    const { headers } = await operator();
    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/members-trend?bucket=hour',
      headers,
    });

    expect(response.statusCode).toBe(400);
  });
});
