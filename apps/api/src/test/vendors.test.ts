import { MAX_COMPARED_VENDORS, PRICING_POLICY, productKey } from '@weddingpick/domain';

import {
  createTestApp,
  createWedding,
  markAllPiiReviewed,
  resetDatabase,
  signInAs,
  signInUnlocked,
  type TestApp,
} from './helpers';

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

  // 서비스정책서 4번: 개인정보 재검토를 받아야 비교에 잡힌다.
  await markAllPiiReviewed(test);
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

  it('로그인 없이 검색할 수 있다', async () => {
    // 사업계획서 v3 7번 Level 1. 무엇을 주는 서비스인지 보기도 전에 계정을
    // 만들라고 하지 않는다.
    await createVendor({ name: '누구나보는홀' });

    const response = await test.app.inject({ method: 'GET', url: '/v1/vendors' });

    expect(response.statusCode).toBe(200);
    expect(response.json().vendors).toHaveLength(1);
  });

  it('망가진 토큰은 조용히 비로그인으로 떨어지지 않는다', async () => {
    // 만료된 토큰을 든 사람에게 남의 화면을 보여주면, 그 사람은 로그인한 줄 안다.
    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/vendors',
      headers: { authorization: 'Bearer 이건아닌토큰' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('로그인하지 않아도 가격이 잠기지 않는다', async () => {
    /*
     * 최종통합정책 v2.0 K-6이 "결제인증 회원만 실제 결제 데이터 접근"을 폐기했다.
     * 무엇을 보여줄지는 이제 사람이 아니라 데이터 수가 정한다.
     */
    const vendorId = await createVendor({ name: '열린홀' });

    const response = await test.app.inject({ method: 'GET', url: `/v1/vendors/${vendorId}` });

    const prices = response.json().prices;

    // 잠긴 상태를 표현할 필드 자체가 없다.
    expect(prices.available).toBeUndefined();
    expect(prices.paidPrice.stage).toBe('collecting');
    // 자료가 없다는 사실은 말해준다. 빈칸으로 두지 않는다.
    expect(prices.paidPrice.caption).toContain('수집 중');
  });

  it('결제인증을 낸 사람에게는 깊이가 열린다', async () => {
    // 구간이 아니라 깊이다 — 조건이 비슷한 사례와 상세 분석(D-1).
    const vendorId = await createVendor({ name: '열린홀' });
    const guest = await test.app.inject({ method: 'GET', url: `/v1/vendors/${vendorId}` });

    expect(guest.json().prices.deepData).toBe(false);
    // 아직이면 어떻게 열리는지 말해준다.
    expect(guest.json().prices.deepDataNote).toBeTruthy();

    const { headers } = await signInUnlocked(test);
    const member = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}`,
      headers,
    });

    expect(member.json().prices.deepData).toBe(true);
    // 이미 한 일을 다시 권하지 않는다.
    expect(member.json().prices.deepDataNote).toBeNull();
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
    const { headers } = await signInUnlocked(test);
    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${crypto.randomUUID()}`,
      headers,
    });

    expect(response.statusCode).toBe(404);
  });

  it('표본이 모자란 상품은 내려보내지 않는다', async () => {
    const { headers } = await signInUnlocked(test);
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
    expect(response.json().prices.products).toEqual([]);
    expect(response.json().comparableQuoteCount).toBe(PRICING_POLICY.minimumSampleCount - 1);
  });

  it('표본이 모이면 상품 이름과 함께 분포를 준다', async () => {
    const { headers } = await signInUnlocked(test);
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

    const [product] = response.json().prices.products;

    // 내부 키가 아니라 사람이 읽는 이름이어야 한다.
    expect(product.productLabel).toBe('그랜드볼룸');
    expect(product.stat.median).toBe(22_000_000);
    // 사업계획서 9번: 표본 수와 기준 기간은 늘 중앙값과 함께 나간다.
    expect(product.stat.sampleCount).toBe(PRICING_POLICY.minimumSampleCount);
    expect(product.stat.periodStart).toBe('2026-06-01');
    expect(product.stat.minVerificationLevel).toBe('L2');
  });
});

describeWithDb('업체 비교', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function compare(headers: Record<string, string>, ids: string[]) {
    return test.app.inject({
      method: 'GET',
      url: `/v1/vendors/compare?ids=${ids.join(',')}`,
      headers,
    });
  }

  it('한 곳만으로는 비교할 수 없다', async () => {
    const { headers } = await signInUnlocked(test);
    const vendorId = await createVendor({ name: '가홀' });

    const response = await compare(headers, [vendorId]);

    expect(response.statusCode).toBe(400);
  });

  it('같은 업체를 두 번 골라 두 곳을 만들 수 없다', async () => {
    const { headers } = await signInUnlocked(test);
    const vendorId = await createVendor({ name: '가홀' });

    const response = await compare(headers, [vendorId, vendorId]);

    expect(response.statusCode).toBe(400);
  });

  it('세 곳을 넘기면 막는다', async () => {
    const { headers } = await signInUnlocked(test);
    const ids = [];

    for (const name of ['가홀', '나홀', '다홀', '라홀']) {
      ids.push(await createVendor({ name }));
    }

    const response = await compare(headers, ids);

    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toContain(`${MAX_COMPARED_VENDORS}곳`);
  });

  it('금액만으로 비교할 수 없다는 말이 결과에 함께 나간다', async () => {
    const { headers } = await signInUnlocked(test);
    const a = await createVendor({ name: '가홀' });
    const b = await createVendor({ name: '나홀' });

    const body = (await compare(headers, [a, b])).json();

    // 표만 그리고 이 말을 빠뜨리면 우리가 만든 표가 오해를 부추긴다. 사업계획서 2번.
    expect(body.caveats.at(-1)).toContain('금액만으로는 비교하기 어렵습니다');
  });

  it('분류와 지역이 섞이면 알려준다', async () => {
    const { headers } = await signInUnlocked(test);
    const a = await createVendor({ name: '가홀', region: '서울 마포구', category: 'hall' });
    const b = await createVendor({ name: '나스냅', region: '경기 성남시', category: 'snap' });

    const body = (await compare(headers, [a, b])).json();

    expect(body.caveats.some((note: string) => note.includes('분류가 다른'))).toBe(true);
    expect(body.caveats.some((note: string) => note.includes('지역이 다릅니다'))).toBe(true);
  });

  it('가격을 견줄 수 있는 곳과 없는 곳을 함께 보여준다', async () => {
    const { headers } = await signInUnlocked(test);
    const weddingId = await createWedding(test, headers);
    const withData = await createVendor({ name: '자료있는홀' });
    const withoutData = await createVendor({ name: '자료없는홀' });

    for (let i = 0; i < PRICING_POLICY.minimumSampleCount; i += 1) {
      await createComparableQuote({
        weddingId,
        vendorId: withData,
        productName: '그랜드볼룸',
        amount: 20_000_000 + i * 1_000_000,
      });
    }

    const body = (await compare(headers, [withData, withoutData])).json();
    const byName = Object.fromEntries(
      body.vendors.map((v: { name: string; prices: { products: unknown[] } }) => [
        v.name,
        v.prices.products.length,
      ])
    );

    expect(byName['자료있는홀']).toBe(1);
    expect(byName['자료없는홀']).toBe(0);
    // 자료가 없는 것이 싸다는 뜻으로 읽히지 않게 한다.
    expect(body.caveats.some((note: string) => note.includes('싸거나 비싸다는 뜻이 아닙니다'))).toBe(
      true
    );
  });

  it('없는 업체가 섞이면 404다', async () => {
    const { headers } = await signInUnlocked(test);
    const vendorId = await createVendor({ name: '가홀' });

    const response = await compare(headers, [vendorId, crypto.randomUUID()]);

    expect(response.statusCode).toBe(404);
  });
});
