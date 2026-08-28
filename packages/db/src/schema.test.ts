import { Client } from 'pg';

import { migrate } from './migrate';

const connectionString = process.env.DATABASE_URL;
const describeWithDb = connectionString ? describe : describe.skip;

if (!connectionString) {
  console.warn('DATABASE_URL이 없어 DB 스키마 테스트를 건너뛴다.');
}

let client: Client;

async function reset() {
  // 이 역할이 만든 모든 객체(스키마·타입·테이블)를 지우고 다시 올린다.
  await client.query('DROP OWNED BY CURRENT_USER CASCADE');
  await migrate(client);
}

async function seedQuote(options: {
  level?: string;
  confirmed?: boolean;
  amount?: number;
  productKey?: string | null;
  contractDate?: string | null;
  /** 개인정보 재검토를 마쳤는지. 서비스정책서 4번. */
  piiReviewed?: boolean;
}) {
  const user = await client.query<{ id: string }>(
    'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
  );
  const userId = user.rows[0]!.id;

  const wedding = await client.query<{ id: string }>(
    'INSERT INTO structured.weddings (owner_user_id) VALUES ($1) RETURNING id',
    [userId]
  );
  const vendor = await client.query<{ id: string }>(
    `INSERT INTO structured.vendors (category, name, region, source)
     VALUES ('hall', '테스트홀', '서울', 'vendor_official') RETURNING id`
  );

  const quote = await client.query<{ id: string }>(
    `INSERT INTO structured.quotes
       (wedding_id, vendor_id, doc_type, product_key, total_amount, contract_date,
        verification_level, source, confirmed_at)
     VALUES ($1, $2, 'contract', $3, $4, $5, $6, 'ai_extraction', $7)
     RETURNING id`,
    [
      wedding.rows[0]!.id,
      vendor.rows[0]!.id,
      options.productKey === undefined ? '홀-기본패키지' : options.productKey,
      options.amount ?? 10_000_000,
      options.contractDate === undefined ? '2026-05-01' : options.contractDate,
      options.level ?? 'L2',
      options.confirmed === false ? null : new Date(),
    ]
  );

  // 서비스정책서 4번: 개인정보 재검토를 받아야 남들이 보는 면으로 간다.
  if (options.piiReviewed !== false) {
    await client.query(
      `UPDATE structured.quotes
       SET pii_review = 'clean', pii_reviewed_at = now(), pii_reviewed_by = $2
       WHERE id = $1`,
      [quote.rows[0]!.id, userId]
    );
  }

  return { userId, quoteId: quote.rows[0]!.id, vendorId: vendor.rows[0]!.id };
}

describeWithDb('DB 스키마', () => {
  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  beforeEach(reset);

  describe('사용자 확인 단계', () => {
    it('핵심 필드가 확인되지 않으면 문서를 확인 완료로 표시할 수 없다', async () => {
      const { quoteId } = await seedQuote({ confirmed: false });

      await client.query(
        `INSERT INTO structured.extraction_fields (quote_id, field_path, extracted_value, confidence)
         VALUES ($1, 'totalAmount', '10000000', 0.4)`,
        [quoteId]
      );

      // 서비스정책서 1번: 계약금액·계약일·환불조건은 예외 없이 확인을 거친다.
      await expect(
        client.query('UPDATE structured.quotes SET confirmed_at = now() WHERE id = $1', [quoteId])
      ).rejects.toThrow(/확인되지 않은 핵심 필드/);
    });

    it('핵심 필드가 모두 확인되면 통과한다', async () => {
      const { quoteId } = await seedQuote({ confirmed: false });

      await client.query(
        `INSERT INTO structured.extraction_fields
           (quote_id, field_path, extracted_value, confidence, confirmed_by_user)
         VALUES ($1, 'totalAmount', '10000000', 0.4, true)`,
        [quoteId]
      );

      await expect(
        client.query('UPDATE structured.quotes SET confirmed_at = now() WHERE id = $1', [quoteId])
      ).resolves.toBeDefined();
    });

    it('핵심이 아닌 필드는 확인되지 않아도 막지 않는다', async () => {
      const { quoteId } = await seedQuote({ confirmed: false });

      await client.query(
        `INSERT INTO structured.extraction_fields (quote_id, field_path, extracted_value, confidence)
         VALUES ($1, 'productName', '기본패키지', 0.2)`,
        [quoteId]
      );

      await expect(
        client.query('UPDATE structured.quotes SET confirmed_at = now() WHERE id = $1', [quoteId])
      ).resolves.toBeDefined();
    });
  });

  describe('시장 가격에 들어갈 자격', () => {
    async function comparableCount() {
      const { rows } = await client.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM structured.comparable_quotes'
      );
      return Number(rows[0]!.count);
    }

    it('L2 이상이고 확인을 마친 문서는 들어간다', async () => {
      await seedQuote({ level: 'L2' });

      expect(await comparableCount()).toBe(1);
    });

    it('L1 이하는 확인을 마쳤어도 빠진다', async () => {
      await seedQuote({ level: 'L1' });

      expect(await comparableCount()).toBe(0);
    });

    it('확인을 마치지 않은 문서는 등급이 높아도 빠진다', async () => {
      await seedQuote({ level: 'L4', confirmed: false });

      expect(await comparableCount()).toBe(0);
    });

    it('상품 키가 없으면 빠진다 — 무엇과 견줄지 알 수 없다', async () => {
      await seedQuote({ productKey: null });

      expect(await comparableCount()).toBe(0);
    });

    it('개인정보 재검토를 받지 않으면 등급이 높아도 빠진다', async () => {
      // 등급은 "이 금액이 진짜인가"를 보고, 재검토는 "남의 개인정보가 섞여 있지
      // 않은가"를 본다. 서로 다른 질문이라 둘 다 통과해야 한다.
      await seedQuote({ level: 'L4', piiReviewed: false });

      expect(await comparableCount()).toBe(0);
    });
  });

  describe('가격 통계', () => {
    async function insertStat(overrides: Partial<Record<string, unknown>> = {}) {
      const { vendorId } = await seedQuote({});
      const values = {
        sample_count: 12,
        period_start: '2026-01-01',
        period_end: '2026-06-30',
        median: 10_000_000,
        p25: 9_000_000,
        p75: 11_000_000,
        p90: 12_000_000,
        min_verification_level: 'L2',
        ...overrides,
      };

      return client.query(
        `INSERT INTO stats.price_stats
           (vendor_id, product_key, doc_type, sample_count, period_start, period_end,
            median, p25, p75, p90, min_verification_level)
         VALUES ($1, '홀-기본패키지', 'contract', $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          vendorId,
          values.sample_count,
          values.period_start,
          values.period_end,
          values.median,
          values.p25,
          values.p75,
          values.p90,
          values.min_verification_level,
        ]
      );
    }

    it('정상적인 통계는 들어간다', async () => {
      await expect(insertStat()).resolves.toBeDefined();
    });

    it('L2 미만 데이터로 만든 통계는 저장할 수 없다', async () => {
      // 서비스정책서 2번.
      await expect(insertStat({ min_verification_level: 'L1' })).rejects.toThrow(
        /market_price_needs_verified_data/
      );
    });

    it('분위수 순서가 어긋나면 저장할 수 없다', async () => {
      await expect(insertStat({ p25: 99_000_000 })).rejects.toThrow(/quantiles_are_ordered/);
    });

    it('기준 기간이 뒤집히면 저장할 수 없다', async () => {
      await expect(
        insertStat({ period_start: '2026-06-30', period_end: '2026-01-01' })
      ).rejects.toThrow(/period_is_ordered/);
    });
  });

  describe('원본 문서', () => {
    /**
     * 원본 하나.
     *
     * 파기 예정일은 저장하지 않고 계산한다(0018) — 검증이 끝난 날로부터 센다.
     * 아무 일도 없는 문서는 업로드가 기준이라, 업로드 시각을 옮겨 만료를 만든다.
     */
    async function seedRawDocument(age: 'expired' | 'fresh' = 'fresh') {
      const user = await client.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );

      const uploaded =
        age === 'expired'
          ? new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
          : new Date();

      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO originals.raw_documents (owner_user_id, page_count, uploaded_at)
         VALUES ($1, 2, $2) RETURNING id`,
        [user.rows[0]!.id, uploaded]
      );

      const documentId = rows[0]!.id;

      // 스토리지 키는 장마다 따로 있다 (0003).
      await client.query(
        `INSERT INTO originals.raw_document_pages
           (raw_document_id, page_index, storage_key, mime_type)
         VALUES ($1, 0, $2, 'image/jpeg')`,
        [documentId, `key-${Math.random()}`]
      );

      return documentId;
    }

    it('원본을 지워도 구조화 데이터는 남고 연결만 끊긴다', async () => {
      const rawId = await seedRawDocument();
      const { quoteId } = await seedQuote({});

      await client.query('UPDATE structured.quotes SET raw_document_id = $1 WHERE id = $2', [
        rawId,
        quoteId,
      ]);
      await client.query('DELETE FROM originals.raw_documents WHERE id = $1', [rawId]);

      const { rows } = await client.query<{ raw_document_id: string | null }>(
        'SELECT raw_document_id FROM structured.quotes WHERE id = $1',
        [quoteId]
      );

      // 핵심 자산은 원본이 아니라 구조화된 데이터다. 사업계획서 28번.
      expect(rows).toHaveLength(1);
      expect(rows[0]!.raw_document_id).toBeNull();
    });

    it('만료된 원본만 삭제 대상 목록에 올라온다', async () => {
      await seedRawDocument('expired');
      await seedRawDocument('fresh');

      const { rows } = await client.query('SELECT id FROM originals.expired_documents');

      expect(rows).toHaveLength(1);
    });

    it('심사가 열려 있으면 아무리 오래돼도 삭제 대상이 아니다', async () => {
      const rawId = await seedRawDocument('expired');
      const user = await client.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );
      const wedding = await client.query<{ id: string }>(
        'INSERT INTO structured.weddings (owner_user_id) VALUES ($1) RETURNING id',
        [user.rows[0]!.id]
      );
      const quote = await client.query<{ id: string }>(
        `INSERT INTO structured.quotes (wedding_id, raw_document_id, source)
         VALUES ($1, $2, 'ai_extraction') RETURNING id`,
        [wedding.rows[0]!.id, rawId]
      );
      const request = await client.query<{ id: string }>(
        `INSERT INTO structured.verification_requests (quote_id, requested_by, target_level)
         VALUES ($1, $2, 'L2') RETURNING id`,
        [quote.rows[0]!.id, user.rows[0]!.id]
      );
      await client.query(
        `INSERT INTO structured.verification_evidence (request_id, kind, raw_document_id)
         VALUES ($1, 'contract_document', $2)`,
        [request.rows[0]!.id, rawId]
      );

      // 지우면 심사자가 확인할 근거를 잃는다. 셈은 심사가 끝나야 시작된다.
      const expired = await client.query('SELECT id FROM originals.expired_documents');
      const held = await client.query(
        'SELECT id FROM originals.retention_held_for_verification'
      );

      expect(expired.rows).toHaveLength(0);
      expect(held.rows).toHaveLength(1);
    });

    it('삭제 상태와 삭제 시각이 어긋나면 저장할 수 없다', async () => {
      const rawId = await seedRawDocument();

      await expect(
        client.query(`UPDATE originals.raw_documents SET status = 'deleted' WHERE id = $1`, [rawId])
      ).rejects.toThrow(/deleted_status_matches_timestamp/);
    });
  });

  describe('배우자 연결', () => {
    it('자기 자신을 배우자로 연결할 수 없다', async () => {
      const user = await client.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );
      const userId = user.rows[0]!.id;

      await expect(
        client.query(
          'INSERT INTO structured.weddings (owner_user_id, partner_user_id) VALUES ($1, $1)',
          [userId]
        )
      ).rejects.toThrow(/partner_is_not_owner/);
    });
  });

  describe('마이그레이션', () => {
    it('두 번 돌려도 같은 결과가 된다', async () => {
      await expect(migrate(client)).resolves.toEqual([]);
    });
  });
});
