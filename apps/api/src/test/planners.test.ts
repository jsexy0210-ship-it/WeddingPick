import { PRICING_POLICY, productKey } from '@weddingpick/domain';

import { createTestApp, createWedding, markAllPiiReviewed, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

async function createPlanner(input: {
  name: string;
  regions?: string[];
  listing?: 'private' | 'public' | 'withdrawn';
  source?: string;
  vendorId?: string;
}) {
  const listing = input.listing ?? 'public';

  const { rows } = await test.pool.query<{ id: string }>(
    `INSERT INTO structured.planners
       (name, regions, vendor_id, listing_status, listing_source, listed_at, withdrawn_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.name,
      input.regions ?? ['서울'],
      input.vendorId ?? null,
      listing,
      listing === 'public' ? (input.source ?? 'public_data') : null,
      listing === 'public' ? new Date() : null,
      listing === 'withdrawn' ? new Date() : null,
    ]
  );

  return rows[0]!.id;
}

async function search(headers: Record<string, string>, query = '') {
  const response = await test.app.inject({
    method: 'GET',
    url: `/v1/planners${query}`,
    headers,
  });

  expect(response.statusCode).toBe(200);

  return response.json();
}

describeWithDb('플래너 검색', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('로그인 없이 검색할 수 있다', async () => {
    // Level 1. 공개 근거가 있는 플래너만 나오는 것은 뷰가 막는다 — 로그인은
    // 그 잠금과 아무 상관이 없었다.
    const response = await test.app.inject({ method: 'GET', url: '/v1/planners' });

    expect(response.statusCode).toBe(200);
  });

  it('공개 근거가 없는 플래너는 검색에 나오지 않는다', async () => {
    const { headers } = await signInAs(test);
    await createPlanner({ name: '공개플래너', listing: 'public' });
    await createPlanner({ name: '비공개플래너', listing: 'private' });

    const body = await search(headers);

    // 견적서에서 읽어낸 이름은 검색 목록에 오르지 않는다. 이 앱이 지켜야 할 선이다.
    expect(body.planners.map((p: { name: string }) => p.name)).toEqual(['공개플래너']);
  });

  it('기본값은 비공개다', async () => {
    const { headers } = await signInAs(test);

    // 컬럼 기본값에만 기대어 넣는다 — 넣는 쪽이 잊어도 공개되지 않아야 한다.
    await test.pool.query(`INSERT INTO structured.planners (name) VALUES ('기본값플래너')`);

    expect((await search(headers)).planners).toHaveLength(0);
  });

  it('AI 추출을 근거로는 공개할 수 없다', async () => {
    await expect(
      test.pool.query(
        `INSERT INTO structured.planners (name, listing_status, listing_source, listed_at)
         VALUES ('추출플래너', 'public', 'ai_extraction', now())`
      )
    ).rejects.toThrow(/public_listing_has_basis/);
  });

  it('근거 없이 공개할 수 없다', async () => {
    await expect(
      test.pool.query(
        `INSERT INTO structured.planners (name, listing_status) VALUES ('근거없음', 'public')`
      )
    ).rejects.toThrow(/public_listing_has_basis/);
  });

  it('내려달라고 한 사람은 다시 공개되지 않는다', async () => {
    const plannerId = await createPlanner({ name: '내려간플래너', listing: 'withdrawn' });

    // 공개 자료를 다시 가져오는 작업이 되살리는 일이 없어야 한다.
    await expect(
      test.pool.query(
        `UPDATE structured.planners
         SET listing_status = 'public', listing_source = 'public_data', listed_at = now(),
             withdrawn_at = NULL
         WHERE id = $1`,
        [plannerId]
      )
    ).rejects.toThrow(/다시 공개할 수 없다/);
  });

  it('내려간 플래너는 검색과 상세 모두에서 사라진다', async () => {
    const { headers } = await signInAs(test);
    const plannerId = await createPlanner({ name: '내려간플래너', listing: 'withdrawn' });

    expect((await search(headers)).planners).toHaveLength(0);

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/planners/${plannerId}`,
      headers,
    });

    // "있지만 안 보여준다"와 "없다"를 구분해주지 않는다.
    expect(response.statusCode).toBe(404);
  });

  it('왜 검색에 나오는지 함께 알려준다', async () => {
    const { headers } = await signInAs(test);
    await createPlanner({ name: '공개자료플래너', source: 'public_data' });
    await createPlanner({ name: '업체밝힘플래너', source: 'vendor_official' });

    const body = await search(headers);
    const byName = Object.fromEntries(
      body.planners.map((p: { name: string; listingBasis: string }) => [p.name, p.listingBasis])
    );

    expect(byName['공개자료플래너']).toContain('공개된 자료');
    expect(byName['업체밝힘플래너']).toContain('소속 업체나 본인');
  });

  it('내려달라고 할 방법을 결과와 함께 보낸다', async () => {
    const { headers } = await signInAs(test);
    await createPlanner({ name: '공개플래너' });

    const body = await search(headers);

    expect(body.withdrawalNotice).toContain('원하지 않으시면');
  });

  it('표기가 달라도 찾고 지역으로 좁힌다', async () => {
    const { headers } = await signInAs(test);
    await createPlanner({ name: '김 수 진', regions: ['서울', '경기'] });
    await createPlanner({ name: '박민호', regions: ['부산'] });

    expect((await search(headers, '?q=' + encodeURIComponent('김수진'))).planners).toHaveLength(1);
    expect(
      (await search(headers, '?region=' + encodeURIComponent('경기'))).planners.map(
        (p: { name: string }) => p.name
      )
    ).toEqual(['김 수 진']);
  });

  it('플래너가 있는 지역만 필터로 준다', async () => {
    const { headers } = await signInAs(test);
    await createPlanner({ name: '가플래너', regions: ['서울', '경기'] });
    await createPlanner({ name: '나플래너', regions: ['서울'] });
    // 비공개인 사람의 활동 지역은 필터에도 새어나가지 않아야 한다.
    await createPlanner({ name: '다플래너', regions: ['부산'], listing: 'private' });

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/planners/regions',
      headers,
    });

    expect(response.json().regions).toEqual([
      { name: '경기', plannerCount: 1 },
      { name: '서울', plannerCount: 2 },
    ]);
  });

  it('프리랜서는 소속이 없다', async () => {
    const { headers } = await signInAs(test);
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (category, name, region, source)
       VALUES ('planner_agency', '가나플래닝', '서울 강남구', 'public_data') RETURNING id`
    );

    await createPlanner({ name: '소속플래너', vendorId: rows[0]!.id });
    await createPlanner({ name: '프리랜서플래너' });

    const body = await search(headers);
    const byName = Object.fromEntries(
      body.planners.map((p: { name: string; vendor: { name: string } | null }) => [
        p.name,
        p.vendor?.name ?? null,
      ])
    );

    // 사업계획서 11번: 플래너는 업체 부속정보가 아니다.
    expect(byName['소속플래너']).toBe('가나플래닝');
    expect(byName['프리랜서플래너']).toBeNull();
  });
});

describeWithDb('플래너 상세', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('비공개 플래너의 상세는 볼 수 없다', async () => {
    const { headers } = await signInAs(test);
    const plannerId = await createPlanner({ name: '비공개플래너', listing: 'private' });

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/planners/${plannerId}`,
      headers,
    });

    expect(response.statusCode).toBe(404);
  });

  it('표본이 모이면 상품별 분포를 준다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);
    const plannerId = await createPlanner({ name: '표본있는플래너' });

    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (category, name, region, source)
       VALUES ('hall', '가나홀', '서울 강남구', 'public_data') RETURNING id`
    );
    const vendorId = rows[0]!.id;

    for (let i = 0; i < PRICING_POLICY.minimumSampleCount; i += 1) {
      await test.pool.query(
        `INSERT INTO structured.quotes
           (wedding_id, doc_type, vendor_id, planner_id, product_name, product_key,
            total_amount, contract_date, verification_level, source, confirmed_at)
         VALUES ($1, 'contract', $2, $3, '그랜드볼룸', $4, $5, '2026-06-01', 'L2',
                 'contract_verified', now())`,
        [
          weddingId,
          vendorId,
          plannerId,
          productKey({ vendorId, productName: '그랜드볼룸' }),
          20_000_000 + i * 1_000_000,
        ]
      );
    }

    // 서비스정책서 4번: 개인정보 재검토를 받아야 비교에 잡힌다.
    await markAllPiiReviewed(test);

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/planners/${plannerId}`,
      headers,
    });

    const body = response.json();

    expect(body.comparableQuoteCount).toBe(PRICING_POLICY.minimumSampleCount);
    expect(body.products[0].productLabel).toBe('그랜드볼룸');
    expect(body.products[0].stat.median).toBe(22_000_000);
    expect(body.products[0].stat.minVerificationLevel).toBe('L2');
  });

  it('표본이 모자라면 상품을 내려보내지 않는다', async () => {
    const { headers } = await signInAs(test);
    const plannerId = await createPlanner({ name: '표본없는플래너' });

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/planners/${plannerId}`,
      headers,
    });

    expect(response.json().products).toEqual([]);
    expect(response.json().withdrawalNotice).toBeTruthy();
  });
});
