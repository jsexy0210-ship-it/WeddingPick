import { createTestApp, resetDatabase, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 서비스정책서 4번의 "사람 재검토 1단계"를 스키마가 지키는지.
 *
 * 검토를 받기 전에는 그 문서의 값이 남들이 보는 면(시장 대표가격)으로 가지 않는다.
 * 도구를 거치지 않고 SQL로 직접 건드려도 마찬가지여야 한다.
 */
describeWithDb('개인정보 재검토', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  /** 개인정보 재검토 말고는 모든 조건을 갖춘 문서 하나. */
  async function createShareableQuote() {
    const user = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
    );
    const wedding = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.weddings (owner_user_id) VALUES ($1) RETURNING id',
      [user.rows[0]!.id]
    );
    const vendor = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ('아펠가모 공덕', 'hall', '서울', 'public_data') RETURNING id`
    );
    const quote = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.quotes
         (wedding_id, source, doc_type, vendor_id, product_key, total_amount,
          contract_date, confirmed_at, verification_level)
       VALUES ($1, 'ai_extraction', 'contract', $2, 'k', 32800000,
               '2026-05-01', now(), 'L2') RETURNING id`,
      [wedding.rows[0]!.id, vendor.rows[0]!.id]
    );

    return { quoteId: quote.rows[0]!.id, reviewerId: user.rows[0]!.id };
  }

  async function inComparable(quoteId: string) {
    const { rows } = await test.pool.query(
      'SELECT 1 FROM structured.comparable_quotes WHERE id = $1',
      [quoteId]
    );

    return rows.length > 0;
  }

  it('새로 만든 문서는 검토 전이다', async () => {
    const { quoteId } = await createShareableQuote();

    const { rows } = await test.pool.query<{ pii_review: string }>(
      'SELECT pii_review FROM structured.quotes WHERE id = $1',
      [quoteId]
    );

    expect(rows[0]!.pii_review).toBe('pending');
  });

  it('검토 전에는 가격 비교에 들어가지 않는다', async () => {
    const { quoteId } = await createShareableQuote();

    // 등급도 L2이고 사용자 확인도 마쳤다. 막는 것은 재검토 하나다.
    expect(await inComparable(quoteId)).toBe(false);
  });

  it('검토를 받으면 들어간다', async () => {
    const { quoteId, reviewerId } = await createShareableQuote();

    await test.pool.query(
      `UPDATE structured.quotes
       SET pii_review = 'clean', pii_reviewed_at = now(), pii_reviewed_by = $2
       WHERE id = $1`,
      [quoteId, reviewerId]
    );

    expect(await inComparable(quoteId)).toBe(true);
  });

  it('지우고 확인한 것도 들어간다', async () => {
    const { quoteId, reviewerId } = await createShareableQuote();

    await test.pool.query(
      `UPDATE structured.quotes
       SET pii_review = 'redacted', pii_reviewed_at = now(), pii_reviewed_by = $2
       WHERE id = $1`,
      [quoteId, reviewerId]
    );

    expect(await inComparable(quoteId)).toBe(true);
  });

  it('사람 없이 검토를 마쳤다고 적을 수 없다', async () => {
    const { quoteId } = await createShareableQuote();

    await expect(
      test.pool.query(
        "UPDATE structured.quotes SET pii_review = 'clean' WHERE id = $1",
        [quoteId]
      )
    ).rejects.toThrow(/pii_review_has_reviewer/);
  });

  it('검토 대기 목록은 글자를 그대로 옮겨온 필드를 함께 보여준다', async () => {
    const { quoteId } = await createShareableQuote();

    await test.pool.query(
      `INSERT INTO structured.contract_terms (quote_id, category, body)
       VALUES ($1, 'refund', '문의는 담당 실장 010-2345-6789로 연락 바랍니다.')`,
      [quoteId]
    );

    const { rows } = await test.pool.query<{
      vendor_name_raw: string | null;
      contract_terms: string;
    }>('SELECT vendor_name_raw, contract_terms FROM structured.pending_pii_reviews WHERE id = $1', [
      quoteId,
    ]);

    // 검토자가 봐야 하는 것은 문서 한 줄이 아니라 이 글자들이다.
    expect(rows[0]!.contract_terms).toContain('010-2345-6789');
  });

  it('검토를 마치면 대기 목록에서 빠진다', async () => {
    const { quoteId, reviewerId } = await createShareableQuote();

    await test.pool.query(
      `UPDATE structured.quotes
       SET pii_review = 'clean', pii_reviewed_at = now(), pii_reviewed_by = $2
       WHERE id = $1`,
      [quoteId, reviewerId]
    );

    const { rows } = await test.pool.query(
      'SELECT 1 FROM structured.pending_pii_reviews WHERE id = $1',
      [quoteId]
    );

    expect(rows).toHaveLength(0);
  });

  it('지운 기록에 지운 값은 남기지 않는다', async () => {
    const { quoteId, reviewerId } = await createShareableQuote();

    await test.pool.query(
      `INSERT INTO structured.pii_redactions (quote_id, field, kind, redacted_by)
       VALUES ($1, 'contractTerms', 'phone', $2)`,
      [quoteId, reviewerId]
    );

    const { rows } = await test.pool.query<Record<string, unknown>>(
      'SELECT * FROM structured.pii_redactions WHERE quote_id = $1',
      [quoteId]
    );

    // 개인정보를 지우면서 그 개인정보를 다른 표에 옮겨 적으면 지운 것이 아니다.
    expect(Object.keys(rows[0]!)).toEqual(
      expect.not.arrayContaining(['value', 'redacted_value', 'body'])
    );
  });
});
