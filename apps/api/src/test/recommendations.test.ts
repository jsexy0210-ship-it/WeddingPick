import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

type Top3Body = {
  region: string | null;
  category: string;
  items: {
    vendorId: string;
    name: string;
    reasons: string[];
    confirmedCount: number;
    paidPrice: { stage: string; count: number; caption: string };
  }[];
  note: string | null;
};

/**
 * TOP3 추천. 통합정책 v3.10 §2.
 *
 * 여기서 지키는 것 셋: 자료가 모자라면 억지로 채우지 않는다, 이유 없는 추천은
 * 없다, 광고비는 순위를 바꾸지 못한다.
 */
describeWithDb('TOP3 추천', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  /**
   * 업체 하나와 확인된 결제 `proofs`건.
   *
   * 확인된 정보는 결제인증에서 센다 — 금액 옆 캡션이 세는 것과 같은 수여야
   * 카드가 자기 말을 뒤집지 않는다. `recent`는 그중 최근 3개월 안에 둘 개수다.
   */
  async function aVendor(input: {
    name: string;
    region?: string;
    proofs: number;
    recent?: number;
    amount?: number;
  }): Promise<string> {
    const vendor = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (category, name, region, source)
       VALUES ('hall', $1, $2, 'public_data') RETURNING id`,
      [input.name, input.region ?? '서울 강남구']
    );
    const vendorId = vendor.rows[0]!.id;
    const recent = input.recent ?? input.proofs;

    for (let i = 0; i < input.proofs; i += 1) {
      const reporter = await test.pool.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );

      await test.pool.query(
        `INSERT INTO structured.payment_proofs
           (reporter_user_id, vendor_id, merchant_name, paid_amount, paid_at)
         VALUES ($1, $2, $3, $4, now() - (($5 || ' days')::interval))`,
        [
          reporter.rows[0]!.id,
          vendorId,
          input.name,
          (input.amount ?? 21_000_000) + i * 100_000,
          /* 최근 몫은 이레 간격으로, 나머지는 여덟 달 전으로 민다. */
          i < recent ? i * 7 : 240 + i,
        ]
      );
    }

    return vendorId;
  }

  const top3 = (query = '', headers: Record<string, string> = {}) =>
    test.app.inject({ method: 'GET', url: `/v1/recommendations/top3${query}`, headers });

  it('자료가 없으면 한 곳도 추천하지 않는다', async () => {
    const body = (await top3('?region=서울')).json<Top3Body>();

    expect(body.items).toEqual([]);
    expect(body.note).toContain('자료가 모이지');
  });

  it('확인된 정보가 세 건은 있어야 추천한다', async () => {
    // 그 아래는 금액 구간조차 못 보여준다. 보여줄 것이 없는 추천은 추천이 아니다.
    await aVendor({ name: '자료 적은 곳', proofs: 2 });
    await aVendor({ name: '자료 있는 곳', proofs: 3 });

    const body = (await top3('?region=서울')).json<Top3Body>();

    expect(body.items.map((item) => item.name)).toEqual(['자료 있는 곳']);
  });

  it('세 곳을 억지로 채우지 않는다', async () => {
    /*
     * 정책이 명시했다. 빈자리를 채우려고 근거 없는 업체를 넣으면 세 자리 전부의
     * 뜻이 사라진다.
     */
    await aVendor({ name: '한 곳', proofs: 4 });
    await aVendor({ name: '모자란 곳 하나', proofs: 1 });
    await aVendor({ name: '모자란 곳 둘', proofs: 0 });

    const body = (await top3('?region=서울')).json<Top3Body>();

    expect(body.items).toHaveLength(1);
    expect(body.note).toBe('추천할 만한 곳이 아직 이만큼이에요');
  });

  it('세 곳을 채우면 덧말이 없다', async () => {
    await aVendor({ name: '가', proofs: 6 });
    await aVendor({ name: '나', proofs: 5 });
    await aVendor({ name: '다', proofs: 4 });
    await aVendor({ name: '라', proofs: 3 });

    const body = (await top3('?region=서울')).json<Top3Body>();

    expect(body.items).toHaveLength(3);
    expect(body.note).toBeNull();
    // 확인된 정보가 많은 순이다.
    expect(body.items.map((item) => item.name)).toEqual(['가', '나', '다']);
  });

  it('모든 추천에 이유가 붙는다', async () => {
    await aVendor({ name: '가온예식홀', proofs: 6 });

    const body = (await top3('?region=서울')).json<Top3Body>();

    expect(body.items[0]!.reasons.length).toBeGreaterThan(0);
    expect(body.items[0]!.reasons).toContain('region');
  });

  it('확인된 정보 수가 캡션이 세는 수와 같다', async () => {
    /*
     * 카드가 `확인된 정보가 많아요`라고 적어놓고 바로 아래 캡션에 다른 수를
     * 적으면, 읽는 사람은 어느 쪽을 믿어야 할지 알 수 없다.
     */
    await aVendor({ name: '가온예식홀', proofs: 8 });

    const item = (await top3('?region=서울')).json<Top3Body>().items[0]!;

    expect(item.paidPrice.count).toBe(item.confirmedCount);
    expect(item.paidPrice.caption).toContain(`확인된 정보 ${item.confirmedCount}건`);
  });

  it('최근 자료는 기본 기간보다 짧게 센다', async () => {
    // 같은 기간을 두 번 세면 두 이유가 늘 함께 붙는 한 문장이 된다.
    await aVendor({ name: '옛 자료만', proofs: 6, recent: 0 });

    const item = (await top3('?region=서울')).json<Top3Body>().items[0]!;

    expect(item.reasons).toContain('many_confirmed');
    expect(item.reasons).not.toContain('recent_data');
  });

  it('다른 지역은 고르지 않는다', async () => {
    await aVendor({ name: '부산 홀', region: '부산 해운대구', proofs: 6 });

    expect((await top3('?region=서울')).json<Top3Body>().items).toEqual([]);
    expect((await top3('?region=부산')).json<Top3Body>().items).toHaveLength(1);
  });

  it('광고를 사도 순위가 바뀌지 않는다', async () => {
    /*
     * v3.10: 광고비는 자연 추천 순위에 영향을 줄 수 없다. 자료가 적은 업체가
     * 광고를 사도 자료 많은 업체를 앞지르지 못하고, 자격 미달이면 나오지도 않는다.
     */
    const many = await aVendor({ name: '자료 많은 곳', proofs: 8 });
    const few = await aVendor({ name: '광고 산 곳', proofs: 3 });
    const under = await aVendor({ name: '자격 미달 광고', proofs: 1 });

    const before = (await top3('?region=서울')).json<Top3Body>().items.map((i) => i.vendorId);

    for (const vendorId of [few, under]) {
      await test.pool.query(
        `INSERT INTO ads.placements (vendor_id, tier, surface, starts_on, ends_on)
         VALUES ($1, 'premium', 'region_category', current_date - 1, current_date + 30)`,
        [vendorId]
      );
    }

    const after = (await top3('?region=서울')).json<Top3Body>().items.map((i) => i.vendorId);

    expect(after).toEqual(before);
    expect(after[0]).toBe(many);
    expect(after).not.toContain(under);
  });

  it('로그인하면 자기 지역과 예산을 쓴다', async () => {
    const { headers } = await signInAs(test);

    await test.app.inject({
      method: 'POST',
      url: '/v1/me/setup',
      headers,
      payload: {
        weddingDate: new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10),
        region: '서울',
        budgetBracket: '20m_30m',
      },
    });

    /* 기준금액은 상세 단계(10건)가 되어야 낼 수 있다. */
    await aVendor({ name: '가온예식홀', proofs: 12, amount: 21_000_000 });

    const body = (await top3('', headers)).json<Top3Body>();

    expect(body.region).toBe('서울');
    expect(body.items).toHaveLength(1);
    // 기준금액이 예산 안이면 그것도 이유가 된다.
    expect(body.items[0]!.reasons).toContain('budget');
  });

  it('비회원도 지역만 주면 추천을 받는다', async () => {
    // 지연 로그인이라 로그인 전에도 홈이 뜬다.
    await aVendor({ name: '가온예식홀', proofs: 6 });

    const response = await top3('?region=서울');

    expect(response.statusCode).toBe(200);
    expect(response.json<Top3Body>().items).toHaveLength(1);
  });

  it('지역을 모르면 지역을 이유로 대지 않는다', async () => {
    await aVendor({ name: '가온예식홀', proofs: 6 });

    const body = (await top3()).json<Top3Body>();

    expect(body.region).toBeNull();
    for (const item of body.items) {
      expect(item.reasons).not.toContain('region');
    }
  });
});
