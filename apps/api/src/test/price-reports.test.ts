import { PRICING_POLICY } from '@weddingpick/domain';

import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 제보는 콜드 스타트를 넘기 위한 것이다. 문서 없이 받으므로 **시장 대표가격에
 * 들어가지 않는다**(서비스정책서 2번). 그 경계가 지켜지는지를 여기서 지킨다.
 */
describeWithDb('가격 제보', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function createVendor() {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ('가온예식홀', 'hall', '서울', 'public_data') RETURNING id`
    );

    return rows[0]!.id;
  }

  async function report(
    headers: Record<string, string>,
    vendorId: string,
    over: Record<string, unknown> = {}
  ) {
    return await test.app.inject({
      method: 'POST',
      url: '/v1/price-reports',
      headers,
      payload: {
        vendorId,
        productName: '그랜드볼룸',
        totalAmount: 29_000_000,
        contractedOn: '2026-05',
        ...over,
      },
    });
  }

  it('문서 없이 받는다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createVendor();

    const response = await report(headers, vendorId);

    expect(response.statusCode).toBe(201);
    // 무엇을 낸 것인지 화면이 그대로 보여줄 문구가 함께 온다.
    expect(response.json<{ caveat: string }>().caveat).toContain('문서로 확인하지 않았습니다');
  });

  it('제보는 시장 대표가격에 들어가지 않는다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createVendor();

    for (let index = 0; index < PRICING_POLICY.minimumSampleCount + 2; index += 1) {
      const other = await signInAs(test, `reporter-${index}`);

      await report(other.headers, vendorId, { totalAmount: 28_000_000 + index * 500_000 });
    }

    // 제보가 최소 표본을 넘겼어도 계약 중앙값 표본은 그대로 0이다.
    const comparable = await test.pool.query('SELECT 1 FROM structured.comparable_quotes');

    expect(comparable.rows).toHaveLength(0);

    const detail = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}`,
      headers,
    });
    const body = detail.json<{
      products: unknown[];
      reportedPrice: { available: boolean; median?: number; count?: number };
    }>();

    // 계약 중앙값은 없고, 제보는 따로 나온다.
    expect(body.products).toHaveLength(0);
    expect(body.reportedPrice.available).toBe(true);
    expect(body.reportedPrice.count).toBe(PRICING_POLICY.minimumSampleCount + 2);
  });

  it('제보도 표본이 모자라면 숫자를 만들지 않는다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createVendor();

    await report(headers, vendorId);

    const detail = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}`,
      headers,
    });
    const body = detail.json<{ reportedPrice: { available: boolean; reason?: string } }>();

    // 제보라고 기준을 낮추면 신뢰도가 낮은 쪽이 더 쉽게 숫자를 만들게 된다.
    expect(body.reportedPrice.available).toBe(false);
    expect(body.reportedPrice.reason).toContain(`${PRICING_POLICY.minimumSampleCount}건이`);
  });

  it('자릿수를 잘못 적으면 받지 않는다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createVendor();

    // 만원 단위로 적은 것이 원으로 읽히면 중앙값이 크게 흔들린다.
    const response = await report(headers, vendorId, { totalAmount: 3200 });

    expect(response.statusCode).toBe(400);
  });

  it('한 사람이 같은 상품에 두 번 넣을 수 없다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createVendor();

    await report(headers, vendorId);
    const second = await report(headers, vendorId, { totalAmount: 31_000_000 });

    // 여러 번 넣으면 중앙값을 끌 수 있다.
    expect(second.statusCode).toBe(400);
    expect(second.json<{ error: { message: string } }>().error.message).toContain('이미 제보');
  });

  it('계약 연월이 없으면 받지 않는다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createVendor();

    // 가격은 시점에 따라 달라진다. 언제인지 모르는 값은 비교에 쓸 수 없다.
    const response = await report(headers, vendorId, { contractedOn: '2026' });

    expect(response.statusCode).toBe(400);
  });

  it('없는 업체에는 제보할 수 없다', async () => {
    const { headers } = await signInAs(test);

    const response = await report(headers, '00000000-0000-0000-0000-000000000000');

    expect(response.statusCode).toBe(404);
  });
});
