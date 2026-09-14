import { PRICING_POLICY } from '@weddingpick/domain';

import type { LocalStorage } from '../storage/local';
import type { ProofReading } from '../analysis/payment-reader';
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
 * 결제인증 제보 — **사진 한 장.**
 *
 * 계약서 원본 업로드가 P1에서 빠진 자리를 메운다(사업계획서 v3 6번). **심사가
 * 아니라 등록이다** — 그 경계가 흐려지면 사람이 보지 않은 자료가 시장 대표가격에
 * 들어간다. 여기서 지키는 것이 그 경계다.
 *
 * 핸드오프 v3.24가 사용자 행동을 사진 한 장으로 압축했다. 금액·업체·날짜를 받을
 * 자리가 계약에 없고, 못 읽은 것은 **접수는 성립하되 검수를 기다린다** — 「못
 * 읽었다」가 정상 상태다.
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

  /** 읽기 결과를 시험이 정한다. 실제 모델은 돈이 들고 결과가 매번 다르다. */
  function readsAs(over: Partial<ProofReading> = {}): void {
    test.context.proofReader.read = async (_images, model) => ({
      model,
      usage: { inputTokens: 10, outputTokens: 10, cachedInputTokens: 0 },
      reading: {
        merchantName: '가온예식홀',
        paidAmount: 3_000_000,
        paidAt: '2026-05-20T04:00:00.000Z',
        method: 'card',
        maskedIdentifiers: [],
        rejection: null,
        confidence: 0.95,
        ...over,
      },
    });
  }

  async function createVendor(name = '가온예식홀') {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ($1, 'hall', '서울', 'public_data') RETURNING id`,
      [name]
    );

    return rows[0]!.id;
  }

  /**
   * 올린 원본 하나. 실전과 같은 순서다 — 동의하고, 업로드 자리를 받고, 올린다.
   *
   * 내용까지 넣는다. 서버가 읽으려면 스토리지에 실제로 무언가 있어야 하고, 없으면
   * 「읽기 실패」가 아니라 다운로드 오류로 떨어져 시험이 다른 것을 재게 된다.
   */
  async function anUpload(headers: Record<string, string>): Promise<string> {
    await consentToPaymentProofs(test, headers);
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

    const pages = await test.pool.query<{ storage_key: string }>(
      'SELECT storage_key FROM originals.raw_document_pages WHERE raw_document_id = $1',
      [rawDocumentId]
    );

    for (const page of pages.rows) {
      (test.context.storage as LocalStorage).put(page.storage_key, Buffer.from('receipt'));
    }

    return rawDocumentId;
  }

  async function register(headers: Record<string, string>, over: Record<string, unknown> = {}) {
    const rawDocumentId = await anUpload(headers);

    return await test.app.inject({
      method: 'POST',
      url: '/v1/payment-proofs',
      headers,
      payload: { rawDocumentId, ...over },
    });
  }

  it('사진 한 장으로 접수한다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createVendor();
    readsAs();

    const response = await register(headers);

    expect(response.statusCode).toBe(201);
    expect(response.json<{ status: string }>().status).toBe('accepted');
    expect(response.json<{ matchedVendorId: string }>().matchedVendorId).toBe(vendorId);
  });

  it('금액을 보낼 자리가 없다', async () => {
    const { headers } = await signInAs(test);
    await createVendor();
    readsAs();

    // 화면이 지어낸 값을 보내도 서버는 읽은 값만 쓴다. 계약에 그 필드가 없다.
    const response = await register(headers, { paidAmount: 99_000_000, merchantName: '내가적은곳' });

    expect(response.statusCode).toBe(201);
    expect(response.json<{ paidAmount: number }>().paidAmount).toBe(3_000_000);

    const stored = await test.pool.query<{ paid_amount: string; merchant_name: string }>(
      'SELECT paid_amount, merchant_name FROM structured.payment_proofs'
    );

    expect(Number(stored.rows[0]!.paid_amount)).toBe(3_000_000);
    expect(stored.rows[0]!.merchant_name).toBe('가온예식홀');
  });

  /*
   * **이 시험이 이번 변경의 핵심이다.** 예전 계약은 금액을 필수로 받아, 읽지 못한
   * 사진은 보낼 곳이 없었다. 화면에서 입력칸을 없애려면 여기가 먼저 열려야 했다.
   */
  it('금액을 못 읽어도 접수는 된다 — 검수를 기다린다', async () => {
    const { headers } = await signInAs(test);
    await createVendor();
    readsAs({ paidAmount: null, confidence: 0.4 });

    const response = await register(headers);

    expect(response.statusCode).toBe(201);
    expect(response.json<{ status: string }>().status).toBe('pending_review');
    expect(response.json<{ pendingFields: string[] }>().pendingFields).toContain('paidAmount');
    // 값을 지어내지 않는다.
    expect(response.json<{ paidAmount: null }>().paidAmount).toBeNull();

    const stored = await test.pool.query<{ review_state: string; paid_amount: string | null }>(
      'SELECT review_state, paid_amount FROM structured.payment_proofs'
    );

    expect(stored.rows[0]!.review_state).toBe('pending_review');
    expect(stored.rows[0]!.paid_amount).toBeNull();
  });

  it('검수를 기다리는 제보는 어디에도 쓰이지 않는다', async () => {
    const { headers } = await signInAs(test);
    const vendorId = await createVendor();
    readsAs({ paidAt: null });

    await register(headers);

    // 업체의 금액 구간
    const usable = await test.pool.query(
      'SELECT 1 FROM structured.usable_payment_proofs WHERE vendor_id = $1',
      [vendorId]
    );
    expect(usable.rows).toHaveLength(0);

    // 실제가격 열람 자격
    const unlock = await test.pool.query('SELECT 1 FROM structured.data_unlocks');
    expect(unlock.rows).toHaveLength(0);

    // 우리웨딩 지출
    const expenses = await test.pool.query(
      `SELECT 1 FROM structured.wedding_expenses WHERE source = 'payment_proof'`
    );
    expect(expenses.rows).toHaveLength(0);
  });

  it('확신이 낮으면 접수하고 검수로 넘긴다', async () => {
    const { headers } = await signInAs(test);
    await createVendor();
    // 값은 다 읽혔지만 흐릿하게 읽었다. 그대로 분포에 넣으면 읽기 실패보다 나쁘다.
    readsAs({ confidence: 0.3 });

    const response = await register(headers);

    expect(response.json<{ status: string }>().status).toBe('pending_review');
    expect(response.json<{ matchedVendorId: null }>().matchedVendorId).toBeNull();
  });

  it('취소 문자는 접수는 하되 쓰지 않는다', async () => {
    const { headers } = await signInAs(test);
    await createVendor();
    readsAs({ rejection: '승인취소 문자예요' });

    const response = await register(headers);

    // 버리면 사용자는 자기가 올린 것이 어디 갔는지 모른다. 받아들이면 낸 적 없는 돈이 낸 돈이 된다.
    expect(response.statusCode).toBe(201);
    expect(response.json<{ status: string }>().status).toBe('pending_review');
    expect(response.json<{ reviewNote: string }>().reviewNote).toContain('취소');
  });

  it('업체를 못 찾아도 버리지 않는다', async () => {
    const { headers } = await signInAs(test);
    readsAs({ merchantName: '어디인지모를곳' });

    const response = await register(headers);

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
    readsAs();

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
    readsAs({ maskedIdentifiers: ['card_number', 'approval_number'] });

    // 종류만 남는다. 값을 넣을 필드가 계약에도 표에도 없다.
    const response = await register(headers, { cardNumber: '5432-1234-5678-9012' });

    expect(response.statusCode).toBe(201);
    expect(response.body).not.toContain('5432');

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

  /*
   * 쓸 수 있다고 표시된 줄에는 셋이 다 있다(0150). NOT NULL을 푼 자리를 상태가
   * 지킨다 — 이것이 없으면 빈 값이 금액 구간으로 샌다.
   */
  it('값이 빈 줄을 쓸 수 있다고 표시할 수 없다', async () => {
    await expect(
      test.pool.query(
        `INSERT INTO structured.payment_proofs
           (reporter_user_id, merchant_name, paid_amount, paid_at, review_state)
         VALUES (gen_random_uuid(), NULL, NULL, NULL, 'accepted')`
      )
    ).rejects.toThrow();
  });

  it('같은 결제를 두 번 넣을 수 없다', async () => {
    const { headers } = await signInAs(test);
    await createVendor();
    readsAs();

    expect((await register(headers)).statusCode).toBe(201);

    const second = await register(headers);

    expect(second.statusCode).toBe(409);
  });

  it('앞으로의 결제는 접수하되 검수로 넘긴다', async () => {
    const { headers } = await signInAs(test);
    await createVendor();
    readsAs({ paidAt: '2099-01-01T00:00:00.000Z' });

    const response = await register(headers);

    // 날짜를 잘못 읽은 것이다. 사용자 잘못이 아니라 읽기 잘못이라 400이 아니다.
    expect(response.statusCode).toBe(201);
    expect(response.json<{ status: string }>().status).toBe('pending_review');
  });

  it('문서 등급을 올리지 않는다', async () => {
    const { headers } = await signInAs(test);
    await createVendor();
    readsAs();

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
      readsAs({ paidAmount: 3_000_000 + index });
      const response = await register(headers);

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
    await createVendor();
    readsAs();

    const response = await register(headers);

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

  it('남의 원본으로 등록할 수 없다', async () => {
    const mine = await signInAs(test, 'apple-user-1');
    const theirs = await signInAs(test, 'apple-user-2');
    const rawDocumentId = await anUpload(theirs.headers);
    await consentToPaymentProofs(test, mine.headers);
    readsAs();

    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/payment-proofs',
      headers: mine.headers,
      payload: { rawDocumentId },
    });

    expect(response.statusCode).toBe(404);
  });

  it('동의 없이는 등록할 수 없다', async () => {
    const { headers } = await signInAs(test);
    const rawDocumentId = await anUpload(headers);

    await test.app.inject({ method: 'DELETE', url: '/v1/me/payment-consent', headers });
    readsAs();

    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/payment-proofs',
      headers,
      payload: { rawDocumentId },
    });

    expect(response.statusCode).toBe(403);
  });

  it('로그인해야 등록할 수 있다', async () => {
    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/payment-proofs',
      payload: { rawDocumentId: '00000000-0000-0000-0000-000000000000' },
    });

    expect(response.statusCode).toBe(401);
  });
});
