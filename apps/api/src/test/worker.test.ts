import { PRICING_POLICY, productKey } from '@weddingpick/domain';

import type { Analyzer } from '../analysis/analyzer';
import type { Extraction } from '../analysis/schema';
import { runOnce } from '../analysis/worker';
import type { LocalStorage } from '../storage/local';
import { createTestApp, createWedding, markAllPiiReviewed, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

function extraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    documentKind: 'contract',
    documentKindConfidence: 0.95,
    unreadable: false,
    vendorName: { value: '테스트홀', confidence: 0.9 },
    plannerName: { value: null, confidence: 0 },
    productName: { value: '기본 패키지', confidence: 0.8 },
    totalAmount: { value: 3_280_000, confidence: 0.55 },
    discountAmount: { value: 200_000, confidence: 0.7 },
    depositAmount: { value: 500_000, confidence: 0.8 },
    balanceAmount: { value: 2_780_000, confidence: 0.8 },
    contractDate: { value: '2026-05-01', confidence: 0.9 },
    weddingDate: { value: '2027-03-20', confidence: 0.9 },
    hallName: { value: null, confidence: 0 },
    guaranteedGuests: { value: null, confidence: 0 },
    mealPricePerPerson: { value: null, confidence: 0 },
    subVendors: [
      { role: 'studio', name: '세컨드플로어', amount: 1_150_000 },
      { role: 'dress', name: '메종드로브', amount: 1_300_000 },
      { role: 'makeup', name: '제니하우스 청담', amount: 980_000 },
    ],
    lineItems: [
      { kind: 'included', label: '대관료', amount: 2_000_000, amountMin: null, amountMax: null, note: null },
      { kind: 'additional_candidate', label: '조명 추가', amount: null, amountMin: null, amountMax: null, note: '현장 결제' },
    ],
    terms: [
      { category: 'refund', body: '계약금은 환불되지 않습니다.', flagged: true, daysBeforeWedding: null, penaltyRate: null },
      { category: 'schedule', body: '날짜 변경은 1회 가능합니다.', flagged: false, daysBeforeWedding: null, penaltyRate: null },
    ],
    personalInfoKinds: ['name', 'phone'],
    ...overrides,
  };
}

function fakeAnalyzer(result: Extraction | Error): Analyzer {
  return {
    analyze: async () => {
      if (result instanceof Error) throw result;

      return { extraction: result, usage: { inputTokens: 1200, outputTokens: 340 } };
    },
  };
}

/** 업로드 → 완료까지 밟아 분석 대기열에 한 건을 만든다. */
async function queueAnalysis() {
  const { headers } = await signInAs(test, `user-${Math.random()}`);
  const weddingId = await createWedding(test, headers);

  const upload = await test.app.inject({
    method: 'POST',
    url: '/v1/documents/uploads',
    headers,
    payload: { weddingId, pages: [{ mimeType: 'image/jpeg', sizeBytes: 1000 }] },
  });

  const { rawDocumentId, uploads } = upload.json();

  // 워커가 읽을 파일을 저장소에 넣어둔다.
  (test.context.storage as LocalStorage).put(uploads[0].storageKey, Buffer.from('문서 내용'));

  const complete = await test.app.inject({
    method: 'POST',
    url: `/v1/documents/${rawDocumentId}/complete`,
    headers,
    payload: { weddingId },
  });

  return { headers, weddingId, rawDocumentId, analysisId: complete.json().analysisId };
}

describeWithDb('분석 워커', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('할 일이 없으면 아무것도 하지 않는다', async () => {
    const deps = { pool: test.pool, storage: test.context.storage, analyzer: fakeAnalyzer(extraction()) };

    await expect(runOnce(deps)).resolves.toBe(false);
  });

  it('대기 중인 문서를 읽어 견적으로 만든다', async () => {
    const { headers, analysisId } = await queueAnalysis();

    await runOnce({
      pool: test.pool,
      storage: test.context.storage,
      analyzer: fakeAnalyzer(extraction()),
    });

    const analysis = await test.app.inject({
      method: 'GET',
      url: `/v1/analyses/${analysisId}`,
      headers,
    });

    expect(analysis.json().status).toBe('succeeded');

    const quote = await test.app.inject({
      method: 'GET',
      url: `/v1/quotes/${analysis.json().quoteId}`,
      headers,
    });

    expect(quote.json()).toMatchObject({
      docType: 'contract',
      productName: '기본 패키지',
      totalAmount: 3_280_000,
      contractDate: '2026-05-01',
    });
    expect(quote.json().lineItems).toHaveLength(2);
    expect(quote.json().terms).toHaveLength(2);
  });

  it('분석만으로는 확인 완료가 되지 않고 등급도 오르지 않는다', async () => {
    const { headers, analysisId } = await queueAnalysis();

    await runOnce({
      pool: test.pool,
      storage: test.context.storage,
      analyzer: fakeAnalyzer(extraction()),
    });

    const analysis = await test.app.inject({
      method: 'GET',
      url: `/v1/analyses/${analysisId}`,
      headers,
    });
    const quote = await test.app.inject({
      method: 'GET',
      url: `/v1/quotes/${analysis.json().quoteId}`,
      headers,
    });

    // 서비스정책서 1번·2번: 사용자 확인 전이고 인증 전이다.
    expect(quote.json().confirmedAt).toBeNull();
    expect(quote.json().verificationLevel).toBe('L0');
  });

  it('신뢰도를 함께 저장하고 핵심 필드는 확인 대상으로 표시한다', async () => {
    const { headers, analysisId } = await queueAnalysis();

    await runOnce({
      pool: test.pool,
      storage: test.context.storage,
      analyzer: fakeAnalyzer(extraction()),
    });

    const analysis = await test.app.inject({
      method: 'GET',
      url: `/v1/analyses/${analysisId}`,
      headers,
    });
    const fields = (
      await test.app.inject({
        method: 'GET',
        url: `/v1/quotes/${analysis.json().quoteId}`,
        headers,
      })
    ).json().extractionFields;

    const totalAmount = fields.find((field: { path: string }) => field.path === 'totalAmount');
    const productName = fields.find((field: { path: string }) => field.path === 'productName');

    expect(totalAmount).toMatchObject({ confidence: 0.55, requiresConfirmation: true });
    expect(productName).toMatchObject({ requiresConfirmation: false });
    // 환불 조항은 확인 대상이다.
    expect(fields.find((field: { path: string }) => field.path === 'refundTerms')).toMatchObject({
      requiresConfirmation: true,
    });
  });

  it('개인정보는 종류만 남기고 값은 남기지 않는다', async () => {
    const { rawDocumentId } = await queueAnalysis();

    await runOnce({
      pool: test.pool,
      storage: test.context.storage,
      analyzer: fakeAnalyzer(extraction()),
    });

    const { rows } = await test.pool.query<{ personal_info_kinds: string[] }>(
      'SELECT personal_info_kinds FROM originals.raw_documents WHERE id = $1',
      [rawDocumentId]
    );

    expect(rows[0]!.personal_info_kinds).toEqual(['name', 'phone']);
  });

  it('AI 호출량을 기록한다', async () => {
    const { analysisId } = await queueAnalysis();

    await runOnce({
      pool: test.pool,
      storage: test.context.storage,
      analyzer: fakeAnalyzer(extraction()),
    });

    const { rows } = await test.pool.query<{ input_tokens: number; output_tokens: number }>(
      'SELECT input_tokens, output_tokens FROM structured.analyses WHERE id = $1',
      [analysisId]
    );

    // 사업계획서 35번: AI 비용 관리는 자동화 대상이다.
    expect(rows[0]).toMatchObject({ input_tokens: 1200, output_tokens: 340 });
  });

  it('글씨를 읽지 못하면 다시 찍으라고 알린다', async () => {
    const { headers, analysisId } = await queueAnalysis();

    await runOnce({
      pool: test.pool,
      storage: test.context.storage,
      analyzer: fakeAnalyzer(extraction({ unreadable: true })),
    });

    const analysis = await test.app.inject({
      method: 'GET',
      url: `/v1/analyses/${analysisId}`,
      headers,
    });

    expect(analysis.json()).toMatchObject({ status: 'failed', reason: 'unreadable' });
  });

  it('견적서가 아니면 그렇게 알린다', async () => {
    const { headers, analysisId } = await queueAnalysis();

    await runOnce({
      pool: test.pool,
      storage: test.context.storage,
      analyzer: fakeAnalyzer(extraction({ documentKind: 'not_a_document' })),
    });

    const analysis = await test.app.inject({
      method: 'GET',
      url: `/v1/analyses/${analysisId}`,
      headers,
    });

    expect(analysis.json()).toMatchObject({ status: 'failed', reason: 'not_a_document' });
  });

  it('분석이 터져도 running에 머무르지 않는다', async () => {
    const { analysisId } = await queueAnalysis();

    await expect(
      runOnce({
        pool: test.pool,
        storage: test.context.storage,
        analyzer: fakeAnalyzer(new Error('모델 호출 실패')),
      })
    ).rejects.toThrow();

    const { rows } = await test.pool.query<{ status: string; failure_reason: string }>(
      'SELECT status, failure_reason FROM structured.analyses WHERE id = $1',
      [analysisId]
    );

    // running으로 남으면 아무도 다시 집어가지 않는다.
    expect(rows[0]).toMatchObject({ status: 'failed', failure_reason: 'internal' });
  });

  it('촬영부터 비교까지 이어진다 — 업체 연결 전까지는 비교하지 않는다', async () => {
    const { headers, analysisId } = await queueAnalysis();

    await runOnce({
      pool: test.pool,
      storage: test.context.storage,
      analyzer: fakeAnalyzer(extraction()),
    });

    const quoteId = (
      await test.app.inject({ method: 'GET', url: `/v1/analyses/${analysisId}`, headers })
    ).json().quoteId;

    const confirmed = await test.app.inject({
      method: 'POST',
      url: `/v1/quotes/${quoteId}/confirmations`,
      headers,
      payload: {
        fields: [{ path: 'totalAmount' }, { path: 'contractDate' }, { path: 'refundTerms' }],
      },
    });

    expect(confirmed.json().confirmedAt).not.toBeNull();

    const comparison = await test.app.inject({
      method: 'GET',
      url: `/v1/quotes/${quoteId}/comparison`,
      headers,
    });

    // AI는 업체 이름을 읽었을 뿐이고, 어느 업체인지 확정하는 매칭은 아직 없다.
    // 그래서 비교하지 않고 이유를 준다 — 없는 가격을 만들지 않는다.
    expect(comparison.json()).toMatchObject({ available: false, reason: 'vendor_unknown' });
  });

  it('업체가 등록돼 있으면 연결되고 비교까지 이어진다', async () => {
    const vendor = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (category, name, region, source)
       VALUES ('hall', '테스트홀', '서울 강남구', 'vendor_official') RETURNING id`
    );
    const vendorId = vendor.rows[0]!.id;
    const key = productKey({ vendorId, productName: '기본 패키지' })!;

    // 다른 부부들의 인증된 계약. 시장 표본이 된다.
    const otherUser = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
    );
    const otherWedding = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.weddings (owner_user_id) VALUES ($1) RETURNING id',
      [otherUser.rows[0]!.id]
    );

    for (let index = 0; index < PRICING_POLICY.minimumSampleCount + 2; index += 1) {
      await test.pool.query(
        `INSERT INTO structured.quotes
           (wedding_id, vendor_id, doc_type, product_key, total_amount, contract_date,
            verification_level, source, confirmed_at)
         VALUES ($1, $2, 'contract', $3, $4, '2026-03-01', 'L2', 'ai_extraction', now())`,
        [otherWedding.rows[0]!.id, vendorId, key, 3_000_000 + index * 100_000]
      );
    }

    // 서비스정책서 4번: 시장 표본도 개인정보 재검토를 받아야 비교에 잡힌다.
    await markAllPiiReviewed(test);

    const { headers, analysisId } = await queueAnalysis();

    await runOnce({
      pool: test.pool,
      storage: test.context.storage,
      analyzer: fakeAnalyzer(extraction()),
    });

    const quoteId = (
      await test.app.inject({ method: 'GET', url: `/v1/analyses/${analysisId}`, headers })
    ).json().quoteId;

    await test.app.inject({
      method: 'POST',
      url: `/v1/quotes/${quoteId}/confirmations`,
      headers,
      payload: {
        fields: [{ path: 'totalAmount' }, { path: 'contractDate' }, { path: 'refundTerms' }],
      },
    });

    const comparison = (
      await test.app.inject({
        method: 'GET',
        url: `/v1/quotes/${quoteId}/comparison`,
        headers,
      })
    ).json();

    expect(comparison.available).toBe(true);
    expect(comparison.myAmount).toBe(3_280_000);
    expect(comparison.stat.sampleCount).toBe(PRICING_POLICY.minimumSampleCount + 2);
    expect(comparison.stat.minVerificationLevel).toBe('L2');
    // 표본 3,000,000~3,600,000의 중앙값은 3,300,000. 내 견적 3,280,000은 그 언저리다.
    expect(comparison.stat.median).toBe(3_300_000);
    expect(comparison.judgement).toBe('similar');
  });

  it('견적서에 적힌 조건을 빠짐없이 담는다', async () => {
    const { headers, analysisId } = await queueAnalysis();

    await runOnce({
      pool: test.pool,
      storage: test.context.storage,
      analyzer: fakeAnalyzer(
        extraction({
          hallName: { value: '그랜드볼룸', confidence: 0.9 },
          guaranteedGuests: { value: 200, confidence: 0.9 },
          mealPricePerPerson: { value: 68_000, confidence: 0.85 },
        })
      ),
    });

    const quoteId = (
      await test.app.inject({ method: 'GET', url: `/v1/analyses/${analysisId}`, headers })
    ).json().quoteId;
    const quote = (
      await test.app.inject({ method: 'GET', url: `/v1/quotes/${quoteId}`, headers })
    ).json();

    // 가계약 검증이 보는 값들. 계약조건 본문에만 있으면 비교할 수 없다.
    expect(quote).toMatchObject({
      depositAmount: 500_000,
      balanceAmount: 2_780_000,
      weddingDate: '2027-03-20',
      hallName: '그랜드볼룸',
      guaranteedGuests: 200,
      mealPricePerPerson: 68_000,
    });
  });

  it('패키지 안의 업체를 각각 담고 따로 매칭한다', async () => {
    // 스튜디오만 등록해두면 그것만 연결돼야 한다.
    await test.pool.query(
      `INSERT INTO structured.vendors (category, name, region, source)
       VALUES ('sdm', '세컨드플로어', '서울 강남구', 'vendor_official')`
    );

    const { headers, analysisId } = await queueAnalysis();

    await runOnce({
      pool: test.pool,
      storage: test.context.storage,
      analyzer: fakeAnalyzer(extraction()),
    });

    const quoteId = (
      await test.app.inject({ method: 'GET', url: `/v1/analyses/${analysisId}`, headers })
    ).json().quoteId;
    const subVendors = (
      await test.app.inject({ method: 'GET', url: `/v1/quotes/${quoteId}`, headers })
    ).json().subVendors;

    // 사업계획서 19번: 스튜디오·드레스·메이크업을 하나로 합치지 않는다.
    expect(subVendors).toHaveLength(3);
    expect(subVendors.find((v: { role: string }) => v.role === 'studio')).toMatchObject({
      name: '세컨드플로어',
      amount: 1_150_000,
      matched: true,
    });
    expect(subVendors.find((v: { role: string }) => v.role === 'dress')?.matched).toBe(false);
  });

  it('기준보다 무거운 위약금 조항에 안내를 붙인다', async () => {
    const { headers, analysisId } = await queueAnalysis();

    await runOnce({
      pool: test.pool,
      storage: test.context.storage,
      analyzer: fakeAnalyzer(
        extraction({
          terms: [
            {
              category: 'penalty',
              body: '예식일 30일 이내 취소 시 총액의 50%를 배상합니다.',
              flagged: true,
              daysBeforeWedding: 29,
              penaltyRate: 0.5,
            },
            {
              category: 'penalty',
              body: '예식일 59일 이내 취소 시 총액의 20%를 배상합니다.',
              flagged: false,
              daysBeforeWedding: 59,
              penaltyRate: 0.2,
            },
          ],
        })
      ),
    });

    const quoteId = (
      await test.app.inject({ method: 'GET', url: `/v1/analyses/${analysisId}`, headers })
    ).json().quoteId;
    const terms = (
      await test.app.inject({ method: 'GET', url: `/v1/quotes/${quoteId}`, headers })
    ).json().terms;

    const harsher = terms.find((t: { penaltyRate: number }) => t.penaltyRate === 0.5);
    const withinStandard = terms.find((t: { penaltyRate: number }) => t.penaltyRate === 0.2);

    // 소비자분쟁해결기준은 29일 이후 35%다. 50%는 그보다 무겁다.
    expect(harsher.standardNote).toContain('35%');
    expect(harsher.standardNote).toContain('50%');
    // 기준 안에 있는 조항에는 아무 말도 붙이지 않는다.
    expect(withinStandard.standardNote).toBeNull();
  });

  it('기본 제공이어야 할 항목이 추가비용에 있으면 알린다', async () => {
    const { headers, analysisId } = await queueAnalysis();

    await runOnce({
      pool: test.pool,
      storage: test.context.storage,
      analyzer: fakeAnalyzer(
        extraction({
          lineItems: [
            {
              kind: 'additional_candidate',
              label: '메이크업 얼리스타트(오전 6시 이전)',
              amount: 50_000,
              amountMin: null,
              amountMax: null,
              note: null,
            },
            {
              kind: 'additional_candidate',
              label: '지방 예식 출장비',
              amount: null,
              amountMin: null,
              amountMax: null,
              note: '별도 협의',
            },
          ],
        })
      ),
    });

    const quoteId = (
      await test.app.inject({ method: 'GET', url: `/v1/analyses/${analysisId}`, headers })
    ).json().quoteId;
    const items = (
      await test.app.inject({ method: 'GET', url: `/v1/quotes/${quoteId}`, headers })
    ).json().lineItems;

    // 공정거래위원회가 기본 제공에 포함하도록 시정한 항목이다.
    expect(items.find((i: { label: string }) => i.label.includes('얼리스타트')).standardNote)
      .toContain('기본 제공');
    expect(items.find((i: { label: string }) => i.label.includes('출장비')).standardNote).toBeNull();
  });

  it('범위로 적힌 금액을 하한·상한으로 담는다', async () => {
    const { headers, analysisId } = await queueAnalysis();

    await runOnce({
      pool: test.pool,
      storage: test.context.storage,
      analyzer: fakeAnalyzer(
        extraction({
          lineItems: [
            {
              kind: 'additional_candidate',
              label: '생화 장식 업그레이드',
              amount: null,
              amountMin: 1_500_000,
              amountMax: 3_000_000,
              note: '150만원 ~ 300만원',
            },
          ],
        })
      ),
    });

    const quoteId = (
      await test.app.inject({ method: 'GET', url: `/v1/analyses/${analysisId}`, headers })
    ).json().quoteId;
    const items = (
      await test.app.inject({ method: 'GET', url: `/v1/quotes/${quoteId}`, headers })
    ).json().lineItems;

    expect(items[0]).toMatchObject({ amountMin: 1_500_000, amountMax: 3_000_000 });
  });

  it('워커가 여럿이어도 같은 문서를 두 번 분석하지 않는다', async () => {
    await queueAnalysis();

    const deps = {
      pool: test.pool,
      storage: test.context.storage,
      analyzer: fakeAnalyzer(extraction()),
    };

    const [first, second] = await Promise.all([runOnce(deps), runOnce(deps)]);

    // AI 호출은 비용이다. 한 건은 잡고 한 건은 빈손이어야 한다.
    expect([first, second].filter(Boolean)).toHaveLength(1);

    const { rows } = await test.pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM structured.quotes'
    );
    expect(rows[0]!.count).toBe('1');
  });
});
