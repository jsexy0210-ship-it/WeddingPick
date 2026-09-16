import { privacySections, privacyDocument } from '@weddingpick/domain';
import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';
import { createTermsDraft } from '../content-admin';

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
let test: TestApp;
describeWithDb('관리자 콘텐츠 실제 저장·공개', () => {
  beforeAll(async () => { await resetDatabase(); test = await createTestApp(); });
  beforeEach(resetDatabase);
  afterAll(async () => { await test?.close(); });
  async function operator() {
    const user = await signInAs(test);
    await test.pool.query('UPDATE structured.users SET is_operator=true WHERE id=$1', [user.userId]);
    return user;
  }
  const call = (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, headers?: Record<string, string>, payload?: unknown) =>
    test.app.inject({ method, url, headers, ...(payload === undefined ? {} : { payload: payload as object }) });
  const event = { title: '이벤트 안내', description: '행사 안내 원문', startsOn: '2000-01-01', endsOn: '2099-12-31', budgetAmount: 100000, status: 'draft' };

  it('이벤트 등록·수정·삭제가 재조회와 공개 혜택 안내에 반영된다', async () => {
    const { headers } = await operator();
    const created = await call('POST', '/v1/admin/campaigns', headers, event);
    expect(created.statusCode).toBe(200);
    const { id } = created.json();
    expect((await call('GET', '/v1/events')).json().events).toEqual([]);
    expect((await call('PATCH', `/v1/admin/campaigns/${id}`, headers, { ...event, title: '변경된 안내', status: 'active' })).statusCode).toBe(204);
    expect((await call('GET', '/v1/events')).json().events).toEqual([{ id, title: '변경된 안내', description: event.description }]);
    expect((await call('GET', '/v1/admin/campaigns', headers)).json().events[0]).toMatchObject({ id, budgetAmount: 100000 });
    expect((await call('DELETE', `/v1/admin/campaigns/${id}`, headers)).statusCode).toBe(204);
    expect((await call('GET', '/v1/events')).json().events).toEqual([]);
    expect((await call('DELETE', `/v1/admin/campaigns/${id}`, headers)).statusCode).toBe(404);
    expect((await test.pool.query('SELECT deleted_at FROM structured.admin_events WHERE id=$1', [id])).rows[0].deleted_at).not.toBeNull();
  });

  it('종료·기간 전·삭제 이벤트는 노출하지 않으며 잘못된 기간은 저장하지 않는다', async () => {
    const { headers } = await operator();
    expect((await call('POST', '/v1/admin/campaigns', headers, { ...event, startsOn: '2030-01-02', endsOn: '2030-01-01' })).statusCode).toBe(400);
    await call('POST', '/v1/admin/campaigns', headers, { ...event, status: 'closed' });
    await call('POST', '/v1/admin/campaigns', headers, { ...event, status: 'active', startsOn: '2099-01-01' });
    expect((await call('GET', '/v1/events')).json().events).toEqual([]);
  });

  it('광고를 수정해도 일시정지와 전체 운영 관문은 유지하고 삭제는 실제로 반영한다', async () => {
    const { headers } = await operator();
    const vendor = (await test.pool.query(`INSERT INTO structured.vendors(name,category,region,source)
      VALUES('광고 시험 업체','hall','서울','public_data') RETURNING id`)).rows[0].id;
    const input = { vendorId: vendor, surface: 'vendor_detail', tier: 'light', category: null, region: null, startsOn: '2000-01-01', endsOn: '2099-12-31' };
    const response = await call('POST', '/v1/admin/ads', headers, input);
    expect(response.statusCode).toBe(200);
    const { id } = response.json();
    await call('PATCH', `/v1/admin/ads/${id}/status`, headers, { status: 'paused' });
    expect((await call('PATCH', `/v1/admin/ads/${id}`, headers, { ...input, tier: 'standard', surface: 'search' })).statusCode).toBe(204);
    expect((await call('GET', '/v1/admin/ads', headers)).json().items[0]).toMatchObject({ id, vendorId: vendor, plan: 'STANDARD', status: 'paused' });
    expect((await call('GET', '/v1/vendors')).json().sponsored).toEqual([]);
    expect((await call('DELETE', `/v1/admin/ads/${id}`, headers)).statusCode).toBe(204);
    expect((await call('GET', '/v1/admin/ads', headers)).json().items).toEqual([]);
    expect((await call('PATCH', `/v1/admin/ads/${id}`, headers, input)).statusCode).toBe(404);
  });

  it('웹 원문 초안은 법률 문구와 표 구조를 그대로 공개한다', async () => {
    const { headers } = await operator();
    expect((await call('POST', '/v1/admin/terms', headers, { doc: 'privacy' })).statusCode).toBe(200);
    expect((await call('GET', '/v1/legal/privacy')).json().document).toBeNull();
    expect((await call('POST', '/v1/admin/terms/privacy/publish', headers)).statusCode).toBe(200);
    expect((await call('GET', '/v1/legal/privacy')).json().document.html).toBe(privacyDocument(privacySections(process.env.WEDDINGPICK_CONTACT_EMAIL ?? null)));
  });

  it('원문 제목·표 셀 수정, 삭제 및 신규 조문이 실제 웹 본문에 반영된다', async () => {
    const { headers } = await operator();
    await call('POST', '/v1/admin/terms', headers, { doc: 'privacy' });
    const doc = (await call('GET', '/v1/admin/terms', headers)).json().documents.find((d: { type: string }) => d.type === 'privacy');
    const title = doc.clauses.find((c: { sourcePath: string[] }) => c.sourcePath.join('.') === '0.t');
    const cell = doc.clauses.find((c: { sourcePath: string[] }) => c.sourcePath.includes('rows'));
    const removed = doc.clauses.find((c: { sourcePath: string[] }) => c.sourcePath.join('.') === '0.l.0');
    const update = (clause: { id: string; articleNumber: string; title: string }, body: string) => call('PUT', `/v1/admin/terms/privacy/clauses/${clause.id}`, headers, { articleNumber: clause.articleNumber, title: clause.title, body });
    expect((await update(title, '시험 제목 <script>')).statusCode).toBe(200);
    expect((await update(cell, '시험 표 셀')).statusCode).toBe(200);
    expect((await call('DELETE', `/v1/admin/terms/privacy/clauses/${removed.id}`, headers)).statusCode).toBe(204);
    await call('POST', '/v1/admin/terms/privacy/clauses', headers, { articleNumber: '추가', title: '새 조문', body: '추가 본문' });
    await call('POST', '/v1/admin/terms/privacy/publish', headers);
    const html = (await call('GET', '/v1/legal/privacy')).json().document.html;
    expect(html).toContain('시험 제목 &lt;script&gt;');
    expect(html).toContain('시험 표 셀'); expect(html).toContain('<table');
    expect(html).toContain('새 조문'); expect(html).toContain('추가 본문');
    expect(html).not.toContain(removed.body);
    expect((await update(title, '공개본 덮어쓰기')).statusCode).toBe(404);
  });

  it('구형 공개판의 새 초안은 구형 사본 대신 현행 웹 원문으로 시작한다', async () => {
    const { userId } = await operator();
    const previous = await test.pool.query(`INSERT INTO structured.terms_versions(doc,version,published_at,published_by)
      VALUES('privacy','v0.1',now(),$1) RETURNING id`, [userId]);
    await createTermsDraft(test.pool, 'privacy', userId);
    const snapshot = await test.pool.query(`SELECT document_snapshot FROM structured.terms_versions WHERE doc='privacy' AND published_at IS NULL`);
    expect(snapshot.rows[0].document_snapshot).toEqual(privacySections(process.env.WEDDINGPICK_CONTACT_EMAIL ?? null));
    expect((await call('GET', '/v1/legal/privacy')).json().document).toBeNull();
    expect(previous.rows[0].id).toBeDefined();
  });

  it('공개 약관의 새 버전을 보지 않은 구형 동의 요청은 기록하지 않는다', async () => {
    const owner = await operator();
    const member = await signInAs(test, 'new-consent-user', { completeSignup: false });
    await call('POST', '/v1/admin/terms', owner.headers, { doc: 'terms' });
    await call('POST', '/v1/admin/terms/terms/publish', owner.headers);
    expect((await call('POST', '/v1/me/signup', member.headers, { consents: ['terms', 'privacy'] })).statusCode).toBe(409);
    expect((await test.pool.query('SELECT terms_version FROM structured.user_consents WHERE user_id=$1', [member.userId])).rows).toEqual([]);
    const state = (await call('GET', '/v1/me/signup', member.headers)).json();
    const versions = Object.fromEntries(state.items.map((item: { item: string; version: string }) => [item.item, item.version]));
    expect((await call('POST', '/v1/me/signup', member.headers, { consents: ['terms', 'privacy'], versions })).statusCode).toBe(200);
    expect((await test.pool.query("SELECT terms_version FROM structured.user_consents WHERE user_id=$1 AND item='terms'", [member.userId])).rows[0].terms_version).toBe('v1.0');
  });

  it('마케팅 소재 생성·편집·단일 모의 실행·삭제가 실제 작업과 이력에 남는다', async () => {
    const { headers } = await operator();
    await call('POST', '/v1/admin/marketing/sources', headers, { id: 'source', factIds: ['pick'], reviewed: true });
    const input = { sourceId: 'source', channel: 'blog', format: 'product', title: '원제목', body: '검토 본문' };
    const first = await call('POST', '/v1/admin/marketing', headers, input);
    expect(first.statusCode).toBe(200);
    const id = first.json().job.id;
    const second = (await call('POST', '/v1/admin/marketing', headers, input)).json().job.id;
    expect((await call('PATCH', `/v1/admin/marketing/${id}`, headers, { title: '편집 제목', body: '편집 본문' })).statusCode).toBe(204);
    expect((await call('POST', `/v1/admin/marketing/${id}/simulate`, headers)).statusCode).toBe(200);
    const jobs = (await call('GET', '/v1/admin/marketing', headers)).json().items;
    expect(jobs.find((job: { id: string }) => job.id === id)).toMatchObject({ status: 'simulated', title: '편집 제목', body: '편집 본문' });
    expect(jobs.find((job: { id: string }) => job.id === second).status).toBe('queued');
    expect((await call('DELETE', `/v1/admin/marketing/${id}`, headers)).statusCode).toBe(204);
    expect((await call('GET', '/v1/admin/marketing', headers)).json().items).toHaveLength(1);
    expect((await call('POST', `/v1/admin/marketing/${id}/simulate`, headers)).statusCode).toBe(400);
    expect((await test.pool.query('SELECT event_type FROM marketing_events WHERE job_id=$1', [id])).rows.map((r) => r.event_type)).toEqual(expect.arrayContaining(['edited', 'simulated', 'deleted']));
  });
});
