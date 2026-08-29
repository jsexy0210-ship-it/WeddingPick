import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 업체 관계자 인증. 최종통합정책 v2.0 26·27번.
 *
 * 두 가지를 확인한다 — 여기서 확인되는 것이 없다는 것, 그리고 증빙이 응답으로
 * 새지 않는다는 것.
 */
describeWithDb('업체 관계자 인증', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function aVendor(officialDomain: string | null = 'gaon.co.kr') {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source, official_domain)
       VALUES ('가온예식홀', 'hall', '서울', 'public_data', $1) RETURNING id`,
      [officialDomain]
    );

    return rows[0]!.id;
  }

  async function aDocument(ownerId: string) {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO originals.raw_documents (owner_user_id, page_count)
       VALUES ($1, 1) RETURNING id`,
      [ownerId]
    );

    return rows[0]!.id;
  }

  const submit = (headers: Record<string, string>, payload: Record<string, unknown>) =>
    test.app.inject({ method: 'POST', url: '/v1/vendor-claims', headers, payload });

  it('로그인해야 신청할 수 있다', async () => {
    const response = await submit({}, {
      vendorId: await aVendor(),
      claimedRole: '예약팀장',
      evidence: { method: 'official_domain_email', email: 'yeji@gaon.co.kr' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('공식 도메인이 맞아도 확인 중으로 들어간다', async () => {
    /*
     * 도메인이 같다는 것은 그 회사의 주소라는 뜻이지, 신청한 사람이 그 주소를
     * 쓴다는 뜻이 아니다. 자동 승인이 열리면 남의 회사 도메인을 아는 사람이면
     * 누구나 관계자가 된다.
     */
    const who = await signInAs(test, 'claimant');
    const vendorId = await aVendor();

    const created = await submit(who.headers, {
      vendorId,
      claimedRole: '예약팀장',
      evidence: { method: 'official_domain_email', email: 'yeji@gaon.co.kr' },
    });

    expect(created.statusCode).toBe(201);

    const mine = await test.app.inject({
      method: 'GET',
      url: '/v1/me/vendor-claims',
      headers: who.headers,
    });

    const [claim] = mine.json<{ claims: { status: string; statusLabel: string }[] }>().claims;

    expect(claim?.status).toBe('pending');
    expect(claim?.statusLabel).toBe('확인 중');
  });

  it('신청 응답에 상태를 정할 자리가 없다', async () => {
    const who = await signInAs(test, 'claimant');
    const vendorId = await aVendor();

    // 스키마가 모르는 열쇠는 버린다. 보내도 확인 완료가 되지 않는다.
    await submit(who.headers, {
      vendorId,
      claimedRole: '예약팀장',
      status: 'approved',
      evidence: { method: 'official_domain_email', email: 'yeji@gaon.co.kr' },
    });

    const { rows } = await test.pool.query<{ status: string }>(
      'SELECT status FROM structured.vendor_claims'
    );

    expect(rows[0]?.status).toBe('pending');
  });

  it('공개된 이메일은 어디에 공개돼 있는지를 함께 받는다', async () => {
    const who = await signInAs(test, 'claimant');
    const vendorId = await aVendor();

    const without = await submit(who.headers, {
      vendorId,
      claimedRole: '예약팀장',
      evidence: { method: 'listed_email', email: 'yeji@naver.com' },
    });

    expect(without.statusCode).toBe(400);

    const with_ = await submit(who.headers, {
      vendorId,
      claimedRole: '예약팀장',
      evidence: {
        method: 'listed_email',
        email: 'yeji@naver.com',
        listedAt: '공식 홈페이지 하단 문의처',
      },
    });

    expect(with_.statusCode).toBe(201);
  });

  it('회사 이메일이 없어도 증빙으로 신청할 수 있다', async () => {
    // 원문 26번: 회사 이메일이 없는 소규모 업체를 고려해 대체 수단을 둔다.
    const who = await signInAs(test, 'claimant');
    const vendorId = await aVendor(null);

    const response = await submit(who.headers, {
      vendorId,
      claimedRole: '대표',
      evidence: { method: 'business_document', documentId: await aDocument(who.userId) },
    });

    expect(response.statusCode).toBe(201);
  });

  it('남의 문서를 자기 증빙으로 쓸 수 없다', async () => {
    const owner = await signInAs(test, 'owner');
    const other = await signInAs(test, 'other');
    const vendorId = await aVendor();

    const response = await submit(other.headers, {
      vendorId,
      claimedRole: '대표',
      evidence: { method: 'business_document', documentId: await aDocument(owner.userId) },
    });

    expect(response.statusCode).toBe(404);
  });

  it('확인 중인 신청을 한 업체에 둘 낼 수 없다', async () => {
    const who = await signInAs(test, 'claimant');
    const vendorId = await aVendor();

    await submit(who.headers, {
      vendorId,
      claimedRole: '예약팀장',
      evidence: { method: 'official_domain_email', email: 'yeji@gaon.co.kr' },
    });

    const again = await submit(who.headers, {
      vendorId,
      claimedRole: '예약팀장',
      evidence: { method: 'official_domain_email', email: 'yeji@gaon.co.kr' },
    });

    expect(again.statusCode).toBe(409);
  });

  it('내 신청에도 증빙과 연락처는 나가지 않는다', async () => {
    /*
     * 원문 27번: 일반 사용자에게 원본 공개하지 않음. 응답에 담기지 않으면
     * 화면 어디로도 새지 않는다.
     */
    const who = await signInAs(test, 'claimant');
    const vendorId = await aVendor();

    await submit(who.headers, {
      vendorId,
      claimedRole: '예약팀장',
      evidence: {
        method: 'listed_email',
        email: 'yeji@naver.com',
        listedAt: '공식 홈페이지 하단 문의처',
      },
    });

    const mine = await test.app.inject({
      method: 'GET',
      url: '/v1/me/vendor-claims',
      headers: who.headers,
    });

    expect(mine.body).not.toContain('yeji@naver.com');
    expect(mine.body).not.toContain('공식 홈페이지 하단 문의처');
    expect(mine.json<{ claims: { methodLabel: string }[] }>().claims[0]?.methodLabel).toBe(
      '공개된 이메일'
    );
  });

  it('규칙이 본 것은 사람을 기다리는 줄로 남는다', async () => {
    /*
     * L장: 자동으로 내린 것마다 근거를 남긴다. 다만 이건 결정이 아니라 재료라서
     * pending으로 열려 있고, 그래서 사람이 볼 목록에 오른다.
     */
    const who = await signInAs(test, 'claimant');
    const vendorId = await aVendor();

    await submit(who.headers, {
      vendorId,
      claimedRole: '예약팀장',
      evidence: { method: 'official_domain_email', email: 'yeji@gaon.co.kr' },
    });

    const { rows } = await test.pool.query<{
      decider: string;
      reason_code: string;
      evidence_refs: unknown;
    }>(
      `SELECT decider, reason_code, evidence_refs
       FROM structured.open_decisions WHERE subject_kind = 'vendor_claim'`
    );

    expect(rows[0]?.decider).toBe('rule');
    expect(rows[0]?.reason_code).toBe('domain_matches');
    // 근거는 가리키기만 한다. 이메일 주소가 이 로그에 복사되지 않는다.
    expect(JSON.stringify(rows[0]?.evidence_refs)).not.toContain('yeji');
  });

  it('공식 도메인을 모르면 모른다고 남긴다', async () => {
    const who = await signInAs(test, 'claimant');
    const vendorId = await aVendor(null);

    await submit(who.headers, {
      vendorId,
      claimedRole: '예약팀장',
      evidence: { method: 'official_domain_email', email: 'yeji@gaon.co.kr' },
    });

    const { rows } = await test.pool.query<{ reason_code: string }>(
      `SELECT reason_code FROM structured.decisions WHERE subject_kind = 'vendor_claim'`
    );

    expect(rows[0]?.reason_code).toBe('official_domain_unknown');
  });

  it('없는 업체에는 신청할 수 없다', async () => {
    const who = await signInAs(test, 'claimant');

    const response = await submit(who.headers, {
      vendorId: '00000000-0000-0000-0000-000000000000',
      claimedRole: '예약팀장',
      evidence: { method: 'official_domain_email', email: 'yeji@gaon.co.kr' },
    });

    expect(response.statusCode).toBe(404);
  });
});
