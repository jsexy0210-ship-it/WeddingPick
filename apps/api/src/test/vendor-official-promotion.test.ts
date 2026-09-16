import { decide } from '../vendor-claim-admin';
import { countOfficialVendors } from '../vendor-admin';
import { adminSession, createTestApp, resetDatabase, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 승인이 업체의 출처 표시를 올린다.
 *
 * 2026-09-15 대표 지시 — 「앱은 업체 공식인증 완료된것만 나오게할거고 공공데이터는
 * 웹사이트로 분류할것이다」. 그러려면 먼저 「공식인증됐다」가 DB에 적혀 있어야 하는데,
 * 지금까지 승인 표(0038)와 `vendors.source`가 이어져 있지 않았다 — 승인해도 업체는
 * `public_data`인 채였다.
 *
 * **화면은 아직 아무것도 자르지 않는다**(2026-09-16 대표 지시 — 「일단 화면은 냅두고
 * 백 작업만 실행해」). 여기서 보는 것은 서버가 사실을 적는가뿐이다.
 */
describeWithDb('관계자 인증 승인 — 출처 승격', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function operator(): Promise<string> {
    const session = await adminSession(test, 'operator');
    await test.pool.query('UPDATE structured.users SET is_operator = true WHERE id = $1', [
      session.userId,
    ]);
    return session.userId;
  }

  async function claimant(): Promise<string> {
    const { rows } = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
    );
    return rows[0]!.id;
  }

  async function makeVendor(name: string, source = 'public_data'): Promise<string> {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ($1, 'studio'::vendor_category, '서울', $2::source_type) RETURNING id`,
      [name, source]
    );
    return rows[0]!.id;
  }

  async function makeClaim(vendorId: string, userId: string): Promise<string> {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendor_claims
         (vendor_id, claimant_user_id, claimed_role, method, contact_email)
       VALUES ($1, $2, '실장', 'official_domain_email', 'someone@example.com')
       RETURNING id`,
      [vendorId, userId]
    );
    return rows[0]!.id;
  }

  const sourceOf = async (vendorId: string): Promise<string> => {
    const { rows } = await test.pool.query<{ source: string }>(
      'SELECT source::text AS source FROM structured.vendors WHERE id = $1',
      [vendorId]
    );
    return rows[0]!.source;
  };

  it('승인하면 업체 출처가 vendor_official로 오른다', async () => {
    const vendorId = await makeVendor('강남 A 스튜디오');
    const claimId = await makeClaim(vendorId, await claimant());

    await decide(test.pool, claimId, 'approved', await operator(), '공식 도메인 주소로 회신 확인');

    expect(await sourceOf(vendorId)).toBe('vendor_official');
  });

  it('반려는 출처를 건드리지 않는다', async () => {
    const vendorId = await makeVendor('강남 B 스튜디오');
    const claimId = await makeClaim(vendorId, await claimant());

    await decide(test.pool, claimId, 'rejected', await operator(), '연락이 닿지 않았다');

    expect(await sourceOf(vendorId)).toBe('public_data');
  });

  /*
   * 한 업체에 관계자가 여럿 승인될 수 있다. 둘째부터는 이미 올라 있으므로 아무것도
   * 하지 않는다 — 안 그러면 승격 기록이 승인 수만큼 쌓이고, 「언제 공식이 됐나」를
   * 물었을 때 답이 여럿이 된다.
   */
  it('이미 vendor_official이면 승격 기록을 다시 남기지 않는다', async () => {
    const vendorId = await makeVendor('강남 C 스튜디오');
    const decider = await operator();

    await decide(test.pool, await makeClaim(vendorId, await claimant()), 'approved', decider, '첫째');
    await decide(test.pool, await makeClaim(vendorId, await claimant()), 'approved', decider, '둘째');

    const { rows } = await test.pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM structured.vendor_change_log
        WHERE vendor_id = $1 AND field_name = 'source'`,
      [vendorId]
    );

    expect(rows[0]!.n).toBe('1');
  });

  /** 누가 · 언제 · 어느 신청 때문인지. 셋이 다 남아야 나중에 따질 수 있다. */
  it('올린 기록에 사람과 신청이 남는다', async () => {
    const vendorId = await makeVendor('강남 D 스튜디오');
    const claimId = await makeClaim(vendorId, await claimant());
    const decider = await operator();

    await decide(test.pool, claimId, 'approved', decider, '회신 확인');

    const { rows: log } = await test.pool.query<{
      old_value: string;
      new_value: string;
      cause: string;
      changed_by: string;
      note: string;
    }>(
      `SELECT old_value, new_value, cause::text AS cause, changed_by, note
         FROM structured.vendor_change_log
        WHERE vendor_id = $1 AND field_name = 'source'`,
      [vendorId]
    );

    expect(log[0]).toMatchObject({
      old_value: 'public_data',
      new_value: 'vendor_official',
      cause: 'claim',
      changed_by: decider,
    });
    expect(log[0]!.note).toContain(claimId);

    const { rows: decisions } = await test.pool.query<{
      actor_user_id: string;
      evidence_refs: { kind: string; id: string }[];
      event_id: string;
    }>(
      `SELECT actor_user_id, evidence_refs, event_id
         FROM structured.decisions
        WHERE workflow = 'vendor_claim' AND step = 'promote_source' AND subject_id = $1`,
      [vendorId]
    );

    expect(decisions).toHaveLength(1);
    expect(decisions[0]!.actor_user_id).toBe(decider);
    expect(decisions[0]!.evidence_refs).toEqual([{ kind: 'vendor_claim', id: claimId }]);

    // 심사 한 줄과 승격 한 줄이 같은 사건으로 묶인다(L장 B-3).
    const { rows: decided } = await test.pool.query<{ event_id: string }>(
      `SELECT event_id FROM structured.decisions
        WHERE workflow = 'vendor_claim' AND step = 'decide' AND subject_id = $1`,
      [claimId]
    );

    expect(decided[0]!.event_id).toBe(decisions[0]!.event_id);
  });
});

/**
 * 몇 곳이 공식인증인지 센다. **어느 것으로 자를지는 아직 안 정했으므로 셋을 따로 센다.**
 *
 * 이 수가 앱 필터를 언제 켤 수 있는지를 정하는 근거다.
 */
describeWithDb('공식인증 업체 수 — 조회만', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function vendor(name: string, source = 'public_data'): Promise<string> {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ($1, 'studio'::vendor_category, '서울', $2::source_type) RETURNING id`,
      [name, source]
    );
    return rows[0]!.id;
  }

  async function approvedClaim(vendorId: string): Promise<void> {
    const { rows } = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
    );

    await test.pool.query(
      `INSERT INTO structured.vendor_claims
         (vendor_id, claimant_user_id, claimed_role, method, contact_email,
          status, decided_at, decided_by)
       VALUES ($1, $2, '실장', 'official_domain_email', 'someone@example.com',
               'approved', now(), $2)`,
      [vendorId, rows[0]!.id]
    );
  }

  const vendorImage = (vendorId: string, basis: string) =>
    test.pool.query(
      `INSERT INTO structured.vendor_images (vendor_id, source_url, copyright_basis)
       VALUES ($1, 'https://example.com/a.jpg', $2::image_copyright_basis)`,
      [vendorId, basis]
    );

  it('셋을 따로 센다. 다는 나를 넘지 않는다', async () => {
    // 아무것도 없는 업체 — 지금 DB의 업체 전부가 이 모양이다.
    await vendor('강남 A 스튜디오');

    // 가만 참: 출처는 올라 있는데 승인 기록이 없다(옛 임포트).
    await vendor('강남 B 스튜디오', 'vendor_official');

    // 나만 참: 승인은 받았는데 아직 사진을 안 줬다.
    await approvedClaim(await vendor('강남 C 스튜디오'));

    // 나 · 다 참.
    const withImage = await vendor('강남 D 스튜디오');
    await approvedClaim(withImage);
    await vendorImage(withImage, 'vendor_provided');

    // 사진은 있지만 승인이 없다 — 다가 아니다.
    await vendorImage(await vendor('강남 E 스튜디오'), 'vendor_provided');

    expect(await countOfficialVendors(test.pool)).toEqual({
      total: 5,
      bySource: 1,
      byApprovedClaim: 2,
      byVendorProvidedImage: 1,
    });
  });

  it('관리자 라우트가 같은 수를 돌려준다', async () => {
    await vendor('강남 F 스튜디오', 'vendor_official');
    const session = await adminSession(test, 'operator');

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/vendors/official-counts',
      headers: session.headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      total: 1,
      bySource: 1,
      byApprovedClaim: 0,
      byVendorProvidedImage: 0,
    });
  });
});
