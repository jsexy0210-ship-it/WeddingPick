import { PRICING_POLICY } from '@weddingpick/domain';

import {
  consentToPaymentProofs,
  createTestApp,
  createWedding,
  resetDatabase,
  signInAs,
  type TestApp,
} from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 결제인증 제보.
 *
 * 계약서 원본 업로드가 P1에서 빠진 자리를 메운다(사업계획서 v3 6번). **심사가
 * 아니라 등록이다** — 그 경계가 흐려지면 사람이 보지 않은 자료가 시장 대표가격에
 * 들어간다. 여기서 지키는 것이 그 경계다.
 */
describeWithDb('결제인증', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function createVendor(name = '가온예식홀') {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ($1, 'hall', '서울', 'public_data') RETURNING id`,
      [name]
    );

    return rows[0]!.id;
  }

  async function register(
    headers: Record<string, string>,
    over: Record<string, unknown> = {}
  ) {
    // 실전에서도 동의한 사람만 등록한다. 그 순서를 여기서도 지킨다.
    await consentToPaymentProofs(test, headers);

    return await test.app.inject({
      method: 'POST',
      url: '/v1/payment-proofs',
      headers,
      payload: {
        merchantName: '가온예식홀',
        paidAmount: 3_000_000,
        paidAt: '2026-05-20T04:00:00.000Z',
        method: 'card',
        ...over,
      },
    });
  }

  it('가맹점 이름으로 업체를 찾는다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createVendor();

    const response = await register(headers);

    expect(response.statusCode).toBe(201);
    expect(response.json<{ matchedVendorId: string }>().matchedVendorId).toBe(vendorId);
  });

  it('업체를 못 찾아도 버리지 않는다', async () => {
    const { headers } = await signInAs(test);

    const response = await register(headers, { merchantName: '어디인지모를곳' });

    expect(response.statusCode).toBe(201);
    expect(response.json<{ matchedVendorId: null }>().matchedVendorId).toBeNull();
    // 무엇을 해야 하는지 알려준다. 그냥 실패로 두면 사용자가 할 수 있는 게 없다.
    expect(response.json<{ unmatchedNote: string }>().unmatchedNote).toBeTruthy();

    // 나중에 업체가 등록되면 이어붙일 수 있게 남아 있다.
    const stored = await test.pool.query('SELECT 1 FROM structured.payment_proofs');
    expect(stored.rows).toHaveLength(1);
  });

  it('이름이 겹치면 고르지 않는다', async () => {
    const { headers } = await signInAs(test);

    // 가맹점 이름은 짧고 겹치기 쉽다. 아무거나 고르면 남의 업체 분포에 들어간다.
    await createVendor('가온예식홀');
    await test.pool.query(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ('가온 예식홀', 'hall', '부산', 'public_data')`
    );

    const response = await register(headers);

    expect(response.json<{ matchedVendorId: null }>().matchedVendorId).toBeNull();
  });

  it('카드번호를 보낼 자리가 없다', async () => {
    const { headers } = await signInAs(test);
    await createVendor();

    // 종류만 받는다. 값을 넣을 필드가 계약에 없으므로 이 요청은 무시되거나 거부된다.
    const response = await register(headers, {
      maskedIdentifiers: ['card_number', 'approval_number'],
      cardNumber: '5432-1234-5678-9012',
    });

    expect(response.statusCode).toBe(201);

    // pg 드라이버가 사용자 정의 enum 배열을 풀어주지 않아 text[]로 캐스팅해 읽는다.
    const stored = await test.pool.query<{ masked_identifiers: string[] }>(
      'SELECT masked_identifiers::text[] AS masked_identifiers FROM structured.payment_proofs'
    );

    expect(stored.rows[0]!.masked_identifiers).toEqual(['card_number', 'approval_number']);

    // 저장된 어느 칸에도 그 숫자가 없다.
    const dump = await test.pool.query(
      `SELECT 1 FROM structured.payment_proofs
       WHERE merchant_name LIKE '%5432%' OR merchant_name LIKE '%9012%'`
    );

    expect(dump.rows).toHaveLength(0);
  });

  it('카드번호를 종류 목록에 값으로 넣을 수 없다', async () => {
    // enum이라 타입이 막는다. text[]였다면 언젠가 누가 넣는다.
    await expect(
      test.pool.query(
        `INSERT INTO structured.payment_proofs
           (reporter_user_id, merchant_name, paid_amount, paid_at, masked_identifiers)
         VALUES (gen_random_uuid(), 'x', 1, now(), ARRAY['5432-1234-5678-9012']::masked_identifier_kind[])`
      )
    ).rejects.toThrow();
  });

  it('같은 결제를 두 번 넣을 수 없다', async () => {
    const { headers } = await signInAs(test);
    await createVendor();

    expect((await register(headers)).statusCode).toBe(201);

    const second = await register(headers);

    expect(second.statusCode).toBe(409);
  });

  it('앞으로의 결제는 받지 않는다', async () => {
    const { headers } = await signInAs(test);
    await createVendor();

    const response = await register(headers, { paidAt: '2099-01-01T00:00:00.000Z' });

    expect(response.statusCode).toBe(400);
  });

  it('문서 등급을 올리지 않는다', async () => {
    const { headers } = await signInAs(test);
    await createVendor();

    await register(headers);

    /*
     * 서비스정책서 7번의 자동승인 금지는 등록 경로가 생겼다고 느슨해지지 않는다.
     * 결제인증은 사람이 보지 않았고, 그래서 아무 등급도 오르지 않는다.
     */
    const requests = await test.pool.query('SELECT 1 FROM structured.verification_requests');
    expect(requests.rows).toHaveLength(0);
  });

  it('시장 대표가격에 들어가지 않는다', async () => {
    const vendorId = await createVendor();

    for (let index = 0; index < PRICING_POLICY.minimumSampleCount + 1; index += 1) {
      const { headers } = await signInAs(test, `apple-user-${index}`);
      const response = await register(headers, { paidAmount: 3_000_000 + index });

      expect(response.statusCode).toBe(201);
    }

    // 계약 중앙값의 관문은 비어 있다. 근거가 다른 숫자는 그 문을 통과하지 못한다.
    const comparable = await test.pool.query(
      'SELECT 1 FROM structured.comparable_quotes WHERE vendor_id = $1',
      [vendorId]
    );

    expect(comparable.rows).toHaveLength(0);

    // 결제인증 쪽에는 모여 있다.
    const usable = await test.pool.query(
      'SELECT 1 FROM structured.usable_payment_proofs WHERE vendor_id = $1',
      [vendorId]
    );

    expect(usable.rows.length).toBe(PRICING_POLICY.minimumSampleCount + 1);
  });

  it('원본은 24시간 뒤에 지워진다', async () => {
    const { headers, userId } = await signInAs(test);
    await consentToPaymentProofs(test, headers);
    await createVendor();
    const weddingId = await createWedding(test, headers);

    const upload = await test.app.inject({
      method: 'POST',
      url: '/v1/documents/uploads',
      headers,
      payload: {
        weddingId,
        kind: 'payment_proof',
        pages: [{ mimeType: 'image/jpeg', sizeBytes: 1000 }],
      },
    });

    const rawDocumentId = upload.json<{ rawDocumentId: string }>().rawDocumentId;

    const response = await register(headers, { rawDocumentId });

    expect(response.statusCode).toBe(201);

    const deletedBy = new Date(response.json<{ originalDeletedBy: string }>().originalDeletedBy);
    const hours = (deletedBy.getTime() - Date.now()) / (60 * 60 * 1000);

    // 화면데이터구조 스펙 8.3. 계약서의 30일이 아니라 24시간이다.
    expect(hours).toBeGreaterThan(23);
    expect(hours).toBeLessThan(25);
    expect(userId).toBeTruthy();
  });

  it('계약서 원본은 여전히 30일이다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);

    // 두 값은 서로 다른 것을 잰다. 하나로 합치면 둘 중 하나가 틀린 값이 된다.
    const upload = await test.app.inject({
      method: 'POST',
      url: '/v1/documents/uploads',
      headers,
      payload: { weddingId, pages: [{ mimeType: 'image/jpeg', sizeBytes: 1000 }] },
    });

    const { rows } = await test.pool.query<{ retention_until: Date }>(
      'SELECT retention_until FROM originals.document_retention_schedule WHERE id = $1',
      [upload.json<{ rawDocumentId: string }>().rawDocumentId]
    );

    const days = (rows[0]!.retention_until.getTime() - Date.now()) / (24 * 60 * 60 * 1000);

    expect(days).toBeGreaterThan(29);
  });

  it('로그인해야 등록할 수 있다', async () => {
    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/payment-proofs',
      payload: { merchantName: '가온예식홀', paidAmount: 3_000_000, paidAt: '2026-05-20T04:00:00.000Z' },
    });

    expect(response.statusCode).toBe(401);
  });
});

/**
 * 결제문자 읽기.
 *
 * 스펙 7.3의 처리 순서 — AI 앞에 규칙이 온다. 여기서 확인하는 것은 그 순서가
 * 지켜지는지가 아니라(그건 도메인 테스트가 본다), 읽은 값이 저장되지 않는다는
 * 것이다. 사람이 확인하기 전에 저장되면 잘못 읽은 값이 분포에 들어간다.
 */
describeWithDb('결제문자 읽기', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function parse(headers: Record<string, string>, text: string) {
    return await test.app.inject({
      method: 'POST',
      url: '/v1/payment-proofs/parse',
      headers,
      payload: { text },
    });
  }

  const SMS = ['[Web발신]', '신한카드(1234)승인 홍*동', '3,000,000원 일시불', '05/20 14:23', '가온예식홀'].join('\n');

  it('읽기만 하고 저장하지 않는다', async () => {
    const { headers } = await signInAs(test);

    const response = await parse(headers, SMS);

    expect(response.statusCode).toBe(200);
    expect(response.json<{ merchantName: { value: string } }>().merchantName.value).toBe(
      '가온예식홀'
    );

    // 사람이 확인하기 전에는 아무것도 남지 않는다.
    const stored = await test.pool.query('SELECT 1 FROM structured.payment_proofs');
    expect(stored.rows).toHaveLength(0);
  });

  it('카드번호가 응답에 실리지 않는다', async () => {
    const { headers } = await signInAs(test);

    const response = await parse(headers, SMS);

    // 종류는 온다.
    expect(response.json<{ maskedIdentifiers: string[] }>().maskedIdentifiers).toContain(
      'card_number'
    );
    // 값은 어디에도 없다. 담을 필드를 만들지 않았다.
    expect(response.body).not.toContain('1234');
  });

  it('취소 문자는 거절 이유와 함께 온다', async () => {
    const { headers } = await signInAs(test);

    const response = await parse(headers, '신한카드 승인취소 3,000,000원 05/22 가온예식홀');

    expect(response.json<{ rejection: string }>().rejection).toContain('취소');
  });

  it('확신이 낮은 항목을 짚어준다', async () => {
    const { headers } = await signInAs(test);

    // 연도가 없는 날짜는 추정한 값이다.
    const response = await parse(headers, '신한카드 승인 3,000,000원 05/20 14:23 가온예식홀');

    expect(response.json<{ needsConfirmation: string[] }>().needsConfirmation).toContain('paidAt');
  });

  it('로그인해야 읽어준다', async () => {
    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/payment-proofs/parse',
      payload: { text: SMS },
    });

    expect(response.statusCode).toBe(401);
  });
});
