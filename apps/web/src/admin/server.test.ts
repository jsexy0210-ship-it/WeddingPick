import { Client, Pool } from 'pg';

import { buildAdminServer, type AdminServerContext } from './server';

const connectionString = process.env.DATABASE_URL;
const describeWithDb = connectionString ? describe : describe.skip;
const ADMIN_PASSWORD = 'test-admin-password-1234';

function basicAuth(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

let pool: Pool;
let app: ReturnType<typeof buildAdminServer>;

async function resetDatabase(): Promise<void> {
  // @weddingpick/db는 이 워크스페이스의 의존이 아니다 — 스키마를 직접 비우지
  // 않고, 이 파일이 쓰는 표만 비운다. 마이그레이션 자체는 다른 워크스페이스의
  // 책임이다.
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query('TRUNCATE structured.decisions CASCADE');
    await client.query('TRUNCATE structured.users CASCADE');
  } finally {
    await client.end();
  }
}

describeWithDb('관리자 웹', () => {
  beforeAll(() => {
    pool = new Pool({ connectionString, max: 2 });
    const context: AdminServerContext = { pool, adminPassword: ADMIN_PASSWORD };
    app = buildAdminServer(context);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  beforeEach(resetDatabase);

  it('/health는 인증 없이 연다', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
  });

  it('인증 헤더가 없으면 401이다', async () => {
    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(401);
    expect(response.headers['www-authenticate']).toContain('Basic');
  });

  it('비밀번호가 틀리면 401이다', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/',
      headers: { authorization: basicAuth('admin', '틀린비밀번호1234567890') },
    });

    expect(response.statusCode).toBe(401);
  });

  it('맞는 비밀번호면 홈이 열린다', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/',
      headers: { authorization: basicAuth('admin', ADMIN_PASSWORD) },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('관리자 홈');
  });

  it('브리핑은 결정 없는 날엔 빈 상태를 정직하게 말한다', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/briefing',
      headers: { authorization: basicAuth('admin', ADMIN_PASSWORD) },
    });

    expect(response.body).toContain('최근 24시간 동안 결정이 없었어요');
  });

  it('결정이 있으면 브리핑에 집계돼 나온다', async () => {
    await pool.query(
      `INSERT INTO structured.decisions
         (event_id, workflow, step, subject_kind, decider, rule_version, decision, reason_code,
          policy_version, cost_usd)
       VALUES (gen_random_uuid(), 'payment_proof_review', 'match', 'payment_proof', 'rule', 'v1',
               'approved', 'ok', 'v2.0', 0.02)`
    );

    const response = await app.inject({
      method: 'GET',
      url: '/briefing',
      headers: { authorization: basicAuth('admin', ADMIN_PASSWORD) },
    });

    expect(response.body).toContain('payment_proof_review');
    expect(response.body).toContain('1건');
  });

  it('자동화 상태는 열려 있는 결정이 없으면 조용하다', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/automation',
      headers: { authorization: basicAuth('admin', ADMIN_PASSWORD) },
    });

    expect(response.body).toContain('사람 손이 필요한 것이 없어요');
  });

  it('실패한 결정은 자동화 상태 큐에 뜬다', async () => {
    await pool.query(
      `INSERT INTO structured.decisions
         (event_id, workflow, step, subject_kind, decider, rule_version, decision, reason_code,
          policy_version, execution_status)
       VALUES (gen_random_uuid(), 'rebuttal_review', 'publish', 'rebuttal', 'rule', 'v1',
               'hold', 'needs_review', 'v2.0', 'failed')`
    );

    const response = await app.inject({
      method: 'GET',
      url: '/automation',
      headers: { authorization: basicAuth('admin', ADMIN_PASSWORD) },
    });

    expect(response.body).toContain('rebuttal_review');
    expect(response.body).toContain('needs_review');
  });

  it('감사 로그는 사건 id로 그 사건의 단계를 전부 보여준다', async () => {
    const eventId = '11111111-1111-1111-1111-111111111111';

    await pool.query(
      `INSERT INTO structured.decisions
         (event_id, workflow, step, subject_kind, decider, rule_version, decision, reason_code, policy_version)
       VALUES ($1, 'payment_proof_review', 'ocr', 'payment_proof', 'rule', 'v1', 'read', 'ok', 'v2.0')`,
      [eventId]
    );
    await pool.query(
      `INSERT INTO structured.decisions
         (event_id, workflow, step, subject_kind, decider, rule_version, decision, reason_code, policy_version)
       VALUES ($1, 'payment_proof_review', 'match', 'payment_proof', 'rule', 'v1', 'matched', 'ok', 'v2.0')`,
      [eventId]
    );

    const response = await app.inject({
      method: 'GET',
      url: `/audit-log?event=${eventId}`,
      headers: { authorization: basicAuth('admin', ADMIN_PASSWORD) },
    });

    expect(response.body).toContain('2단계');
    expect(response.body).toContain('ocr');
    expect(response.body).toContain('match');
  });

  it('감사 로그는 사건 id 형식이 아니면 검색을 거절한다', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/audit-log?event=<script>alert(1)</script>',
      headers: { authorization: basicAuth('admin', ADMIN_PASSWORD) },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain('<script>alert');
    expect(response.body).toContain('형식이 아니에요');
  });

  it('사용자는 가입 대기 계정을 활성으로 세지 않는다', async () => {
    await pool.query(`INSERT INTO structured.users DEFAULT VALUES`);

    const response = await app.inject({
      method: 'GET',
      url: '/users',
      headers: { authorization: basicAuth('admin', ADMIN_PASSWORD) },
    });

    expect(response.body).toContain('<div class="label">활성</div><div class="value">0</div>');
    expect(response.body).toContain('<div class="label">가입 대기</div><div class="value">1</div>');
  });
});
