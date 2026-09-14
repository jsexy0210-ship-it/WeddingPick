import {
  vendorDetailSchema,
  vendorPhotosResponseSchema,
  vendorSearchResponseSchema,
} from '@weddingpick/api-contract';
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

  it('상세 응답이 계약과 어긋나지 않는다', async () => {
    /*
     * 화면은 이 스키마로 응답을 읽는다. 어긋나면 화면이 통째로 "불러오지
     * 못했습니다"가 되므로, 값 하나씩 짚는 것으로는 모자라고 응답 전체를
     * 계약에 대본다.
     */
    const vendorId = await createVendor({ name: '계약확인홀' });

    const response = await test.app.inject({ method: 'GET', url: `/v1/vendors/${vendorId}` });
    const parsed = vendorDetailSchema.safeParse(response.json());

    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });

  it('목록 응답도 계약과 어긋나지 않는다', async () => {
    await createVendor({ name: '목록확인홀' });

    const response = await test.app.inject({ method: 'GET', url: '/v1/vendors' });
    const parsed = vendorSearchResponseSchema.safeParse(response.json());

    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });

  /*
   * 목록의 사진도 판정 전 스위치를 지난다(#202).
   *
   * 이 자리는 시험이 비어 있었다 — 검색 질의의
   * `displayableImageCondition('i', { preview })`에서 `{ preview }`를 빼도
   * 깨지는 것이 하나도 없었다(2026-09-11 실측). 사진 목록 쪽에만 시험이
   * 붙어 있어서, 목록은 눈으로 보는 수밖에 없었다.
   *
   * 이 브랜치가 main을 머지하면서 바로 그 줄이 예산 필터와 같은 질의에서
   * 만났다. 글자가 안 겹쳐 조용히 붙었고 조용히 떨어질 수도 있었다. 그래서
   * 눈으로 본 것을 시험으로 옮겨 적는다.
   */
  describe('목록의 판정 전 사진', () => {
    const before = process.env.VENDOR_IMAGES_SHOW_UNVERIFIED;

    afterEach(() => {
      if (before === undefined) delete process.env.VENDOR_IMAGES_SHOW_UNVERIFIED;
      else process.env.VENDOR_IMAGES_SHOW_UNVERIFIED = before;
    });

    /** 720장이 걸려 있던 모양 그대로 — 저작권 근거도 매칭도 없다. */
    async function createUnverifiedImage(vendorId: string) {
      await test.pool.query(
        `INSERT INTO structured.vendor_images
           (vendor_id, source_url, copyright_basis, status, match_confidence)
         VALUES ($1, 'https://example.com/unverified.jpg', 'unknown', 'pending', 0)`,
        [vendorId]
      );
    }

    it('스위치가 열려 있으면 목록에도 판정 전 사진이 실린다', async () => {
      delete process.env.VENDOR_IMAGES_SHOW_UNVERIFIED;
      const vendorId = await createVendor({ name: '수급홀' });
      await createUnverifiedImage(vendorId);

      const body = await search({});

      expect(body.vendors[0].imageUrl).toBe('https://example.com/unverified.jpg');
    });

    it('닫으면 목록에서도 빠진다 — 비로그인에게는 한 장도 안 나간다', async () => {
      process.env.VENDOR_IMAGES_SHOW_UNVERIFIED = '0';
      const vendorId = await createVendor({ name: '수급홀' });
      await createUnverifiedImage(vendorId);

      const body = await search({});

      expect(body.vendors[0].imageUrl).toBeNull();
    });
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

  describe('실제 결제 구간', () => {
    /** 업체에 결제인증 n건을 심는다. 금액은 조금씩 다르게 둔다. */
    async function seedProofs(vendorId: string, count: number, monthsAgo = 1) {
      for (let index = 0; index < count; index += 1) {
        const reporter = await test.pool.query<{ id: string }>(
          'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
        );

        await test.pool.query(
          `INSERT INTO structured.payment_proofs
             (reporter_user_id, vendor_id, merchant_name, paid_amount, paid_at)
           VALUES ($1, $2, '가온예식홀', $3, now() - ($4 || ' months')::interval)`,
          [reporter.rows[0]!.id, vendorId, 2_500_000 + index * 100_000, monthsAgo]
        );
      }
    }

    const prices = async (vendorId: string) =>
      (await test.app.inject({ method: 'GET', url: `/v1/vendors/${vendorId}` })).json().prices;

    it('2건까지는 구간을 만들지 않는다', async () => {
      const vendorId = await createVendor({ name: '가온예식홀' });
      await seedProofs(vendorId, 2);

      const paid = (await prices(vendorId)).paidPrice;

      expect(paid.stage).toBe('collecting');
      // 몇 건 모였는지는 말한다. 빈 곳인지 모으는 중인지 알려야 한다.
      expect(paid.caption).toContain('2건');
      expect(paid.low).toBeUndefined();
    });

    it('3건부터 구간이 나오되 데이터가 적다고 말한다', async () => {
      const vendorId = await createVendor({ name: '가온예식홀' });
      await seedProofs(vendorId, 3);

      const paid = (await prices(vendorId)).paidPrice;

      expect(paid.stage).toBe('limited');
      expect(paid.caption).toContain('아직 정보가 적어요');
      expect(paid.low).toBeGreaterThan(0);
      // 중앙값은 상세 단계의 것이다. 구간이 나온다고 따라 나오지 않는다.
      expect(paid.median).toBeUndefined();
    });

    it('10건부터 중앙값이 나온다', async () => {
      const vendorId = await createVendor({ name: '가온예식홀' });
      await seedProofs(vendorId, 10);

      const paid = (await prices(vendorId)).paidPrice;

      expect(paid.stage).toBe('detailed');
      expect(paid.median).toBeGreaterThan(0);
    });

    it('12개월보다 오래된 결제는 세지 않는다', async () => {
      /*
       * 라벨이 사실보다 앞서면 안 된다. 화면이 "최근 12개월"이라고 적는데 3년 전
       * 결제가 섞여 있으면 그건 안내가 아니라 틀린 말이다.
       */
      const vendorId = await createVendor({ name: '가온예식홀' });

      await seedProofs(vendorId, 3, 1);
      await seedProofs(vendorId, 9, 20);

      const paid = (await prices(vendorId)).paidPrice;

      // 열두 건이 아니라 세 건이다.
      expect(paid.caption).toContain('3건');
      expect(paid.stage).toBe('limited');
    });

    it('오래된 결제를 지우지는 않는다', async () => {
      // C-1: 삭제하지 않고 과거 이력으로 분리한다.
      const vendorId = await createVendor({ name: '가온예식홀' });
      await seedProofs(vendorId, 4, 20);

      const stored = await test.pool.query('SELECT 1 FROM structured.payment_proofs');

      expect(stored.rows).toHaveLength(4);
      expect((await prices(vendorId)).paidPrice.stage).toBe('collecting');
    });
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
    await createVendor({ name: '마바스튜디오', region: '서울 마포구', category: 'studio' });

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

    const first = await search(headers, '?limit=2&sort=name');
    expect(first.vendors.map((v: { name: string }) => v.name)).toEqual(['가홀', '나홀']);
    expect(first.nextCursor).not.toBeNull();

    const second = await search(
      headers,
      `?limit=2&sort=name&cursor=${encodeURIComponent(first.nextCursor)}`
    );
    expect(second.vendors.map((v: { name: string }) => v.name)).toEqual(['다홀']);
    // 마지막 쪽에서는 빈 쪽을 한 번 더 부르게 하지 않는다.
    expect(second.nextCursor).toBeNull();
  });

  describe('정렬', () => {
    async function seed(vendorId: string, count: number, amount: number) {
      for (let index = 0; index < count; index += 1) {
        const reporter = await test.pool.query<{ id: string }>(
          'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
        );

        await test.pool.query(
          `INSERT INTO structured.payment_proofs
             (reporter_user_id, vendor_id, merchant_name, paid_amount, paid_at)
           VALUES ($1, $2, '가맹점', $3, now() - interval '1 month')`,
          [reporter.rows[0]!.id, vendorId, amount + index]
        );
      }
    }

    const names = (body: { vendors: { name: string }[] }) => body.vendors.map((v) => v.name);

    it('기본은 데이터 많은 순이다', async () => {
      /*
       * `인기 순`은 만들지 않았다. 인기를 재는 것이 우리에게 없고, 없는 것에
       * 이름만 붙이면 그건 정렬이 아니라 꾸밈이다.
       */
      const { headers } = await signInAs(test);
      const few = await createVendor({ name: '가홀' });
      const many = await createVendor({ name: '나홀' });

      await seed(few, 3, 3_000_000);
      await seed(many, 8, 5_000_000);

      expect(names(await search(headers, ''))).toEqual(['나홀', '가홀']);
    });

    it('금액 낮은 순·높은 순으로 뒤집힌다', async () => {
      const { headers } = await signInAs(test);
      const cheap = await createVendor({ name: '나홀' });
      const dear = await createVendor({ name: '가홀' });

      await seed(cheap, 5, 2_000_000);
      await seed(dear, 5, 9_000_000);

      expect(names(await search(headers, '?sort=price_low'))).toEqual(['나홀', '가홀']);
      expect(names(await search(headers, '?sort=price_high'))).toEqual(['가홀', '나홀']);
    });

    it('자료 없는 업체가 가장 싼 곳이 되지 않는다', async () => {
      /*
       * 금액이 NULL인 업체를 앞에 두면 "가장 싼 곳"이 자료 없는 곳이 된다.
       */
      const { headers } = await signInAs(test);
      const priced = await createVendor({ name: '가홀' });
      await createVendor({ name: '나홀' });

      await seed(priced, 5, 2_000_000);

      expect(names(await search(headers, '?sort=price_low'))).toEqual(['가홀', '나홀']);
    });

    it('어느 정렬로든 이어붙일 수 있다', async () => {
      /*
       * 정렬값을 커서에 함께 넣지 않으면 둘째 쪽이 첫 쪽과 겹친다.
       */
      const { headers } = await signInAs(test);

      for (const [index, name] of ['가홀', '나홀', '다홀'].entries()) {
        const id = await createVendor({ name });
        await seed(id, 3 + index, 3_000_000);
      }

      const first = await search(headers, '?limit=2&sort=data');
      const second = await search(
        headers,
        `?limit=2&sort=data&cursor=${encodeURIComponent(first.nextCursor)}`
      );

      // 데이터가 많은 순: 다홀(5) → 나홀(4) → 가홀(3)
      expect(names(first)).toEqual(['다홀', '나홀']);
      expect(names(second)).toEqual(['가홀']);
      expect(second.nextCursor).toBeNull();
    });

    it('조건에 몇 곳이 있는지 함께 준다', async () => {
      // 핸드오프 7번이 정렬 옆에 개수를 뒀다. 쪽 수가 아니라 전체 수다.
      const { headers } = await signInAs(test);

      for (const name of ['가홀', '나홀', '다홀']) {
        await createVendor({ name });
      }

      expect((await search(headers, '?limit=2')).total).toBe(3);
    });

    it('목록에도 실제 결제 구간이 실린다', async () => {
      // 핸드오프 7번의 업체 카드. 상세와 같은 사다리를 쓴다.
      const { headers } = await signInAs(test);
      const vendorId = await createVendor({ name: '가홀' });

      await seed(vendorId, 6, 2_500_000);

      const card = (await search(headers, '')).vendors[0];

      expect(card.paidPrice.stage).toBe('normal');
      expect(card.paidPrice.caption).toContain('6건');
    });
  });

  /**
   * 필터 시트가 거는 조건 — WP-SRCH-005.
   *
   * 거르는 값은 **목록이 보여주는 금액과 같아야 한다.** 실 제보가 공개 기준(3건)에
   * 닿으면 그 금액들, 아니면 업체 안내 시작 금액이다. 여기가 어긋나면 «120~180만원»을
   * 골랐는데 카드에 «210만원»이 적힌 곳이 남는다.
   */
  describe('예산 · 실 제보 필터', () => {
    async function seedProofs(vendorId: string, count: number, amount: number) {
      for (let index = 0; index < count; index += 1) {
        const reporter = await test.pool.query<{ id: string }>(
          'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
        );

        await test.pool.query(
          `INSERT INTO structured.payment_proofs
             (reporter_user_id, vendor_id, merchant_name, paid_amount, paid_at)
           VALUES ($1, $2, '가맹점', $3, now() - interval '1 month')`,
          [reporter.rows[0]!.id, vendorId, amount]
        );
      }
    }

    async function setGuidePrice(vendorId: string, fromKrw: number) {
      await test.pool.query(
        `UPDATE structured.vendors
            SET guide_price_from = $2, guide_price_source = '업체 홈페이지'
          WHERE id = $1`,
        [vendorId, fromKrw]
      );
    }

    const names = (body: { vendors: { name: string }[] }) => body.vendors.map((v) => v.name);

    it('예산 구간은 실 제보 금액으로 거른다', async () => {
      const { headers } = await signInAs(test);
      const inBand = await createVendor({ name: '가홀' });
      const tooDear = await createVendor({ name: '나홀' });

      await seedProofs(inBand, 4, 1_500_000);
      await seedProofs(tooDear, 4, 2_100_000);

      expect(names(await search(headers, '?budget=120-180'))).toEqual(['가홀']);
      expect((await search(headers, '?budget=120-180')).total).toBe(1);
    });

    it('구간의 위끝은 포함하지 않는다 — 다음 칸이 가져간다', async () => {
      const { headers } = await signInAs(test);
      const onEdge = await createVendor({ name: '가홀' });
      await seedProofs(onEdge, 4, 1_800_000);

      expect(names(await search(headers, '?budget=120-180'))).toEqual([]);
      expect(names(await search(headers, '?budget=180-250'))).toEqual(['가홀']);
    });

    it('실 제보가 적으면 업체 안내 금액으로 거른다', async () => {
      /* 목록의 금액 한 줄도 그때는 «업체 안내 …»다. 거르는 값과 보이는 값이 같다. */
      const { headers } = await signInAs(test);
      const guided = await createVendor({ name: '가홀' });
      await seedProofs(guided, 2, 9_000_000);
      await setGuidePrice(guided, 1_500_000);

      expect(names(await search(headers, '?budget=120-180'))).toEqual(['가홀']);
    });

    it('금액을 모르는 곳은 어느 구간에도 넣지 않는다', async () => {
      const { headers } = await signInAs(test);
      await createVendor({ name: '가홀' });

      expect(names(await search(headers, '?budget=-120'))).toEqual([]);
      expect(names(await search(headers, '?budget=250-'))).toEqual([]);
      /* 예산을 걸지 않으면 그대로 나온다 — 없는 곳이 되는 것이 아니다. */
      expect(names(await search(headers, ''))).toEqual(['가홀']);
    });

    it('«실 제보가 있는 곳만»은 금액이 뜨는 곳만 남긴다', async () => {
      const { headers } = await signInAs(test);
      const enough = await createVendor({ name: '가홀' });
      const collecting = await createVendor({ name: '나홀' });

      await seedProofs(enough, 3, 1_500_000);
      await seedProofs(collecting, 2, 1_500_000);

      expect(names(await search(headers, '?onlyVerified=true'))).toEqual(['가홀']);
      /* 끄면 둘 다 — «false»가 «true»로 읽히지 않는다. */
      expect(names(await search(headers, '?onlyVerified=false'))).toEqual(['가홀', '나홀']);
    });

    it('업체 안내 금액만 있는 곳은 «실 제보가 있는 곳만»에서 빠진다', async () => {
      /* 예산 구간은 통과시키지만 이 토글은 아니다 — 묻는 것이 다르다. */
      const { headers } = await signInAs(test);
      const guided = await createVendor({ name: '가홀' });
      await setGuidePrice(guided, 1_500_000);

      expect(names(await search(headers, '?budget=120-180'))).toEqual(['가홀']);
      expect(names(await search(headers, '?onlyVerified=true'))).toEqual([]);
    });

    it('없는 예산 구간은 받지 않는다', async () => {
      const { headers } = await signInAs(test);
      await createVendor({ name: '가홀' });

      const response = await test.app.inject({
        method: 'GET',
        url: '/v1/vendors?budget=0-9999',
        headers,
      });

      expect(response.statusCode).toBe(400);
    });
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

describeWithDb('WP-VEND-002 업체 이미지', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  /** vendor_images 행 하나. 기본은 approved에 위치 하나를 채운다. */
  async function createVendorImage(
    vendorId: string,
    overrides: {
      status?: string;
      isRepresentative?: boolean;
      useContain?: boolean;
      storageKey?: string | null;
      sourceUrl?: string | null;
      copyrightNote?: string | null;
      matchConfidence?: number;
      copyrightBasis?: string;
    } = {}
  ) {
    const status = overrides.status ?? 'approved';
    /*
     * 업체가 직접 준 사진(`vendor_provided`)의 매칭 신뢰도는 1.0이다 — 0050이
     * 그렇게 적어 두었다. 이 도우미는 기본값 0을 그대로 두고 있어서 스키마가
     * 말하는 뜻과 어긋났고, 화면 질의가 매칭까지 보게 되자 드러났다.
     */
    const matchConfidence = overrides.matchConfidence ?? 1;
    const storageKey = overrides.storageKey ?? null;
    const sourceUrl = overrides.sourceUrl ?? (storageKey ? null : 'https://example.com/photo.jpg');
    const rejectionReason = status !== 'approved' && status !== 'pending' ? '테스트 거부' : null;
    const verifiedAt = status === 'approved' ? new Date() : null;

    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendor_images
         (vendor_id, storage_key, source_url, copyright_basis, copyright_note,
          use_contain, status, is_representative, rejection_reason, verified_at,
          match_confidence)
       VALUES ($1, $2, $3, $11, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        vendorId,
        storageKey,
        sourceUrl,
        overrides.copyrightNote ?? null,
        overrides.useContain ?? false,
        status,
        overrides.isRepresentative ?? false,
        rejectionReason,
        verifiedAt,
        matchConfidence,
        overrides.copyrightBasis ?? 'vendor_provided',
      ]
    );

    return rows[0]!.id;
  }

  it('없는 업체는 404다', async () => {
    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${crypto.randomUUID()}/images`,
    });

    expect(response.statusCode).toBe(404);
  });

  it('이미지가 없으면 빈 배열이다', async () => {
    const vendorId = await createVendor({ name: '사진없는홀' });

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}/images`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().photos).toEqual([]);
  });

  it('로그인 없이도 승인된 이미지를 본다', async () => {
    // 업체 상세와 같은 접근 레벨(Level 1) — 보기도 전에 계정을 만들라고 하지 않는다.
    const vendorId = await createVendor({ name: '공개홀' });
    await createVendorImage(vendorId, { sourceUrl: 'https://example.com/a.jpg' });

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}/images`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().photos).toHaveLength(1);
  });

  /*
   * **2026-09-11 대표 지시 — 「이미지 720장만 우선 삽입한다」.**
   *
   * 아래 두 시험은 원래 「안 나간다」를 붙들고 있었다. 그 판정 자체는 그대로
   * 맞는데 지금은 스위치가 열려 있어서, 닫았을 때의 동작으로 옮겨 적는다.
   * 시험을 지우지 않는 이유는 **닫을 때 되돌아갈 자리가 여기이기 때문**이다 —
   * 지워두면 다시 닫을 때 무엇이 막혀야 하는지를 아무도 모른다.
   */
  describe('판정 전 사진 — 스위치가 닫혀 있을 때', () => {
    const before = process.env.VENDOR_IMAGES_SHOW_UNVERIFIED;

    beforeEach(() => {
      process.env.VENDOR_IMAGES_SHOW_UNVERIFIED = '0';
    });

    afterEach(() => {
      if (before === undefined) delete process.env.VENDOR_IMAGES_SHOW_UNVERIFIED;
      else process.env.VENDOR_IMAGES_SHOW_UNVERIFIED = before;
    });

    it('승인 전·거부된 이미지는 내려가지 않는다', async () => {
      const vendorId = await createVendor({ name: '검증중홀' });
      await createVendorImage(vendorId, { status: 'pending' });
      await createVendorImage(vendorId, { status: 'quality_rejected' });
      await createVendorImage(vendorId, { status: 'approved', sourceUrl: 'https://example.com/ok.jpg' });

      const response = await test.app.inject({
        method: 'GET',
        url: `/v1/vendors/${vendorId}/images`,
      });

      expect(response.json().photos).toHaveLength(1);
      expect(response.json().photos[0].url).toBe('https://example.com/ok.jpg');
    });

    it('그 업체 것인지 확인 못 한 사진은 승인돼 있어도 내려가지 않는다', async () => {
      /*
       * 운영에 들어 있던 720장이 이런 사진이다 — 「서울 웨딩홀」 같은 업종 검색
       * 결과를 업체마다 잘라 붙인 것이라 검색어에 업체 이름이 없었고, 그 사실이
       * match_confidence 0으로 적혀 있다. 저작권만 보면 값 하나를 배치로 바꾸는
       * 순간 그대로 나간다(packages/domain/src/vendor-image.ts).
       */
      const vendorId = await createVendor({ name: '매칭미확인홀' });
      await createVendorImage(vendorId, { matchConfidence: 0 });
      await createVendorImage(vendorId, { matchConfidence: 0.4 });
      await createVendorImage(vendorId, { matchConfidence: 0.5, sourceUrl: 'https://example.com/ok.jpg' });

      const response = await test.app.inject({
        method: 'GET',
        url: `/v1/vendors/${vendorId}/images`,
      });

      expect(response.json().photos).toHaveLength(1);
      expect(response.json().photos[0].url).toBe('https://example.com/ok.jpg');
    });
  });

  describe('판정 전 사진 — 지금 기준(열림)', () => {
    it('저작권 근거도 매칭도 없는 사진이 내려간다 — 720장이 여기 걸려 있었다', async () => {
      const vendorId = await createVendor({ name: '수급홀' });
      await createVendorImage(vendorId, {
        matchConfidence: 0,
        copyrightBasis: 'unknown',
        sourceUrl: 'https://example.com/unverified.jpg',
      });

      const response = await test.app.inject({
        method: 'GET',
        url: `/v1/vendors/${vendorId}/images`,
      });

      expect(response.json().photos).toHaveLength(1);
      expect(response.json().photos[0].url).toBe('https://example.com/unverified.jpg');
    });

    it('폐기로 넘긴 것은 열려 있어도 안 나간다 — 사람이 이미 내린 판정이다', async () => {
      const vendorId = await createVendor({ name: '폐기홀' });
      await createVendorImage(vendorId, {
        status: 'quality_rejected',
        sourceUrl: 'https://example.com/rejected.jpg',
      });

      const response = await test.app.inject({
        method: 'GET',
        url: `/v1/vendors/${vendorId}/images`,
      });

      expect(response.json().photos).toEqual([]);
    });
  });

  it('대표 이미지가 맨 앞에 온다', async () => {
    const vendorId = await createVendor({ name: '대표홀' });
    await createVendorImage(vendorId, { sourceUrl: 'https://example.com/first.jpg' });
    const repId = await createVendorImage(vendorId, {
      sourceUrl: 'https://example.com/rep.jpg',
      isRepresentative: true,
    });

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}/images`,
    });

    const photos = response.json().photos;
    expect(photos[0].id).toBe(repId);
    expect(photos[0].isRepresentative).toBe(true);
    expect(photos[1].isRepresentative).toBe(false);
  });

  it('source_url이 있으면 그대로 쓰고, storage_key만 있으면 서명 URL을 발급한다', async () => {
    const vendorId = await createVendor({ name: '저장소홀' });
    await createVendorImage(vendorId, { sourceUrl: 'https://example.com/direct.jpg' });
    await createVendorImage(vendorId, { storageKey: 'vendor-images/keyed.jpg' });

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}/images`,
    });

    const urls = response.json().photos.map((photo: { url: string }) => photo.url);
    expect(urls).toContain('https://example.com/direct.jpg');
    expect(urls.some((url: string) => url.includes(encodeURIComponent('vendor-images/keyed.jpg')))).toBe(
      true
    );
  });

  it('로고처럼 잘리면 안 되는 이미지는 useContain을 켠 채로 내려간다', async () => {
    const vendorId = await createVendor({ name: '로고홀' });
    await createVendorImage(vendorId, { useContain: true });

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}/images`,
    });

    expect(response.json().photos[0].useContain).toBe(true);
  });

  it('출처 문구가 있으면 함께 내려가고, 없으면 지어내지 않는다', async () => {
    const vendorId = await createVendor({ name: '출처홀' });
    await createVendorImage(vendorId, { copyrightNote: '업체 제공' });
    await createVendorImage(vendorId);

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}/images`,
    });

    const notes = response.json().photos.map((photo: { sourceNote: string | null }) => photo.sourceNote);
    expect(notes).toContain('업체 제공');
    expect(notes).toContain(null);
  });

  it('응답이 계약과 어긋나지 않는다', async () => {
    const vendorId = await createVendor({ name: '계약이미지홀' });
    await createVendorImage(vendorId, { isRepresentative: true, copyrightNote: '공공누리 제1유형' });

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}/images`,
    });

    const parsed = vendorPhotosResponseSchema.safeParse(response.json());
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
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
    expect(body.caveats.at(-1)).toContain('금액만으로는 비교하기 어려워요');
  });

  it('분류와 지역이 섞이면 알려준다', async () => {
    const { headers } = await signInUnlocked(test);
    const a = await createVendor({ name: '가홀', region: '서울 마포구', category: 'hall' });
    const b = await createVendor({ name: '나스냅', region: '경기 성남시', category: 'snap' });

    const body = (await compare(headers, [a, b])).json();

    expect(body.caveats.some((note: string) => note.includes('분류가 다른'))).toBe(true);
    expect(body.caveats.some((note: string) => note.includes('지역이 달라요'))).toBe(true);
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
    expect(body.caveats.some((note: string) => note.includes('싸거나 비싸다는 뜻이 아니에요'))).toBe(
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
