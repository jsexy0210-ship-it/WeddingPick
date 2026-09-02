import { createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

async function aVendor(name: string, category = 'hall') {
  const { rows } = await test.pool.query<{ id: string }>(
    `INSERT INTO structured.vendors (category, name, region, source)
     VALUES ($1::vendor_category, $2, '서울', 'public_data') RETURNING id`,
    [category, name]
  );

  return rows[0]!.id;
}

/**
 * WP-OUR-012 준비 타임라인. Pick·최종결정·지출·(사용자가 더한) 일정을 시간순으로
 * 섞어 보여준다 — 새 표는 없고 이미 있는 네 표에서 시간과 함께 저장된 값만 모은다.
 */
describeWithDb('준비 타임라인', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('로그인하지 않으면 볼 수 없다', async () => {
    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/weddings/00000000-0000-0000-0000-000000000000/timeline',
    });

    expect(response.statusCode).toBe(401);
  });

  it('처음에는 비어 있다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/weddings/${weddingId}/timeline`,
      headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().events).toEqual([]);
  });

  it('Pick · 최종결정 · 지출 · 사용자가 더한 일정을 시간순으로 섞는다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);
    const vendorId = await aVendor('가온예식홀');

    await test.pool.query(
      `INSERT INTO structured.vendor_candidates (wedding_id, vendor_id, added_at)
       VALUES ($1, $2, now() - interval '3 days')`,
      [weddingId, vendorId]
    );
    await test.pool.query(
      `INSERT INTO structured.category_decisions (wedding_id, category, vendor_id, decided_at)
       VALUES ($1, 'hall', $2, now() - interval '2 days')`,
      [weddingId, vendorId]
    );
    await test.pool.query(
      `INSERT INTO structured.expenses (wedding_id, label, amount, created_at)
       VALUES ($1, '계약금', 3000000, now() - interval '1 days')`,
      [weddingId]
    );
    await test.pool.query(
      `INSERT INTO structured.wedding_tasks (wedding_id, label, created_at)
       VALUES ($1, '드레스 투어 예약', now())`,
      [weddingId]
    );

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/weddings/${weddingId}/timeline`,
      headers,
    });

    const events = response.json().events;

    expect(events.map((e: { kind: string }) => e.kind)).toEqual(['task', 'expense', 'decision', 'pick']);
    expect(events[0]).toMatchObject({ kind: 'task', label: '드레스 투어 예약' });
    expect(events[1]).toMatchObject({ kind: 'expense', label: '계약금', amount: 3000000 });
    expect(events[2]).toMatchObject({ kind: 'decision', vendorName: '가온예식홀', category: 'hall' });
    expect(events[3]).toMatchObject({ kind: 'pick', vendorName: '가온예식홀', category: 'hall' });
  });

  it('기본으로 깔린 열넷은 타임라인에 넣지 않는다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);

    // 기본 열넷은 preset_key가 있다 — /tasks를 한 번 열면 자동으로 깔린다.
    await test.app.inject({ method: 'GET', url: `/v1/weddings/${weddingId}/tasks`, headers });

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/weddings/${weddingId}/timeline`,
      headers,
    });

    expect(response.json().events).toEqual([]);
  });

  it('다른 사람의 웨딩은 볼 수 없다', async () => {
    const owner = await signInAs(test);
    const weddingId = await createWedding(test, owner.headers);

    const stranger = await signInAs(test, 'apple-user-2');
    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/weddings/${weddingId}/timeline`,
      headers: stranger.headers,
    });

    expect(response.statusCode).toBe(403);
  });
});
