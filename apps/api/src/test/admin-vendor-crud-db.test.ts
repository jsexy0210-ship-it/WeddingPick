import { adminSession, createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';
import { syncCollected } from '../public-data/sync';
import type { CollectedVendor } from '../public-data/collect';

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
describeWithDb('업체 실제 등록·수정·삭제', () => {
  let test: TestApp;
  let owner: Awaited<ReturnType<typeof adminSession>>;
  beforeAll(async () => { await resetDatabase(); test = await createTestApp(); });
  beforeEach(async () => { await resetDatabase(); owner = await adminSession(test, 'super'); });
  afterAll(async () => { await test?.close(); });

  async function create(name = '관리자웨딩') {
    const response = await test.app.inject({ method: 'POST', url: '/v1/admin/vendors', headers: owner.headers,
      payload: { name, category: 'hall', region: '서울' } });
    expect(response.statusCode).toBe(201);
    return response.json().id as string;
  }
  const remove = (id: string) => test.app.inject({ method: 'DELETE', url: `/v1/admin/vendors/${id}`, headers: owner.headers, payload: { reason: '중복 정보 확인' } });

  it('공용 업종·지역으로 등록하고 상호를 수정하며 이력을 남긴다', async () => {
    const id = await create();
    expect((await test.app.inject({ method: 'PATCH', url: `/v1/admin/vendors/${id}/name`, headers: owner.headers, payload: { name: '수정웨딩' } })).statusCode).toBe(200);
    const response = await test.app.inject({ method: 'GET', url: '/v1/admin/vendors', headers: owner.headers });
    const vendor = response.json().vendors.find((row: { id: string }) => row.id === id);
    expect(vendor).toMatchObject({ name: '수정웨딩', category: 'hall', region: '서울', status: 'active' });
    expect(vendor.history.map((entry: { action: string }) => entry.action)).toEqual(expect.arrayContaining(['업체 등록', '상호 변경']));
  });

  it('지원하지 않는 업종·지역과 같은 업체의 중복 등록을 거부한다', async () => {
    await create();
    expect((await test.app.inject({ method: 'POST', url: '/v1/admin/vendors', headers: owner.headers, payload: { name: '관리자웨딩', category: 'hall', region: '서울' } })).statusCode).toBe(409);
    for (const input of [{ category: 'unknown', region: '서울' }, { category: 'hall', region: 'unknown' }]) {
      expect((await test.app.inject({ method: 'POST', url: '/v1/admin/vendors', headers: owner.headers, payload: { name: '새웨딩', ...input } })).statusCode).toBe(400);
    }
  });

  it('삭제는 공개 조회에서 제외하고 제보·후기·Pick·변경 이력을 보존한다', async () => {
    const id = await create();
    const member = await signInAs(test);
    const weddingId = await createWedding(test, member.headers);
    await test.pool.query("INSERT INTO structured.price_reports (vendor_id, reporter_user_id, product_name, total_amount, contracted_on) VALUES ($1, $2, '기본 상품', 1500000, '2026-01-01')", [id, member.userId]);
    await test.pool.query("INSERT INTO structured.reviews (vendor_id, author_user_id, role, overall, title, body) VALUES ($1, $2, 'couple', 5, '후기', $3)", [id, member.userId, '업체를 이용하고 남긴 실제 후기 내용을 삭제 후에도 보존하는지 확인합니다. '.repeat(2)]);
    await test.pool.query('INSERT INTO structured.vendor_candidates (wedding_id, vendor_id) VALUES ($1, $2)', [weddingId, id]);
    expect((await remove(id)).statusCode).toBe(200);
    for (const suffix of ['', '/events', '/images', '/conditions', '/price-range', '/reviews']) {
      expect((await test.app.inject({ method: 'GET', url: `/v1/vendors/${id}${suffix}`, headers: member.headers })).statusCode).toBe(404);
    }
    expect((await test.app.inject({ method: 'POST', url: `/v1/weddings/${weddingId}/candidates`, headers: member.headers, payload: { vendorId: id } })).statusCode).toBe(404);
    const candidates = await test.app.inject({ method: 'GET', url: `/v1/weddings/${weddingId}/candidates`, headers: member.headers });
    expect(candidates.statusCode).toBe(200);
    expect(candidates.json().total).toBe(1);
    const recommendations = await test.app.inject({ method: 'GET', url: '/v1/recommendations/top3?category=hall&region=서울', headers: member.headers });
    expect(recommendations.statusCode).toBe(200);
    expect(recommendations.json().items.some((item: { vendorId: string }) => item.vendorId === id)).toBe(false);
    for (const table of ['price_reports', 'reviews', 'vendor_candidates']) {
      expect((await test.pool.query(`SELECT 1 FROM structured.${table} WHERE vendor_id = $1`, [id])).rowCount).toBe(1);
    }
    const row = (await test.pool.query('SELECT is_active, admin_locked, deleted_at, closed_at FROM structured.vendors WHERE id = $1', [id])).rows[0];
    expect(row).toMatchObject({ is_active: false, admin_locked: true, closed_at: null });
    expect(row.deleted_at).toBeInstanceOf(Date);
    const listed = await test.app.inject({ method: 'GET', url: '/v1/admin/vendors', headers: owner.headers });
    expect(listed.json().vendors.find((vendor: { id: string }) => vendor.id === id)).toMatchObject({ status: 'deleted' });
    expect((await test.pool.query("SELECT 1 FROM structured.vendor_change_log WHERE vendor_id=$1 AND field_name='deleted_at'", [id])).rowCount).toBe(1);
    expect((await remove(id)).statusCode).toBe(200);
    expect((await test.pool.query("SELECT 1 FROM structured.vendor_change_log WHERE vendor_id=$1 AND field_name='deleted_at'", [id])).rowCount).toBe(1);
  });

  it('삭제 업체를 수정·병합·재등록·직접 재활성화할 수 없다', async () => {
    const id = await create();
    const target = await create('대상웨딩');
    await remove(id);
    for (const [suffix, payload] of [['name', { name: '되살리기' }], ['status', { status: 'active' }]] as const) {
      expect((await test.app.inject({ method: 'PATCH', url: `/v1/admin/vendors/${id}/${suffix}`, headers: owner.headers, payload })).statusCode).toBe(409);
    }
    expect((await test.app.inject({ method: 'POST', url: `/v1/admin/vendors/${id}/merge`, headers: owner.headers, payload: { targetId: target, reason: '검증' } })).statusCode).toBe(409);
    expect((await test.app.inject({ method: 'POST', url: '/v1/admin/vendors', headers: owner.headers, payload: { name: '관리자웨딩', category: 'hall', region: '서울' } })).statusCode).toBe(409);
    await expect(test.pool.query('UPDATE structured.vendors SET is_active=true WHERE id=$1', [id])).rejects.toThrow();
    await expect(test.pool.query('UPDATE structured.vendors SET deleted_at=NULL WHERE id=$1', [id])).rejects.toThrow();
  });

  it('폐업 업체의 기존 상세·Pick 조회는 삭제 업체와 구분해 유지한다', async () => {
    const id = await create();
    const member = await signInAs(test);
    const weddingId = await createWedding(test, member.headers);
    expect((await test.app.inject({ method: 'POST', url: `/v1/weddings/${weddingId}/candidates`, headers: member.headers, payload: { vendorId: id } })).statusCode).toBe(201);
    expect((await test.app.inject({ method: 'PATCH', url: `/v1/admin/vendors/${id}/status`, headers: owner.headers, payload: { status: 'closed' } })).statusCode).toBe(200);
    expect((await test.app.inject({ method: 'GET', url: `/v1/vendors/${id}`, headers: member.headers })).statusCode).toBe(200);
    const candidates = await test.app.inject({ method: 'GET', url: `/v1/weddings/${weddingId}/candidates`, headers: member.headers });
    expect(candidates.statusCode).toBe(200);
    expect(candidates.json().total).toBe(1);
  });

  it('같은 원천을 다시 수집해도 삭제 업체가 되살아나거나 새로 생성되지 않는다', async () => {
    const collected: CollectedVendor = { name: '수집웨딩', region: '경기도 이천시', category: 'hall', sourceKey: 'icheon-halls', sourceUrl: 'https://www.data.go.kr/data/15100736/fileData.do', sourceRecordId: 'deletion-test', publishedOn: '2026-07-01', collectedAt: '2026-09-04T00:00:00Z', status: 'needs_verification' };
    expect((await syncCollected(test.pool, [collected])).created).toBe(1);
    const id = (await test.pool.query('SELECT id FROM structured.vendors WHERE name=$1', [collected.name])).rows[0].id;
    await remove(id);
    const rerun = await syncCollected(test.pool, [{ ...collected, collectedAt: '2026-09-14T00:00:00Z', publishedOn: '2026-09-13' }]);
    expect(rerun.created).toBe(0);
    expect((await test.pool.query('SELECT is_active, deleted_at FROM structured.vendors WHERE name=$1', [collected.name])).rows).toEqual([{ is_active: false, deleted_at: expect.any(Date) }]);
  });

  it('뷰어 등록과 삭제 권한 없는 운영자의 삭제를 차단한다', async () => {
    const id = await create();
    const viewer = await adminSession(test, 'viewer');
    const editor = await adminSession(test, 'operator');
    await test.pool.query('UPDATE structured.admin_accounts SET can_delete=false WHERE user_id=$1', [editor.userId]);
    expect((await test.app.inject({ method: 'POST', url: '/v1/admin/vendors', headers: viewer.headers, payload: { name: '뷰어웨딩', category: 'hall', region: '서울' } })).statusCode).toBe(403);
    expect((await test.app.inject({ method: 'DELETE', url: `/v1/admin/vendors/${id}`, headers: editor.headers, payload: { reason: '검증' } })).statusCode).toBe(403);
  });
});
