import { createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

type Summary = { unread: number; total: number };

/**
 * 알림함.
 *
 * 푸시와 다른 것이다. 푸시는 지나가고 이건 남는다 — 알림을 끈 사람도 결과는
 * 볼 수 있어야 한다.
 */
describeWithDb('알림함', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  const list = (headers: Record<string, string>) =>
    test.app.inject({ method: 'GET', url: '/v1/me/notifications', headers });

  const summary = (headers: Record<string, string>) =>
    test.app.inject({ method: 'GET', url: '/v1/me/notifications/summary', headers });

  async function seed(userId: string, count: number) {
    for (let index = 0; index < count; index += 1) {
      await test.pool.query(
        `INSERT INTO structured.notifications (user_id, kind, title, body)
         VALUES ($1, 'notice', $2, '내용')`,
        [userId, `알림 ${index}`]
      );
    }
  }

  it('처음에는 비어 있다', async () => {
    const { headers } = await signInAs(test);

    const body = (await list(headers)).json<{ notifications: unknown[] } & Summary>();

    expect(body.notifications).toHaveLength(0);
    expect(body.unread).toBe(0);
  });

  it('사람이 읽는 말로 종류를 준다', async () => {
    // DB의 enum 값을 그대로 화면에 띄우지 않는다.
    const { headers, userId } = await signInAs(test);
    await seed(userId, 1);

    const body = (await list(headers)).json<{ notifications: { kindLabel: string }[] }>();

    expect(body.notifications[0]!.kindLabel).toBe('안내');
  });

  it('읽으면 안 읽은 수가 줄어든다', async () => {
    const { headers, userId } = await signInAs(test);
    await seed(userId, 3);

    const before = (await summary(headers)).json<Summary>();
    expect(before).toEqual({ unread: 3, total: 3 });

    const first = (await list(headers)).json<{ notifications: { id: string }[] }>()
      .notifications[0]!;

    const after = await test.app.inject({
      method: 'POST',
      url: `/v1/me/notifications/${first.id}/read`,
      headers,
    });

    expect(after.json<Summary>()).toEqual({ unread: 2, total: 3 });
  });

  it('두 번 읽어도 처음 읽은 때가 남는다', async () => {
    const { headers, userId } = await signInAs(test);
    await seed(userId, 1);

    const id = (await list(headers)).json<{ notifications: { id: string }[] }>().notifications[0]!
      .id;

    const read = () =>
      test.app.inject({ method: 'POST', url: `/v1/me/notifications/${id}/read`, headers });

    await read();
    const { rows } = await test.pool.query<{ read_at: Date }>(
      'SELECT read_at FROM structured.notifications WHERE id = $1',
      [id]
    );
    await read();
    const again = await test.pool.query<{ read_at: Date }>(
      'SELECT read_at FROM structured.notifications WHERE id = $1',
      [id]
    );

    expect(again.rows[0]!.read_at).toEqual(rows[0]!.read_at);
  });

  it('모두 읽음이 점을 끈다', async () => {
    const { headers, userId } = await signInAs(test);
    await seed(userId, 5);

    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/me/notifications/read-all',
      headers,
    });

    expect(response.json<Summary>()).toEqual({ unread: 0, total: 5 });
  });

  it('남의 알림은 읽을 수 없고, 없는 알림과 같은 답을 받는다', async () => {
    /*
     * 다르게 답하면 남의 알림 id가 실재하는지 알아낼 수 있다.
     */
    const owner = await signInAs(test, 'owner-user');
    await seed(owner.userId, 1);
    const id = (await list(owner.headers)).json<{ notifications: { id: string }[] }>()
      .notifications[0]!.id;

    const other = await signInAs(test, 'other-user');

    const stranger = await test.app.inject({
      method: 'POST',
      url: `/v1/me/notifications/${id}/read`,
      headers: other.headers,
    });
    const missing = await test.app.inject({
      method: 'POST',
      url: `/v1/me/notifications/${'00000000-0000-4000-8000-000000000000'}/read`,
      headers: other.headers,
    });

    expect(stranger.statusCode).toBe(404);
    expect(missing.statusCode).toBe(404);

    // 남의 것은 여전히 안 읽은 상태다.
    expect((await summary(owner.headers)).json<Summary>().unread).toBe(1);
  });

  it('남의 알림은 목록에도 오지 않는다', async () => {
    const owner = await signInAs(test, 'owner-user');
    await seed(owner.userId, 2);

    const other = await signInAs(test, 'other-user');

    expect((await list(other.headers)).json<{ notifications: unknown[] }>().notifications).toEqual(
      []
    );
  });

  it('배우자가 연결되면 초대한 사람에게 남는다', async () => {
    /*
     * 초대장을 보낸 쪽은 상대가 눌렀는지 알 길이 없다. 앱을 다시 열어 배우자
     * 화면에 들어가 보는 수밖에 없었다.
     */
    const owner = await signInAs(test, 'owner-user');
    const weddingId = await createWedding(test, owner.headers);

    const invite = await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/invites`,
      headers: owner.headers,
    });

    const partner = await signInAs(test, 'partner-user');
    await test.app.inject({
      method: 'POST',
      url: '/v1/wedding-invites/accept',
      headers: partner.headers,
      payload: { code: invite.json<{ code: string }>().code },
    });

    const body = (await list(owner.headers)).json<{
      notifications: { kind: string; targetId: string }[];
    }>();

    expect(body.notifications).toHaveLength(1);
    expect(body.notifications[0]!.kind).toBe('partner');
    expect(body.notifications[0]!.targetId).toBe(weddingId);

    // 수락한 쪽에는 남지 않는다. 자기가 한 일을 알려줄 필요는 없다.
    expect(
      (await list(partner.headers)).json<{ notifications: unknown[] }>().notifications
    ).toEqual([]);
  });

  it('로그인해야 볼 수 있다', async () => {
    const response = await test.app.inject({ method: 'GET', url: '/v1/me/notifications' });

    expect(response.statusCode).toBe(401);
  });
});
