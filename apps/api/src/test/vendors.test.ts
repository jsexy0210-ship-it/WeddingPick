import { PRICING_POLICY, productKey } from '@weddingpick/domain';

import { createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

async function createVendor(input: {
  name: string;
  region?: string;
  category?: string;
  source?: string;
}) {
  const { rows } = await test.pool.query<{ id: string }>(
    `INSERT INTO structured.vendors (category, name, region, source)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [input.category ?? 'hall', input.name, input.region ?? '서울 강남구', input.source ?? 'public_data']
  );

  return rows[0]!.id;
}

/** 비교에 쓸 수 있는 문서 한 건. L2 이상 + 확인 완료여야 뷰에 들어간다. */
async function createComparableQuote(input: {
  weddingId: string;
  vendorId: string;
  productName: string;
  amount: number;
}) {
  await test.pool.query(
    `INSERT INTO structured.quotes
       (wedding_id, doc_type, vendor_id, product_name, product_key, total_amount,
        contract_date, verification_level, source, confirmed_at)
     VALUES ($1, 'contract', $2, $3, $4, $5, '2026-06-01', 'L2',
             'contract_verified', now())`,
    [
      input.weddingId,
      input.vendorId,
      input.productName,
      productKey({ vendorId: input.vendorId, productName: input.productName }),
      input.amount,
    ]
  );
}

async function search(headers: Record<string, string>, query = '') {
  const response = await test.app.inject({
    method: 'GET',
    url: `/v1/vendors${query}`,
    headers,
  });

  expect(response.statusCode).toBe(200);

  return response.json();
}

describeWithDb('업체 검색', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('로그인하지 않으면 검색할 수 없다', async () => {
    const response = await test.app.inject({ method: 'GET', url: '/v1/vendors' });

    expect(response.statusCode).toBe(401);
  });

  it('표기가 달라도 찾는다', async () => {
    const { headers } = await signInAs(test);
    await createVendor({ name: '더 채플 앳 청담' });

    // 사용자는 띄어쓰기를 맞춰 치지 않는다.
    for (const term of ['더채플', '채플 앳', '더-채플·앳']) {
      const body = await search(headers, `?q=${encodeURIComponent(term)}`);
      expect(body.vendors.map((v: { name: string }) => v.name)).toEqual(['더 채플 앳 청담']);
    }
  });

  it('별칭으로도 찾는다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createVendor({ name: '그랜드 컨벤션' });
    await test.pool.query(
      'INSERT INTO structured.vendor_aliases (vendor_id, alias) VALUES ($1, $2)',
      [vendorId, '그랜드홀']
    );

    const body = await search(headers, '?q=' + encodeURIComponent('그랜드홀'));
    expect(body.vendors).toHaveLength(1);
    expect(body.vendors[0].name).toBe('그랜드 컨벤션');
  });

  it('지역과 분류로 좁힌다', async () => {
    const { headers } = await signInAs(test);
    await createVendor({ name: '가나홀', region: '서울 마포구' });
    await createVendor({ name: '다라홀', region: '경기 성남시' });
    await createVendor({ name: '마바스튜디오', region: '서울 마포구', category: 'sdm' });

    const seoul = await search(headers, '?region=' + encodeURIComponent('서울'));
    expect(seoul.vendors.map((v: { name: string }) => v.name)).toEqual(['가나홀', '마바스튜디오']);

    const halls = await search(headers, '?category=hall&region=' + encodeURIComponent('서울'));
    expect(halls.vendors.map((v: { name: string }) => v.name)).toEqual(['가나홀']);
  });

  it('공공데이터에서 온 업체는 출처를 밝힌다', async () => {
    const { headers } = await signInAs(test);
    await createVendor({ name: '아펠가모 공덕', source: 'public_data' });
    await createVendor({ name: '자차카 웨딩', source: 'user_quote' });

    const body = await search(headers);
    const byName = Object.fromEntries(
      body.vendors.map((v: { name: string; sourceNote: string | null }) => [v.name, v.sourceNote])
    );

    expect(byName['아펠가모 공덕']).toContain('행정안전부');
    // 사용자 문서에서만 나온 업체는 밝힐 바깥 출처가 없다.
    expect(byName['자차카 웨딩']).toBeNull();
  });

  it('확인된 계약이 없으면 0으로 보여준다', async () => {
    const { headers } = await signInAs(test);
    await createVendor({ name: '자료없는홀' });

    const body = await search(headers);

    // 숨기지 않는다 — "아직 자료가 없다"도 사용자가 알아야 할 사실이다.
    expect(body.vendors[0].comparableQuoteCount).toBe(0);
  });

  it('확인을 마치지 않은 문서는 세지 않는다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);
    const vendorId = await createVendor({ name: '세는홀' });

    await createComparableQuote({ weddingId, vendorId, productName: '그랜드볼룸', amount: 20000000 });
    // 확인 전 문서. 뷰에 들어가지 않아야 한다.
    await test.pool.query(
      `INSERT INTO structured.quotes
         (wedding_id, doc_type, vendor_id, product_name, product_key, total_amount,
          contract_date, verification_level, source)
       VALUES ($1, 'contract', $2, '그랜드볼룸', $3, 30000000, '2026-06-01', 'L2',
               'contract_verified')`,
      [weddingId, vendorId, `${vendorId}:미확인`]
    );

    const body = await search(headers, '?q=' + encodeURIComponent('세는홀'));
    expect(body.vendors[0].comparableQuoteCount).toBe(1);
  });

  it('이름 순으로 나누어 준다', async () => {
    const { headers } = await signInAs(test);
    for (const name of ['가홀', '나홀', '다홀']) {
      await createVendor({ name });
    }

    const first = await search(headers, '?limit=2');
    expect(first.vendors.map((v: { name: string }) => v.name)).toEqual(['가홀', '나홀']);
    expect(first.nextCursor).not.toBeNull();

    const second = await search(headers, `?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`);
    expect(second.vendors.map((v: { name: string }) => v.name)).toEqual(['다홀']);
    // 마지막 쪽에서는 빈 쪽을 한 번 더 부르게 하지 않는다.
    expect(second.nextCursor).toBeNull();
  });

  it('망가진 커서는 첫 쪽으로 되돌린다', async () => {
    const { headers } = await signInAs(test);
    await createVendor({ name: '가홀' });

    const body = await search(headers, '?cursor=not-a-cursor');
    expect(body.vendors).toHaveLength(1);
  });

  it('있는 지역만 필터로 준다', async () => {
    const { headers } = await signInAs(test);
    await createVendor({ name: '가홀', region: '서울 마포구' });
    await createVendor({ name: '나홀', region: '서울 강남구' });
    await createVendor({ name: '다홀', region: '경기 성남시' });

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/vendors/regions',
      headers,
    });

    // 눌러도 아무것도 나오지 않는 필터를 만들지 않는다.
    expect(response.json().regions).toEqual([
      { name: '경기', vendorCount: 1 },
      { name: '서울', vendorCount: 2 },
    ]);
  });
});

describeWithDb('업체 상세', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('없는 업체는 404다', async () => {
    const { headers } = await signInAs(test);
    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${crypto.randomUUID()}`,
      headers,
    });

    expect(response.statusCode).toBe(404);
  });

  it('표본이 모자란 상품은 내려보내지 않는다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);
    const vendorId = await createVendor({ name: '표본부족홀' });

    for (let i = 0; i < PRICING_POLICY.minimumSampleCount - 1; i += 1) {
      await createComparableQuote({
        weddingId,
        vendorId,
        productName: '그랜드볼룸',
        amount: 20_000_000 + i * 100_000,
      });
    }

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}`,
      headers,
    });

    // 중앙값 없는 상품 이름만 늘어놓으면 화면이 그걸 가격으로 그린다.
    expect(response.json().products).toEqual([]);
    expect(response.json().comparableQuoteCount).toBe(PRICING_POLICY.minimumSampleCount - 1);
  });

  it('표본이 모이면 상품 이름과 함께 분포를 준다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);
    const vendorId = await createVendor({ name: '표본있는홀' });

    for (let i = 0; i < PRICING_POLICY.minimumSampleCount; i += 1) {
      await createComparableQuote({
        weddingId,
        vendorId,
        productName: '그랜드볼룸',
        amount: 20_000_000 + i * 1_000_000,
      });
    }

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}`,
      headers,
    });

    const [product] = response.json().products;

    // 내부 키가 아니라 사람이 읽는 이름이어야 한다.
    expect(product.productLabel).toBe('그랜드볼룸');
    expect(product.stat.median).toBe(22_000_000);
    // 사업계획서 9번: 표본 수와 기준 기간은 늘 중앙값과 함께 나간다.
    expect(product.stat.sampleCount).toBe(PRICING_POLICY.minimumSampleCount);
    expect(product.stat.periodStart).toBe('2026-06-01');
    expect(product.stat.minVerificationLevel).toBe('L2');
  });
});
