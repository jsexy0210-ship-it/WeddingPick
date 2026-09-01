import { PRICING_POLICY } from '@weddingpick/domain';

import {
  createTestApp,
  createWedding,
  markAllPiiReviewed,
  markPiiReviewed,
  resetDatabase,
  signInAs,
  type TestApp,
} from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/** 분석이 아직 없으므로 문서를 직접 넣는다. */
async function seedQuote(options: {
  weddingId: string;
  vendorId?: string | null;
  productKey?: string | null;
  amount?: number;
  level?: string;
  confirmed?: boolean;
  requiredFields?: string[];
}) {
  const vendorId =
    options.vendorId === undefined
      ? (
          await test.pool.query<{ id: string }>(
            `INSERT INTO structured.vendors (category, name, region, source)
             VALUES ('hall', '테스트홀', '서울', 'vendor_official') RETURNING id`
          )
        ).rows[0]!.id
      : options.vendorId;

  const { rows } = await test.pool.query<{ id: string }>(
    `INSERT INTO structured.quotes
       (wedding_id, vendor_id, doc_type, product_key, total_amount, contract_date,
        verification_level, source)
     VALUES ($1, $2, 'contract', $3, $4, '2026-05-01', $5, 'ai_extraction')
     RETURNING id`,
    [
      options.weddingId,
      vendorId,
      options.productKey === undefined ? '홀-기본패키지' : options.productKey,
      options.amount ?? 10_000_000,
      options.level ?? 'L2',
    ]
  );

  const quoteId = rows[0]!.id;

  for (const path of options.requiredFields ?? []) {
    await test.pool.query(
      `INSERT INTO structured.extraction_fields (quote_id, field_path, extracted_value, confidence)
       VALUES ($1, $2, '값', 0.4)`,
      [quoteId, path]
    );
  }

  if (options.confirmed) {
    await test.pool.query('UPDATE structured.quotes SET confirmed_at = now() WHERE id = $1', [
      quoteId,
    ]);
  }

  // 서비스정책서 4번: 개인정보 재검토를 받아야 남들이 보는 면으로 간다.
  // 실전에서도 사람이 한 번 본 뒤에야 비교에 잡힌다.
  await markPiiReviewed(test, [quoteId]);

  return { quoteId, vendorId };
}

/** 시장 표본. 다른 웨딩의 인증된 계약들이다. */
async function seedMarketSamples(vendorId: string, count: number, level = 'L2') {
  const owner = await signInAs(test, `market-${Math.random()}`);
  const weddingId = await createWedding(test, owner.headers);

  for (let index = 0; index < count; index += 1) {
    await test.pool.query(
      `INSERT INTO structured.quotes
         (wedding_id, vendor_id, doc_type, product_key, total_amount, contract_date,
          verification_level, source, confirmed_at)
       VALUES ($1, $2, 'contract', '홀-기본패키지', $3, '2026-03-01', $4, 'ai_extraction', now())`,
      [weddingId, vendorId, 9_000_000 + index * 200_000, level]
    );
  }

  await markAllPiiReviewed(test);
}

describeWithDb('문서와 비교', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  describe('확인 단계', () => {
    it('핵심 필드를 모두 확인해야 문서가 확인 완료가 된다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const { quoteId } = await seedQuote({
        weddingId,
        requiredFields: ['totalAmount', 'contractDate'],
      });

      const partial = await test.app.inject({
        method: 'POST',
        url: `/v1/quotes/${quoteId}/confirmations`,
        headers,
        payload: { fields: [{ path: 'totalAmount' }] },
      });

      // 하나 남았으니 아직 확인 완료가 아니다.
      expect(partial.json().confirmedAt).toBeNull();

      const rest = await test.app.inject({
        method: 'POST',
        url: `/v1/quotes/${quoteId}/confirmations`,
        headers,
        payload: { fields: [{ path: 'contractDate' }] },
      });

      expect(rest.json().confirmedAt).not.toBeNull();
    });

    it('고친 값을 함께 보낼 수 있다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const { quoteId } = await seedQuote({ weddingId, requiredFields: ['totalAmount'] });

      const response = await test.app.inject({
        method: 'POST',
        url: `/v1/quotes/${quoteId}/confirmations`,
        headers,
        payload: { fields: [{ path: 'totalAmount', correctedValue: '3280000' }] },
      });

      expect(response.json().extractionFields[0]).toMatchObject({
        path: 'totalAmount',
        confirmedByUser: true,
        correctedValue: '3280000',
      });
    });

    it('없는 항목을 확인하려 하면 막는다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const { quoteId } = await seedQuote({ weddingId });

      const response = await test.app.inject({
        method: 'POST',
        url: `/v1/quotes/${quoteId}/confirmations`,
        headers,
        payload: { fields: [{ path: '없는필드' }] },
      });

      expect(response.statusCode).toBe(400);
    });

    it('신뢰도는 언제나 함께 내려간다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const { quoteId } = await seedQuote({ weddingId, requiredFields: ['totalAmount'] });

      const response = await test.app.inject({
        method: 'GET',
        url: `/v1/quotes/${quoteId}`,
        headers,
      });

      expect(response.json().extractionFields[0]).toMatchObject({
        confidence: 0.4,
        requiresConfirmation: true,
      });
    });
  });

  describe('가격 비교', () => {
    it('확인 전에는 비교하지 않는다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const { quoteId } = await seedQuote({ weddingId });

      const response = await test.app.inject({
        method: 'GET',
        url: `/v1/quotes/${quoteId}/comparison`,
        headers,
      });

      expect(response.json()).toMatchObject({ available: false, reason: 'amount_unconfirmed' });
    });

    it('업체를 모르면 비교하지 않는다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const { quoteId } = await seedQuote({ weddingId, vendorId: null, confirmed: true });

      const response = await test.app.inject({
        method: 'GET',
        url: `/v1/quotes/${quoteId}/comparison`,
        headers,
      });

      expect(response.json()).toMatchObject({ available: false, reason: 'vendor_unknown' });
    });

    it('표본이 모자라면 가격을 만들지 않고 이유를 준다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const { quoteId, vendorId } = await seedQuote({ weddingId, confirmed: true });

      await seedMarketSamples(vendorId!, PRICING_POLICY.minimumSampleCount - 1);

      const response = await test.app.inject({
        method: 'GET',
        url: `/v1/quotes/${quoteId}/comparison`,
        headers,
      });

      // 제품 원칙 2: 데이터가 부족하면 시장 가격을 만들어내지 않는다.
      expect(response.json()).toMatchObject({
        available: false,
        reason: 'not_enough_samples',
        sampleCount: PRICING_POLICY.minimumSampleCount - 1,
      });
    });

    it('L1 표본은 아무리 많아도 시장 가격이 되지 않는다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const { quoteId, vendorId } = await seedQuote({ weddingId, confirmed: true });

      await seedMarketSamples(vendorId!, PRICING_POLICY.minimumSampleCount * 3, 'L1');

      expect(
        (
          await test.app.inject({
            method: 'GET',
            url: `/v1/quotes/${quoteId}/comparison`,
            headers,
          })
        ).json()
      ).toMatchObject({ available: false, reason: 'not_enough_samples' });
    });

    it('표본이 충분하면 중앙값과 판단을 함께 준다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const { quoteId, vendorId } = await seedQuote({
        weddingId,
        confirmed: true,
        amount: 20_000_000,
      });

      await seedMarketSamples(vendorId!, PRICING_POLICY.minimumSampleCount + 3);

      const body = (
        await test.app.inject({
          method: 'GET',
          url: `/v1/quotes/${quoteId}/comparison`,
          headers,
        })
      ).json();

      expect(body.available).toBe(true);
      expect(body.judgement).toBe('high');
      // 사업계획서 9번: 표본 수와 기준 기간은 늘 함께 나간다.
      expect(body.stat.sampleCount).toBe(PRICING_POLICY.minimumSampleCount + 3);
      expect(body.stat.periodStart).toBe('2026-03-01');
      expect(body.stat.minVerificationLevel).toBe('L2');
    });
  });

  describe('인증 신청', () => {
    it('확인하지 않은 문서로는 신청할 수 없다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const { quoteId } = await seedQuote({ weddingId });

      const response = await test.app.inject({
        method: 'POST',
        url: `/v1/quotes/${quoteId}/verification-requests`,
        headers,
        payload: {
          targetLevel: 'L2',
          evidence: [{ kind: 'contract_document', rawDocumentId: crypto.randomUUID() }],
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('confirmation_required');
    });

    it('접수만 되고 등급은 그대로다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const { quoteId } = await seedQuote({ weddingId, level: 'L0', confirmed: true });

      const upload = await test.app.inject({
        method: 'POST',
        url: '/v1/documents/uploads',
        headers,
        payload: { weddingId, pages: [{ mimeType: 'image/jpeg', sizeBytes: 1000 }] },
      });

      const response = await test.app.inject({
        method: 'POST',
        url: `/v1/quotes/${quoteId}/verification-requests`,
        headers,
        payload: {
          targetLevel: 'L2',
          evidence: [
            { kind: 'contract_document', rawDocumentId: upload.json().rawDocumentId },
          ],
        },
      });

      // 서비스정책서 7번: 자동승인 금지.
      expect(response.statusCode).toBe(202);
      expect(response.json().status).toBe('received');

      const quote = await test.app.inject({
        method: 'GET',
        url: `/v1/quotes/${quoteId}`,
        headers,
      });

      expect(quote.json().verificationLevel).toBe('L0');
    });

    it('목표 등급에 맞는 증빙이 없으면 접수하지 않는다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const { quoteId } = await seedQuote({ weddingId, level: 'L0', confirmed: true });

      const upload = await test.app.inject({
        method: 'POST',
        url: '/v1/documents/uploads',
        headers,
        payload: { weddingId, pages: [{ mimeType: 'image/jpeg', sizeBytes: 1000 }] },
      });

      const response = await test.app.inject({
        method: 'POST',
        url: `/v1/quotes/${quoteId}/verification-requests`,
        headers,
        // 계약인증(L2)에 견적서만 냈다. L2부터 시장가격에 반영되므로 여기서 막는다.
        payload: {
          targetLevel: 'L2',
          evidence: [{ kind: 'quote_document', rawDocumentId: upload.json().rawDocumentId }],
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.message).toContain('계약서');
    });

    it('이미 받은 등급은 다시 신청할 수 없다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const { quoteId } = await seedQuote({ weddingId, level: 'L2', confirmed: true });

      const upload = await test.app.inject({
        method: 'POST',
        url: '/v1/documents/uploads',
        headers,
        payload: { weddingId, pages: [{ mimeType: 'image/jpeg', sizeBytes: 1000 }] },
      });

      const response = await test.app.inject({
        method: 'POST',
        url: `/v1/quotes/${quoteId}/verification-requests`,
        headers,
        payload: {
          targetLevel: 'L2',
          evidence: [{ kind: 'contract_document', rawDocumentId: upload.json().rawDocumentId }],
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.message).toContain('Pick확인');
    });

    it('남의 증빙 문서는 붙일 수 없다', async () => {
      const stranger = await signInAs(test, 'stranger');
      const strangerWedding = await createWedding(test, stranger.headers);
      const strangerUpload = await test.app.inject({
        method: 'POST',
        url: '/v1/documents/uploads',
        headers: stranger.headers,
        payload: {
          weddingId: strangerWedding,
          pages: [{ mimeType: 'image/jpeg', sizeBytes: 1000 }],
        },
      });

      const me = await signInAs(test, 'me');
      const weddingId = await createWedding(test, me.headers);
      const { quoteId } = await seedQuote({ weddingId, confirmed: true });

      const response = await test.app.inject({
        method: 'POST',
        url: `/v1/quotes/${quoteId}/verification-requests`,
        headers: me.headers,
        payload: {
          targetLevel: 'L2',
          evidence: [
            { kind: 'contract_document', rawDocumentId: strangerUpload.json().rawDocumentId },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
