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
    await client.query(
      'TRUNCATE structured.decisions, structured.users, structured.vendors, structured.import_runs CASCADE'
    );
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

  it('데이터 처리 현황은 임포트 실행과 오류를 보여준다', async () => {
    const run = await pool.query<{ id: string }>(
      `INSERT INTO structured.import_runs
         (source_key, category, status, total_rows, created_count, error_count, finished_at)
       VALUES ('localdata', 'hall', 'completed', 10, 8, 1, now())
       RETURNING id`
    );

    await pool.query(
      `INSERT INTO structured.import_errors (run_id, vendor_name, error_type, error_message)
       VALUES ($1, '가온예식홀', 'validation_error', '지역 값이 비어 있음')`,
      [run.rows[0]!.id]
    );

    const response = await app.inject({
      method: 'GET',
      url: '/data-import',
      headers: { authorization: basicAuth('admin', ADMIN_PASSWORD) },
    });

    expect(response.body).toContain('localdata');
    expect(response.body).toContain('가온예식홀');
    expect(response.body).toContain('지역 값이 비어 있음');
  });

  it('가격통계는 업체별 통계를 보여준다', async () => {
    const vendor = await pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (category, name, region, source)
       VALUES ('hall', '가온예식홀', '서울', 'public_data') RETURNING id`
    );

    await pool.query(
      `INSERT INTO stats.price_stats
         (vendor_id, product_key, doc_type, sample_count, period_start, period_end,
          median, p25, p75, p90, min_verification_level)
       VALUES ($1, '홀-기본패키지', 'contract', 12, '2026-01-01', '2026-06-30',
               10000000, 9000000, 11000000, 12000000, 'L2')`,
      [vendor.rows[0]!.id]
    );

    const response = await app.inject({
      method: 'GET',
      url: '/price-stats',
      headers: { authorization: basicAuth('admin', ADMIN_PASSWORD) },
    });

    expect(response.body).toContain('가온예식홀');
    expect(response.body).toContain('12건');
  });

  it('업체 관리는 폐업 전환과 변경 이력을 보여준다', async () => {
    const vendor = await pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (category, name, region, source, is_active, closed_at)
       VALUES ('hall', '문닫은홀', '서울', 'public_data', false, now()) RETURNING id`
    );

    await pool.query(
      `INSERT INTO structured.vendor_change_log (vendor_id, field_name, old_value, new_value, cause)
       VALUES ($1, 'name', '옛이름홀', '문닫은홀', 'admin')`,
      [vendor.rows[0]!.id]
    );

    const response = await app.inject({
      method: 'GET',
      url: '/vendors',
      headers: { authorization: basicAuth('admin', ADMIN_PASSWORD) },
    });

    expect(response.body).toContain('문닫은홀');
    expect(response.body).toContain('옛이름홀');
  });

  it('이미지 자동수급은 검증 상태별로 보여준다', async () => {
    const vendor = await pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (category, name, region, source)
       VALUES ('hall', '이미지홀', '서울', 'public_data') RETURNING id`
    );

    await pool.query(
      `INSERT INTO structured.vendor_images
         (vendor_id, source_url, copyright_basis, match_confidence, status, rejection_reason)
       VALUES ($1, 'https://example.com/a.jpg', 'unknown', 0.4, 'rights_rejected', '저작권 불명확')`,
      [vendor.rows[0]!.id]
    );

    const response = await app.inject({
      method: 'GET',
      url: '/images',
      headers: { authorization: basicAuth('admin', ADMIN_PASSWORD) },
    });

    expect(response.body).toContain('이미지홀');
    expect(response.body).toContain('저작권 불명확');
  });

  it('VOC는 처리 대기 문의를 보여준다', async () => {
    await pool.query(
      `INSERT INTO structured.inquiries (category, body, status, contact)
       VALUES ('other', repeat('문의 내용 ', 5), 'received', 'user@example.com')`
    );

    const response = await app.inject({
      method: 'GET',
      url: '/voc',
      headers: { authorization: basicAuth('admin', ADMIN_PASSWORD) },
    });

    expect(response.body).toContain('처리 대기 문의');
    expect(response.body).not.toContain('처리할 문의가 없어요');
  });

  it('후기·반론은 미결 신고를 보여준다', async () => {
    const vendor = await pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (category, name, region, source)
       VALUES ('hall', '신고받은홀', '서울', 'public_data') RETURNING id`
    );
    const author = await pool.query<{ id: string }>('INSERT INTO structured.users DEFAULT VALUES RETURNING id');
    const review = await pool.query<{ id: string }>(
      `INSERT INTO structured.reviews (vendor_id, author_user_id, role, overall, title, body)
       VALUES ($1, $2, 'contractor', 2, '제목', repeat('가', 60)) RETURNING id`,
      [vendor.rows[0]!.id, author.rows[0]!.id]
    );
    const reporter = await pool.query<{ id: string }>('INSERT INTO structured.users DEFAULT VALUES RETURNING id');

    await pool.query(
      `INSERT INTO structured.review_reports (review_id, reporter_user_id, reason)
       VALUES ($1, $2, 'false_content')`,
      [review.rows[0]!.id, reporter.rows[0]!.id]
    );

    const response = await app.inject({
      method: 'GET',
      url: '/reviews',
      headers: { authorization: basicAuth('admin', ADMIN_PASSWORD) },
    });

    expect(response.body).toContain('신고받은홀');
  });

  it('업체 문의 큐는 관계자 인증 신청을 보여준다', async () => {
    const vendor = await pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (category, name, region, source)
       VALUES ('hall', '인증대기홀', '서울', 'public_data') RETURNING id`
    );
    const claimant = await pool.query<{ id: string }>('INSERT INTO structured.users DEFAULT VALUES RETURNING id');

    await pool.query(
      `INSERT INTO structured.vendor_claims (vendor_id, claimant_user_id, claimed_role, method, contact_email)
       VALUES ($1, $2, '예약팀장', 'official_domain_email', 'a@example.com')`,
      [vendor.rows[0]!.id, claimant.rows[0]!.id]
    );

    const response = await app.inject({
      method: 'GET',
      url: '/vendor-inquiries',
      headers: { authorization: basicAuth('admin', ADMIN_PASSWORD) },
    });

    expect(response.body).toContain('인증대기홀');
    expect(response.body).toContain('예약팀장');
  });

  it('캠페인·보상은 지급 상태별로 집계한다', async () => {
    const user = await pool.query<{ id: string }>('INSERT INTO structured.users DEFAULT VALUES RETURNING id');
    const promotion = await pool.query<{ id: string }>(
      `INSERT INTO structured.promotion_submissions (user_id, url)
       VALUES ($1, 'https://blog.example.com/post-1') RETURNING id`,
      [user.rows[0]!.id]
    );

    await pool.query(
      `INSERT INTO structured.reward_grants (user_id, kind, amount_krw, status, reason_code, promotion_id)
       VALUES ($1, 'promotion', 3000, 'held', 'promotion_submitted', $2)`,
      [user.rows[0]!.id, promotion.rows[0]!.id]
    );

    const response = await app.inject({
      method: 'GET',
      url: '/rewards',
      headers: { authorization: basicAuth('admin', ADMIN_PASSWORD) },
    });

    expect(response.body).toContain('홍보인증');
    expect(response.body).toContain('3,000원');
  });

  it('AI 사용량·비용은 이번 달 예산 상태를 보여준다', async () => {
    await pool.query(
      `INSERT INTO structured.ai_usage
         (feature, model, input_tokens, output_tokens, estimated_cost_usd, succeeded)
       VALUES ('payment_proof_vision', 'claude-haiku-4-5', 1200, 300, 0.015, true)`
    );

    const response = await app.inject({
      method: 'GET',
      url: '/ai-cost',
      headers: { authorization: basicAuth('admin', ADMIN_PASSWORD) },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('AI 사용량·비용');
  });
});
