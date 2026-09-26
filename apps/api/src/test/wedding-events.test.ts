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

  it('일반 업체 연결 일정은 최종 Pick 전에도 만들고 수정할 수 있다', async () => {
    const { headers, weddingId } = await mine();
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ('일반 일정 테스트홀', 'hall', '서울', 'public_data')
       RETURNING id`
    );
    const vendorId = rows[0]!.id;

    const created = await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/events`,
      headers,
      payload: { title: '업체 미팅', startsAt: at(24), vendorId },
    });
    expect(created.statusCode).toBe(201);

    const plain = await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/events`,
      headers,
      payload: { title: '개인 일정', startsAt: at(12) },
    });
    const eventId = plain.json<{ eventId: string }>().eventId;

    const updated = await test.app.inject({
      method: 'PATCH',
      url: `/v1/weddings/${weddingId}/events/${eventId}`,
      headers,
      payload: { vendorId },
    });
    expect(updated.statusCode).toBe(200);
  });

  it('상담 전용 일정은 Pick에 담은 업체에만 만들 수 있다 — 최종 결정은 요구하지 않는다', async () => {
    const { headers, weddingId } = await mine();
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ('상담 테스트홀', 'hall', '서울', 'public_data')
       RETURNING id`
    );
    const vendorId = rows[0]!.id;

    const request = {
      title: '상담',
      startsAt: at(24),
      vendorId,
      idempotencyKey: `consult:${vendorId}:retry-1`,
    };
    const blocked = await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/consultation-events`,
      headers,
      payload: request,
    });

    // 후보도 결정도 아닌 업체는 막는다.
    expect(blocked.statusCode).toBe(403);

    // 2026-09-25 대표 결정(안 A) — 후보에만 있고 결정 전이어도 상담 일정을 만든다.
    await test.pool.query(
      'INSERT INTO structured.vendor_candidates (wedding_id, vendor_id) VALUES ($1, $2)',
      [weddingId, vendorId]
    );

    const allowed = await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/consultation-events`,
      headers,
      payload: request,
    });
    expect(allowed.statusCode).toBe(201);
    const eventId = allowed.json<{ eventId: string }>().eventId;

    // 결정한 업체도 그대로 받는다(결정은 후보 줄을 가리킨다).
    await test.pool.query(
      `INSERT INTO structured.category_decisions (wedding_id, category, vendor_id)
       VALUES ($1, 'hall', $2)`,
      [weddingId, vendorId]
    );
    const decidedRequest = { ...request, startsAt: at(30), idempotencyKey: `consult:${vendorId}:decided` };
    const decided = await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/consultation-events`,
      headers,
      payload: decidedRequest,
    });
    expect(decided.statusCode).toBe(201);

    // 같은 키 재전송은 새로 만들지 않고 처음 것을 돌려준다.
    const retried = await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/consultation-events`,
      headers,
      payload: request,
    });
    expect(retried.statusCode).toBe(201);
    expect(retried.json<{ eventId: string }>().eventId).toBe(eventId);

    const stored = await test.pool.query<{ count: string }>(
      'SELECT count(*) FROM structured.wedding_events WHERE wedding_id = $1 AND idempotency_key = $2',
      [weddingId, request.idempotencyKey]
    );
    expect(Number(stored.rows[0]!.count)).toBe(1);

    // Pick에서 빼면(결정도 cascade로 풀린다) 새 상담 일정은 다시 막는다.
    await test.pool.query('DELETE FROM structured.vendor_candidates WHERE wedding_id = $1', [weddingId]);
    const removed = await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/consultation-events`,
      headers,
      payload: { ...request, startsAt: at(40), idempotencyKey: `consult:${vendorId}:removed` },
    });
    expect(removed.statusCode).toBe(403);
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

  /* 웨딩노트 타임라인의 수정 · 삭제 아이콘(2026-09-26) — 남의 일정은 고치지도 지우지도 못한다. */
  it('남의 웨딩 일정은 고치지도 지우지도 못한다', async () => {
    const { headers, weddingId } = await mine();
    const created = await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/events`,
      headers,
      payload: { title: '리엔헤어메이크업 상담', startsAt: at(30) },
    });
    const eventId = created.json<{ eventId: string }>().eventId;
    const stranger = await signInAs(test, 'apple-stranger');

    const patched = await test.app.inject({
      method: 'PATCH',
      url: `/v1/weddings/${weddingId}/events/${eventId}`,
      headers: stranger.headers,
      payload: { title: '바꿔치기' },
    });
    const removed = await test.app.inject({
      method: 'DELETE',
      url: `/v1/weddings/${weddingId}/events/${eventId}`,
      headers: stranger.headers,
    });

    expect(patched.statusCode).toBe(403);
    expect(removed.statusCode).toBe(403);

    /* 자기 웨딩 id로 남의 일정을 가리켜도 404 — 일정은 웨딩에 매달려 있다. */
    const strangerWedding = await createWedding(test, stranger.headers);
    const crossed = await test.app.inject({
      method: 'DELETE',
      url: `/v1/weddings/${strangerWedding}/events/${eventId}`,
      headers: stranger.headers,
    });

    expect(crossed.statusCode).toBe(404);

    const body = (await events(headers, weddingId)).json<{ events: { title: string }[] }>();

    expect(body.events.map((row) => row.title)).toEqual(['리엔헤어메이크업 상담']);
  });

  it('제목 · 시각 · 알림을 한 번에 고친다', async () => {
    const { headers, weddingId } = await mine();
    const created = await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/events`,
      headers,
      payload: { title: '드레스 피팅', startsAt: at(24), notifyEnabled: true },
    });
    const eventId = created.json<{ eventId: string }>().eventId;
    const next = at(96);

    const patched = await test.app.inject({
      method: 'PATCH',
      url: `/v1/weddings/${weddingId}/events/${eventId}`,
      headers,
      payload: { title: '드레스 피팅 2차', startsAt: next, notifyEnabled: false },
    });

    expect(patched.statusCode).toBe(200);

    const row = (await events(headers, weddingId)).json<{
      events: { id: string; title: string; startsAt: string; notifyEnabled: boolean }[];
    }>().events.find((event) => event.id === eventId)!;

    expect(row).toMatchObject({ title: '드레스 피팅 2차', startsAt: next, notifyEnabled: false });
  });
});
