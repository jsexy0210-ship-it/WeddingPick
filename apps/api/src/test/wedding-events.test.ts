import { createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

const at = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

/**
 * 우리웨딩 — 일정. 웨딩 스케줄(체크리스트)과 다른 개념이다 — 일시·장소가 있는
 * 캘린더 이벤트다.
 */
describeWithDb('일정', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function mine() {
    const session = await signInAs(test);

    return { ...session, weddingId: await createWedding(test, session.headers) };
  }

  const events = (headers: Record<string, string>, weddingId: string) =>
    test.app.inject({ method: 'GET', url: `/v1/weddings/${weddingId}/events`, headers });

  it('처음 열면 비어 있다', async () => {
    const { headers, weddingId } = await mine();

    const body = (await events(headers, weddingId)).json<{ events: unknown[] }>();

    expect(body.events).toHaveLength(0);
  });

  it('만들면 목록에 뜬다', async () => {
    const { headers, weddingId } = await mine();

    const created = await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/events`,
      headers,
      payload: { title: '상견례', startsAt: at(48), location: '더 라움' },
    });

    expect(created.statusCode).toBe(201);

    const body = (await events(headers, weddingId)).json<{
      events: { title: string; location: string | null; notifyEnabled: boolean; source: string }[];
    }>();

    expect(body.events[0]!.title).toBe('상견례');
    expect(body.events[0]!.location).toBe('더 라움');
    // 알림은 보내지 않는 값이면 기본으로 켜져 있다.
    expect(body.events[0]!.notifyEnabled).toBe(true);
    expect(body.events[0]!.source).toBe('manual');
  });

  it('지난 일정은 완료로, 다가올 일정은 예정으로 계산한다', async () => {
    // 저장하지 않는다 — starts_at과 지금을 비교해 매번 계산한다.
    const { headers, weddingId } = await mine();

    await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/events`,
      headers,
      payload: { title: '지난 방문', startsAt: at(-5) },
    });

    await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/events`,
      headers,
      payload: { title: '다가올 촬영', startsAt: at(5) },
    });

    const body = (await events(headers, weddingId)).json<{
      events: { title: string; status: string }[];
    }>();

    expect(body.events.find((row) => row.title === '지난 방문')!.status).toBe('done');
    expect(body.events.find((row) => row.title === '다가올 촬영')!.status).toBe('upcoming');
  });

  it('보낸 칸만 고친다', async () => {
    // 시간만 바꾸려던 사람이 장소까지 잃으면 안 된다.
    const { headers, weddingId } = await mine();

    const created = await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/events`,
      headers,
      payload: { title: '드레스 피팅', startsAt: at(24), location: '메종드로브' },
    });

    const eventId = created.json<{ eventId: string }>().eventId;

    await test.app.inject({
      method: 'PATCH',
      url: `/v1/weddings/${weddingId}/events/${eventId}`,
      headers,
      payload: { startsAt: at(72) },
    });

    const body = (await events(headers, weddingId)).json<{
      events: { id: string; location: string | null }[];
    }>();

    expect(body.events.find((row) => row.id === eventId)!.location).toBe('메종드로브');
  });

  it('빼면 목록에서 사라진다', async () => {
    const { headers, weddingId } = await mine();

    const created = await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/events`,
      headers,
      payload: { title: '스튜디오 촬영', startsAt: at(10) },
    });

    const eventId = created.json<{ eventId: string }>().eventId;

    const removed = await test.app.inject({
      method: 'DELETE',
      url: `/v1/weddings/${weddingId}/events/${eventId}`,
      headers,
    });

    expect(removed.statusCode).toBe(204);

    const body = (await events(headers, weddingId)).json<{ events: unknown[] }>();

    expect(body.events).toHaveLength(0);
  });

  it('남의 웨딩은 볼 수 없다', async () => {
    const { weddingId } = await mine();
    const stranger = await signInAs(test, 'apple-stranger');

    expect((await events(stranger.headers, weddingId)).statusCode).toBe(403);
  });
});
