import { Client } from 'pg';

import { migrate } from './migrate';
import { resetSchema } from './reset';

const connectionString = process.env.DATABASE_URL;
const describeWithDb = connectionString ? describe : describe.skip;

if (!connectionString) {
  console.warn('DATABASE_URL이 없어 DB 스키마 테스트를 건너뛴다.');
}

let client: Client;

async function reset() {
  // 마이그레이션이 만든 것만 지우고 다시 올린다. 한 벌을 둘이 나눠 쓴다.
  await resetSchema(client);
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

  describe('후기 확인 배지', () => {
    async function vendorAndUser() {
      const vendor = await client.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source)
         VALUES ('가온예식홀', 'hall', '서울', 'public_data') RETURNING id`
      );
      const user = await client.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );

      return { vendorId: vendor.rows[0]!.id, userId: user.rows[0]!.id };
    }

    const insert = (vendorId: string, userId: string, verification: string, extra = '') =>
      client.query(
        `INSERT INTO structured.reviews
           (vendor_id, author_user_id, role, overall, title, body, verification${extra ? ', verified_at' : ''})
         VALUES ($1, $2, 'contractor', 4, '제목', repeat('가', 60), $3::review_verification${extra})`,
        [vendorId, userId, verification]
      );

    it('근거 없는 이용인증을 만들 수 없다', async () => {
      /*
       * 0023의 CASE에는 ELSE가 없었다. 0028이 'usage'를 더하는 순간 그 값은 CASE에서
       * NULL이 되고 **NULL은 CHECK를 통과한다** — enum에 값을 더하는 것만으로 제약이
       * 조용히 뚫렸다. 0029가 ELSE false를 넣어 막았고, 이 테스트가 그걸 지킨다.
       */
      const { vendorId, userId } = await vendorAndUser();

      await expect(insert(vendorId, userId, 'usage')).rejects.toThrow(
        /verification_names_its_evidence/
      );
    });

    it('근거 없는 계약인증도 막힌다', async () => {
      const { vendorId, userId } = await vendorAndUser();

      await expect(insert(vendorId, userId, 'contract')).rejects.toThrow(
        /verification_names_its_evidence/
      );
    });

    it('상담제보는 근거 없이 만들 수 있다', async () => {
      // 근거가 없다는 뜻이 아니라, 이 사람이 겪은 일을 적었다는 뜻이다.
      const { vendorId, userId } = await vendorAndUser();

      await expect(insert(vendorId, userId, 'reported')).resolves.toBeDefined();
    });
  });

  describe('업체 반론', () => {
    async function aReview() {
      const vendor = await client.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source)
         VALUES ('가온예식홀', 'hall', '서울', 'public_data') RETURNING id`
      );
      const author = await client.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );
      const review = await client.query<{ id: string }>(
        `INSERT INTO structured.reviews (vendor_id, author_user_id, role, overall, title, body)
         VALUES ($1, $2, 'contractor', 2, '제목', repeat('가', 60)) RETURNING id`,
        [vendor.rows[0]!.id, author.rows[0]!.id]
      );
      const submitter = await client.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );

      return { reviewId: review.rows[0]!.id, submitterId: submitter.rows[0]!.id };
    }

    const submit = (reviewId: string, submitterId: string, extra = '') =>
      client.query(
        `INSERT INTO structured.review_rebuttals
           (review_id, submitted_by_user_id, claimed_role, body${extra ? ', status' : ''})
         VALUES ($1, $2, '가온예식홀 예약팀장', repeat('가', 40)${extra})
         RETURNING id`,
        [reviewId, submitterId]
      );

    it('사람이 결정하지 않은 반론은 게시 상태가 될 수 없다', async () => {
      /*
       * 자동 게시가 열리면, 업체라고 말하기만 하면 누구나 남의 후기 아래에 글을
       * 실을 수 있게 된다. 그 문을 관례가 아니라 제약으로 닫는다.
       */
      const { reviewId, submitterId } = await aReview();

      await expect(submit(reviewId, submitterId, ", 'published'")).rejects.toThrow(
        /rebuttal_decision_is_dated/
      );
    });

    it('심사를 마쳤다면 누가 언제 했는지가 남는다', async () => {
      const { reviewId, submitterId } = await aReview();
      const { rows } = await submit(reviewId, submitterId);
      const reviewer = await client.query<{ id: string }>(
        'INSERT INTO structured.users (is_operator) VALUES (true) RETURNING id'
      );

      // 결정만 적고 사람을 비우면 막힌다.
      await expect(
        client.query(
          `UPDATE structured.review_rebuttals SET status = 'published', decided_at = now()
           WHERE id = $1`,
          [rows[0]!.id]
        )
      ).rejects.toThrow(/rebuttal_decision_has_reviewer/);

      await expect(
        client.query(
          `UPDATE structured.review_rebuttals
           SET status = 'published', decided_at = now(), decided_by = $2
           WHERE id = $1`,
          [rows[0]!.id, reviewer.rows[0]!.id]
        )
      ).resolves.toBeDefined();
    });

    it('게시된 것만 후기 옆에 붙는다', async () => {
      const { reviewId, submitterId } = await aReview();
      const { rows } = await submit(reviewId, submitterId);
      const reviewer = await client.query<{ id: string }>(
        'INSERT INTO structured.users (is_operator) VALUES (true) RETURNING id'
      );

      const before = await client.query('SELECT 1 FROM structured.published_rebuttals');
      expect(before.rows).toHaveLength(0);

      await client.query(
        `UPDATE structured.review_rebuttals
         SET status = 'published', decided_at = now(), decided_by = $2 WHERE id = $1`,
        [rows[0]!.id, reviewer.rows[0]!.id]
      );

      const after = await client.query('SELECT 1 FROM structured.published_rebuttals');
      expect(after.rows).toHaveLength(1);
    });

    it('거절된 반론은 붙지 않는다', async () => {
      const { reviewId, submitterId } = await aReview();
      const { rows } = await submit(reviewId, submitterId);
      const reviewer = await client.query<{ id: string }>(
        'INSERT INTO structured.users (is_operator) VALUES (true) RETURNING id'
      );

      await client.query(
        `UPDATE structured.review_rebuttals
         SET status = 'rejected', decided_at = now(), decided_by = $2 WHERE id = $1`,
        [rows[0]!.id, reviewer.rows[0]!.id]
      );

      const published = await client.query('SELECT 1 FROM structured.published_rebuttals');
      expect(published.rows).toHaveLength(0);
    });

    it('후기 하나에 반론 하나다', async () => {
      // 여럿을 허용하면 후기 페이지가 말싸움이 된다.
      const { reviewId, submitterId } = await aReview();

      await submit(reviewId, submitterId);

      await expect(submit(reviewId, submitterId)).rejects.toThrow(/review_rebuttals_review_id_key/);
    });

    it('소속을 밝히지 않은 반론은 들어가지 않는다', async () => {
      const { reviewId, submitterId } = await aReview();

      await expect(
        client.query(
          `INSERT INTO structured.review_rebuttals
             (review_id, submitted_by_user_id, claimed_role, body)
           VALUES ($1, $2, '   ', repeat('가', 40))`,
          [reviewId, submitterId]
        )
      ).rejects.toThrow();
    });
  });

  describe('의사결정 기록', () => {
    async function anOperator() {
      const { rows } = await client.query<{ id: string }>(
        'INSERT INTO structured.users (is_operator) VALUES (true) RETURNING id'
      );

      return rows[0]!.id;
    }

    const insert = (columns: string, values: string, params: unknown[] = []) =>
      client.query(
        `INSERT INTO structured.decisions
           (event_id, workflow, step, subject_kind, decision, reason_code, policy_version,
            ${columns})
         VALUES (gen_random_uuid(), 'w', 's', 'rebuttal', 'published', 'ok', 'v2.0',
            ${values})
         RETURNING id`,
        params
      );

    it('이름 없는 사람 결정을 막는다', async () => {
      await expect(insert('decider', `'human'`)).rejects.toThrow(
        /human_decision_names_the_person/
      );
    });

    it('판 없는 규칙 결정을 막는다', async () => {
      /*
       * 규칙이 바뀌면 과거 결정을 다시 읽을 수 있어야 한다. 어느 판이 내린
       * 결정인지 모르면 그 결정은 재현할 수 없다.
       */
      await expect(insert('decider', `'rule'`)).rejects.toThrow(
        /rule_decision_names_its_version/
      );

      await expect(
        insert('decider, rule_version', `'rule', 'payment-parser@3'`)
      ).resolves.toBeDefined();
    });

    it('확신 없는 모델 결정을 막는다', async () => {
      // B-2: 모든 AI 판단에는 confidence와 판단근거를 기록한다.
      await expect(insert('decider, model', `'model', 'claude-haiku-4-5'`)).rejects.toThrow(
        /model_decision_names_its_model/
      );

      await expect(
        insert('decider, model, confidence', `'model', 'claude-haiku-4-5', 0.82`)
      ).resolves.toBeDefined();
    });

    it('사람 결정에는 사람이 남는다', async () => {
      const operator = await anOperator();

      await expect(
        insert('decider, actor_user_id', `'human', $1`, [operator])
      ).resolves.toBeDefined();
    });

    it('근거에 값을 적을 수 없다', async () => {
      /*
       * L장: 개인정보는 이 로그에 불필요하게 복제하지 않는다. 관례가 아니라
       * 제약으로 지킨다 — {kind, id} 외의 키가 들어올 자리가 없다.
       */
      const withValue = insert(
        'decider, rule_version, evidence_refs',
        `'rule', 'v1', '[{"kind": "card", "id": "x", "number": "1234-5678"}]'::jsonb`
      );

      await expect(withValue).rejects.toThrow(/evidence_refs_only_point/);
    });

    it('근거는 가리키기만 하면 통과한다', async () => {
      await expect(
        insert(
          'decider, rule_version, evidence_refs',
          `'rule', 'v1', '[{"kind": "review", "id": "abc"}]'::jsonb`
        )
      ).resolves.toBeDefined();
    });

    it('가리키는 것이 아니면 막는다', async () => {
      // 문자열만 담긴 배열, 객체가 아닌 것, id가 빠진 것 모두.
      for (const refs of [`'["abc"]'`, `'[{"kind": "review"}]'`, `'{"kind": "review"}'`]) {
        await expect(
          insert('decider, rule_version, evidence_refs', `'rule', 'v1', ${refs}::jsonb`)
        ).rejects.toThrow(/evidence_refs_only_point/);
      }
    });

    it('확신은 0과 1 사이다', async () => {
      await expect(
        insert('decider, model, confidence', `'model', 'm', 1.5`)
      ).rejects.toThrow();
    });

    it('끝나지 않은 결정만 따로 볼 수 있다', async () => {
      // H장의 "진짜 확인 필요". 이 뷰가 비어 있는 것이 정상이다.
      await insert('decider, rule_version', `'rule', 'v1'`);

      const quiet = await client.query('SELECT 1 FROM structured.open_decisions');
      expect(quiet.rows).toHaveLength(0);

      await insert(
        'decider, rule_version, execution_status',
        `'rule', 'v1', 'failed'::decision_execution`
      );

      const noisy = await client.query('SELECT 1 FROM structured.open_decisions');
      expect(noisy.rows).toHaveLength(1);
    });
  });

  describe('업체 관계자 인증', () => {
    async function aVendor(officialDomain: string | null = 'gaon.co.kr') {
      const vendor = await client.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source, official_domain)
         VALUES ('가온예식홀', 'hall', '서울', 'public_data', $1) RETURNING id`,
        [officialDomain]
      );
      const claimant = await client.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );

      return { vendorId: vendor.rows[0]!.id, claimantId: claimant.rows[0]!.id };
    }

    async function aDocument(ownerId: string) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO originals.raw_documents (owner_user_id, page_count)
         VALUES ($1, 1) RETURNING id`,
        [ownerId]
      );

      return rows[0]!.id;
    }

    const claim = (
      vendorId: string,
      claimantId: string,
      columns: string,
      values: string
    ) =>
      client.query(
        `INSERT INTO structured.vendor_claims
           (vendor_id, claimant_user_id, claimed_role, ${columns})
         VALUES ($1, $2, '예약팀장', ${values})
         RETURNING id`,
        [vendorId, claimantId]
      );

    it('공식 도메인 이메일 신청은 주소를 들고 온다', async () => {
      const { vendorId, claimantId } = await aVendor();

      await expect(
        claim(vendorId, claimantId, 'method, contact_email', `'official_domain_email', 'yeji@gaon.co.kr'`)
      ).resolves.toBeDefined();
    });

    it('주소 없는 이메일 신청은 들어오지 못한다', async () => {
      const { vendorId, claimantId } = await aVendor();

      await expect(
        claim(vendorId, claimantId, 'method', `'official_domain_email'`)
      ).rejects.toThrow(/email_methods_have_an_email/);
    });

    it('공개된 이메일은 어디에 공개돼 있는지가 함께 남는다', async () => {
      const { vendorId, claimantId } = await aVendor();

      await expect(
        claim(vendorId, claimantId, 'method, contact_email', `'listed_email', 'yeji@naver.com'`)
      ).rejects.toThrow(/listed_email_says_where/);

      await expect(
        claim(
          vendorId,
          claimantId,
          'method, contact_email, listed_at',
          `'listed_email', 'yeji@naver.com', '공식 홈페이지 하단'`
        )
      ).resolves.toBeDefined();
    });

    it('증빙 수단은 증빙 없이 들어오지 못한다', async () => {
      const { vendorId, claimantId } = await aVendor();

      await expect(
        claim(vendorId, claimantId, 'method', `'business_document'`)
      ).rejects.toThrow(/document_method_has_a_document/);

      const documentId = await aDocument(claimantId);

      await expect(
        claim(
          vendorId,
          claimantId,
          'method, evidence_document_id',
          `'business_document', '${documentId}'::uuid`
        )
      ).resolves.toBeDefined();
    });

    it('사람이 결정하지 않은 신청은 확인 완료가 될 수 없다', async () => {
      const { vendorId, claimantId } = await aVendor();

      await expect(
        claim(
          vendorId,
          claimantId,
          'method, contact_email, status',
          `'official_domain_email', 'yeji@gaon.co.kr', 'approved'`
        )
      ).rejects.toThrow(/claim_decision_is_dated/);
    });

    it('결정한 때만 있고 사람이 없을 수 없다', async () => {
      /*
       * 0032에서 배운 것이다. 두 조건을 한 제약으로 묶으면 양변이 나란히
       * false가 되는 구멍이 생겨, 사람 없이 결론난 줄이 통과한다.
       */
      const { vendorId, claimantId } = await aVendor();

      await expect(
        claim(
          vendorId,
          claimantId,
          'method, contact_email, status, decided_at',
          `'official_domain_email', 'yeji@gaon.co.kr', 'approved', now()`
        )
      ).rejects.toThrow(/claim_decision_names_the_person/);
    });

    it('확인 중인 신청을 한 업체에 둘 들 수 없다', async () => {
      const { vendorId, claimantId } = await aVendor();

      await claim(
        vendorId,
        claimantId,
        'method, contact_email',
        `'official_domain_email', 'yeji@gaon.co.kr'`
      );

      await expect(
        claim(vendorId, claimantId, 'method, contact_email', `'listed_email', 'yeji@naver.com'`)
      ).rejects.toThrow();
    });

    it('확인된 관계자 목록에는 증빙도 연락처도 열이 없다', async () => {
      /*
       * 원문 27번: 일반 사용자에게 원본 공개하지 않음. 화면이 실수로 꺼내려
       * 해도 꺼낼 열 자체가 없어야 한다.
       */
      const { rows } = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'structured' AND table_name = 'approved_vendor_claims'`
      );

      const columns = rows.map((row) => row.column_name);

      expect(columns).not.toContain('contact_email');
      expect(columns).not.toContain('evidence_document_id');
      expect(columns).not.toContain('listed_at');
      expect(columns).toContain('claimed_role');
    });

    it('심사가 열려 있는 동안에는 증빙이 파기 목록에 오르지 않는다', async () => {
      /*
       * 사업자 증빙은 업로드 30일 뒤에 지워진다. 그때까지 심사가 안 끝나 있으면
       * 심사하는 사람이 볼 것이 사라진다. 0018이 인증 심사에 낸 답을 관계자
       * 인증에도 쓴다.
       */
      const { vendorId, claimantId } = await aVendor();
      const documentId = await aDocument(claimantId);

      await client.query(
        `INSERT INTO originals.raw_document_pages
           (raw_document_id, page_index, storage_key, mime_type)
         VALUES ($1, 0, 'claims/' || gen_random_uuid(), 'image/jpeg')`,
        [documentId]
      );

      await client.query(
        "UPDATE originals.raw_documents SET uploaded_at = now() - interval '400 days' WHERE id = $1",
        [documentId]
      );

      const beforeClaim = await client.query(
        'SELECT 1 FROM originals.expired_documents WHERE id = $1',
        [documentId]
      );

      expect(beforeClaim.rows).toHaveLength(1);

      const claimed = await claim(
        vendorId,
        claimantId,
        'method, evidence_document_id',
        `'business_document', '${documentId}'::uuid`
      );

      const held = await client.query(
        'SELECT 1 FROM originals.expired_documents WHERE id = $1',
        [documentId]
      );

      expect(held.rows).toHaveLength(0);

      // 결론이 나면 다시 셈이 시작된다. 무기한으로 늘어나지 않는다.
      const decider = await client.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );

      await client.query(
        `UPDATE structured.vendor_claims
         SET status = 'approved', decided_at = now() - interval '400 days', decided_by = $2
         WHERE id = $1`,
        [claimed.rows[0]!.id, decider.rows[0]!.id]
      );

      const released = await client.query(
        'SELECT 1 FROM originals.expired_documents WHERE id = $1',
        [documentId]
      );

      expect(released.rows).toHaveLength(1);
    });

    it('업체 공식 도메인은 도메인 꼴만 받는다', async () => {
      await expect(aVendor('https://gaon.co.kr')).rejects.toThrow();
      await expect(aVendor(null)).resolves.toBeDefined();
    });
  });

  describe('광고 방화벽', () => {
    it('광고는 다른 스키마에 있다', async () => {
      /*
       * E-1. 같은 스키마에 두고 "섞지 말자"고 정해두면 언젠가 누군가 조인 한
       * 줄을 더한다. ads.를 적어야만 닿게 해두면 그 한 줄이 눈에 보인다.
       */
      const { rows } = await client.query<{ table_schema: string }>(
        `SELECT table_schema FROM information_schema.tables
         WHERE table_name = 'placements'`
      );

      expect(rows).toEqual([{ table_schema: 'ads' }]);
    });

    it('자연 결과 쪽에서 광고를 가리키는 것이 없다', async () => {
      /*
       * 광고는 업체를 가리킨다(어쩔 수 없다 — 어느 업체의 광고인지 적어야 한다).
       * 중요한 것은 반대 방향이 없다는 것이다: structured의 어떤 표도 ads를
       * 가리키지 않으므로, 자연 결과를 세는 질의는 ads를 볼 일이 없다.
       */
      const { rows } = await client.query<{ table_name: string }>(
        `SELECT c.conrelid::regclass::text AS table_name
         FROM pg_constraint c
         JOIN pg_class referenced ON referenced.oid = c.confrelid
         JOIN pg_namespace target ON target.oid = referenced.relnamespace
         JOIN pg_namespace source ON source.oid = c.connamespace
         WHERE c.contype = 'f'
           AND target.nspname = 'ads'
           AND source.nspname <> 'ads'`
      );

      expect(rows).toEqual([]);
    });

    it('기간이 거꾸로인 광고는 넣을 수 없다', async () => {
      const vendor = await client.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source)
         VALUES ('가온예식홀', 'hall', '서울 강남구', 'public_data') RETURNING id`
      );

      await expect(
        client.query(
          `INSERT INTO ads.placements (vendor_id, surface, tier, starts_on, ends_on)
           VALUES ($1, 'search', 'standard', '2026-09-30', '2026-09-01')`,
          [vendor.rows[0]!.id]
        )
      ).rejects.toThrow(/placement_period_is_ordered/);
    });

    it('기간이 지난 광고는 오늘 목록에 없다', async () => {
      const vendor = await client.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source)
         VALUES ('가온예식홀', 'hall', '서울 강남구', 'public_data') RETURNING id`
      );

      await client.query(
        `INSERT INTO ads.placements (vendor_id, surface, tier, starts_on, ends_on)
         VALUES ($1, 'search', 'standard', current_date - 30, current_date - 1)`,
        [vendor.rows[0]!.id]
      );

      const today = await client.query('SELECT 1 FROM ads.active_placements');

      expect(today.rows).toHaveLength(0);
    });
  });

  describe('Pick 최종 결정', () => {
    async function aWeddingWithPick(category = 'hall') {
      const user = await client.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );
      const wedding = await client.query<{ id: string }>(
        'INSERT INTO structured.weddings (owner_user_id) VALUES ($1) RETURNING id',
        [user.rows[0]!.id]
      );
      const vendor = await client.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source)
         VALUES ('가온예식홀', $1::vendor_category, '서울 강남구', 'public_data') RETURNING id`,
        [category]
      );

      await client.query(
        'INSERT INTO structured.vendor_candidates (wedding_id, vendor_id, added_by) VALUES ($1, $2, $3)',
        [wedding.rows[0]!.id, vendor.rows[0]!.id, user.rows[0]!.id]
      );

      return { weddingId: wedding.rows[0]!.id, vendorId: vendor.rows[0]!.id, userId: user.rows[0]!.id };
    }

    const decide = (weddingId: string, category: string, vendorId: string) =>
      client.query(
        `INSERT INTO structured.category_decisions (wedding_id, category, vendor_id)
         VALUES ($1, $2::vendor_category, $3)`,
        [weddingId, category, vendorId]
      );

    it('Pick한 곳은 결정할 수 있다', async () => {
      const { weddingId, vendorId } = await aWeddingWithPick();

      await expect(decide(weddingId, 'hall', vendorId)).resolves.toBeDefined();
    });

    it('Pick하지 않은 곳은 결정할 수 없다', async () => {
      /*
       * 담아두지도 않은 곳으로 정해져 있는 상태가 생기면 안 된다. 화면에서
       * 거르는 것만으로는 동시에 두 번 눌리는 경우가 남는다.
       */
      const { weddingId } = await aWeddingWithPick();
      const other = await client.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source)
         VALUES ('안 담은 홀', 'hall', '서울 강남구', 'public_data') RETURNING id`
      );

      await expect(decide(weddingId, 'hall', other.rows[0]!.id)).rejects.toThrow(
        /decision_is_a_pick/
      );
    });

    it('한 업종에 결정이 둘일 수 없다', async () => {
      /*
       * 후보 줄에 깃발을 세우는 방식이었다면 둘을 동시에 세울 수 있고, 그때
       * 어느 쪽이 진짜인지 아무도 모른다. 기본키가 그걸 막는다.
       */
      const { weddingId, vendorId } = await aWeddingWithPick();
      const second = await client.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source)
         VALUES ('둘째 홀', 'hall', '서울 강남구', 'public_data') RETURNING id`
      );

      await client.query(
        'INSERT INTO structured.vendor_candidates (wedding_id, vendor_id) VALUES ($1, $2)',
        [weddingId, second.rows[0]!.id]
      );

      await decide(weddingId, 'hall', vendorId);

      await expect(decide(weddingId, 'hall', second.rows[0]!.id)).rejects.toThrow();
    });

    it('Pick에서 빼면 결정도 함께 사라진다', async () => {
      const { weddingId, vendorId } = await aWeddingWithPick();

      await decide(weddingId, 'hall', vendorId);
      await client.query(
        'DELETE FROM structured.vendor_candidates WHERE wedding_id = $1 AND vendor_id = $2',
        [weddingId, vendorId]
      );

      const left = await client.query('SELECT 1 FROM structured.category_decisions WHERE wedding_id = $1', [
        weddingId,
      ]);

      expect(left.rows).toHaveLength(0);
    });

    it('준비 상태를 저장하지 않고 계산한다', async () => {
      const { weddingId, vendorId } = await aWeddingWithPick();

      const picking = await client.query<{ state: string }>(
        `SELECT state FROM structured.wedding_preparation
         WHERE wedding_id = $1 AND category = 'hall'`,
        [weddingId]
      );

      expect(picking.rows[0]?.state).toBe('picking');

      await decide(weddingId, 'hall', vendorId);

      const decided = await client.query<{ state: string }>(
        `SELECT state FROM structured.wedding_preparation
         WHERE wedding_id = $1 AND category = 'hall'`,
        [weddingId]
      );

      expect(decided.rows[0]?.state).toBe('decided');
    });

    it('손대지 않은 업종은 준비 전이다', async () => {
      const { weddingId } = await aWeddingWithPick();

      const { rows } = await client.query<{ state: string }>(
        `SELECT state FROM structured.wedding_preparation
         WHERE wedding_id = $1 AND category = 'snap'`,
        [weddingId]
      );

      expect(rows[0]?.state).toBe('before');
    });
  });

  describe('광고 실운영 전환', () => {
    const aPerson = async () => {
      const { rows } = await client.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );

      return rows[0]!.id;
    };

    it('아무것도 안 정하면 테스트 상태다', async () => {
      // 아무것도 안 정한 상품이 실운영으로 시작하면 안 된다.
      const { rows } = await client.query<{ tier: string; state: string }>(
        'SELECT tier, state FROM ads.tier_state ORDER BY tier'
      );

      expect(rows.map((row) => row.state)).toEqual(['test', 'test', 'test']);
    });

    it('사람 없이 실운영으로 올릴 수 없다', async () => {
      /*
       * "AI가 멋대로 광고 스위치를 올리는 일 금지"를 표현하는 방법이다.
       * 관례로 두면 언젠가 자동화가 한 줄 넣는다.
       */
      await expect(
        client.query(
          "INSERT INTO ads.launch_decisions (tier, state) VALUES ('light', 'live')"
        )
      ).rejects.toThrow(/decided_by/);
    });

    it('사람이 정하면 실운영이 된다', async () => {
      const person = await aPerson();

      await client.query(
        "INSERT INTO ads.launch_decisions (tier, state, decided_by) VALUES ('light', 'live', $1)",
        [person]
      );

      const { rows } = await client.query<{ state: string }>(
        "SELECT state FROM ads.tier_state WHERE tier = 'light'"
      );

      expect(rows[0]?.state).toBe('live');
    });

    it('테스트는 결정이 아니라 시작 상태다', async () => {
      const person = await aPerson();

      await expect(
        client.query(
          "INSERT INTO ads.launch_decisions (tier, state, decided_by) VALUES ('light', 'test', $1)",
          [person]
        )
      ).rejects.toThrow(/decision_is_not_test/);
    });

    it('두 분석이 서로 다른 결론을 그대로 든다', async () => {
      /*
       * 합치는 순간 어느 쪽이 무엇을 봤는지 사라지고, 사용자가 결정할 재료가
       * 없어진다.
       */
      await client.query(
        `INSERT INTO ads.launch_reports (tier, analyst, verdict, recommended_on, findings)
         VALUES ('standard', 'gpt', 'open', current_date + 30, '{"ctr": 0.021}'::jsonb)`
      );
      await client.query(
        `INSERT INTO ads.launch_reports (tier, analyst, verdict, findings)
         VALUES ('standard', 'claude', 'hold', '{"reason": "데이터 부족"}'::jsonb)`
      );

      const { rows } = await client.query<{ analyst: string; verdict: string }>(
        "SELECT analyst, verdict FROM ads.launch_reports WHERE tier = 'standard' ORDER BY analyst"
      );

      expect(rows).toEqual([
        { analyst: 'gpt', verdict: 'open' },
        { analyst: 'claude', verdict: 'hold' },
      ]);
    });

    it('한 분석자가 남의 보고서를 덮어쓸 수 없다', async () => {
      await client.query(
        `INSERT INTO ads.launch_reports (tier, analyst, verdict, findings)
         VALUES ('light', 'gpt', 'hold', '{"reason": "x"}'::jsonb)`
      );

      await expect(
        client.query(
          `INSERT INTO ads.launch_reports (tier, analyst, verdict, findings)
           VALUES ('light', 'gpt', 'open', '{"reason": "y"}'::jsonb)`
        )
      ).rejects.toThrow();
    });

    it('근거 없는 판정은 받지 않는다', async () => {
      await expect(
        client.query(
          `INSERT INTO ads.launch_reports (tier, analyst, verdict, findings)
           VALUES ('light', 'claude', 'hold', '{}'::jsonb)`
        )
      ).rejects.toThrow(/report_has_findings/);
    });

    it('열자고 하면서 언제인지 말하지 않을 수 없다', async () => {
      await expect(
        client.query(
          `INSERT INTO ads.launch_reports (tier, analyst, verdict, findings)
           VALUES ('light', 'claude', 'open', '{"ctr": 0.02}'::jsonb)`
        )
      ).rejects.toThrow(/open_verdict_names_a_date/);
    });

    it('테스트 종료일을 미리 박아둘 자리가 없다', async () => {
      /*
       * 날짜를 박아두면 자료가 모자라도 그날이 되면 결정하게 되고, 그건 자료를
       * 보고 정하는 것이 아니다.
       */
      const { rows } = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'ads' AND table_name = 'launch_decisions'`
      );

      const columns = rows.map((row) => row.column_name);

      expect(columns).not.toContain('test_ends_on');
      expect(columns).toContain('decided_by');
    });
  });

  describe('최소 온보딩', () => {
    async function aWedding(region: string | null = null) {
      const user = await client.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );

      return await client.query<{ id: string }>(
        'INSERT INTO structured.weddings (owner_user_id, region) VALUES ($1, $2) RETURNING id',
        [user.rows[0]!.id, region]
      );
    }

    it('지역을 비워둘 수 있다', async () => {
      // NULL은 "아직 안 고름"이다. 기본값을 깔면 서울에 사는 사람과 서울을 고른
      // 사람이 같은 값이 되어 구분이 사라진다.
      await expect(aWedding(null)).resolves.toBeTruthy();
    });

    it('빈 지역은 넣을 수 없다', async () => {
      // 공백만 남은 값은 고른 것도 안 고른 것도 아니다.
      await expect(aWedding('')).rejects.toThrow();
      await expect(aWedding('   ')).rejects.toThrow();
    });

    it('총예산은 0이 될 수 없다', async () => {
      /*
       * `아직 모르겠어요`는 NULL이다. 0원을 허용하면 안 정한 것과 안 쓰기로 한
       * 것이 화면에서 같은 값이 되고, 그때부터 예산 화면은 거짓말을 한다.
       */
      const wedding = await aWedding('서울');

      await expect(
        client.query('UPDATE structured.weddings SET budget_amount = 0 WHERE id = $1', [
          wedding.rows[0]!.id,
        ])
      ).rejects.toThrow();
    });
  });

  describe('가입 연령과 약관 동의', () => {
    async function aPendingUser() {
      const { rows } = await client.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );

      return rows[0]!.id;
    }

    async function grant(userId: string, item: string, required: boolean) {
      await client.query(
        `INSERT INTO structured.user_consents (user_id, item, terms_version, is_required)
         VALUES ($1, $2, 'draft-2026-09-01', $3)`,
        [userId, item, required]
      );
    }

    it('로그인만 한 계정은 활성 사용자에 없다', async () => {
      /*
       * v3.13 §N-2. 소셜 로그인 성공만으로 가입이 끝나지 않는다. 뷰가 그 사실을
       * 들고 있어야 읽는 쪽마다 다시 판단하지 않는다.
       */
      const userId = await aPendingUser();

      const { rows } = await client.query('SELECT 1 FROM structured.active_users WHERE id = $1', [
        userId,
      ]);

      expect(rows).toHaveLength(0);
    });

    it('연령을 통과하지 않으면 활성화할 수 없다', async () => {
      const userId = await aPendingUser();

      await expect(
        client.query('UPDATE structured.users SET activated_at = now() WHERE id = $1', [userId])
      ).rejects.toThrow();
    });

    it('막힌 계정은 활성화할 수 없다', async () => {
      const userId = await aPendingUser();

      await client.query(
        "UPDATE structured.users SET age_gate = 'blocked', age_checked_at = now() WHERE id = $1",
        [userId]
      );

      await expect(
        client.query('UPDATE structured.users SET activated_at = now() WHERE id = $1', [userId])
      ).rejects.toThrow();
    });

    it('확인하지 않았는데 확인한 때만 남길 수 없다', async () => {
      const userId = await aPendingUser();

      await expect(
        client.query('UPDATE structured.users SET age_checked_at = now() WHERE id = $1', [userId])
      ).rejects.toThrow();
    });

    it('연령을 통과하고 나면 활성화된다', async () => {
      const userId = await aPendingUser();

      await client.query(
        `UPDATE structured.users
         SET age_gate = 'passed', age_checked_at = now(), activated_at = now()
         WHERE id = $1`,
        [userId]
      );

      const { rows } = await client.query('SELECT 1 FROM structured.active_users WHERE id = $1', [
        userId,
      ]);

      expect(rows).toHaveLength(1);
    });

    it('탈퇴하면 활성 사용자에서 빠진다', async () => {
      const userId = await aPendingUser();

      await client.query(
        `UPDATE structured.users
         SET age_gate = 'passed', age_checked_at = now(), activated_at = now(), deleted_at = now()
         WHERE id = $1`,
        [userId]
      );

      const { rows } = await client.query('SELECT 1 FROM structured.active_users WHERE id = $1', [
        userId,
      ]);

      expect(rows).toHaveLength(0);
    });

    it('같은 항목·판에 두 번 동의할 수 없다', async () => {
      const userId = await aPendingUser();

      await grant(userId, 'terms', true);

      await expect(grant(userId, 'terms', true)).rejects.toThrow();
    });

    it('철회한 뒤에는 다시 동의할 수 있다', async () => {
      const userId = await aPendingUser();

      await grant(userId, 'marketing', false);
      await client.query(
        'UPDATE structured.user_consents SET withdrawn_at = now() WHERE user_id = $1',
        [userId]
      );

      await expect(grant(userId, 'marketing', false)).resolves.toBeUndefined();
    });

    it('철회한 동의는 살아 있는 동의에서 빠진다', async () => {
      const userId = await aPendingUser();

      await grant(userId, 'privacy', true);
      await client.query(
        'UPDATE structured.user_consents SET withdrawn_at = now() WHERE user_id = $1',
        [userId]
      );

      const { rows } = await client.query(
        'SELECT 1 FROM structured.active_consents WHERE user_id = $1',
        [userId]
      );

      expect(rows).toHaveLength(0);
    });

    it('동의보다 먼저 철회할 수 없다', async () => {
      const userId = await aPendingUser();

      await expect(
        client.query(
          `INSERT INTO structured.user_consents
             (user_id, item, terms_version, is_required, granted_at, withdrawn_at)
           VALUES ($1, 'terms', 'draft-2026-09-01', true, now(), now() - interval '1 day')`,
          [userId]
        )
      ).rejects.toThrow();
    });

    it('그때 필수였는지가 행에 남는다', async () => {
      /*
       * 지금 무엇이 필수인지는 코드가 안다. 받던 그때 필수였는지는 그때 적어두지
       * 않으면 알 수 없다 — 선택이던 항목을 나중에 필수로 바꾸면 과거 동의의
       * 성격이 소급해 바뀐다.
       */
      const userId = await aPendingUser();

      await grant(userId, 'marketing', false);

      const { rows } = await client.query<{ is_required: boolean }>(
        'SELECT is_required FROM structured.active_consents WHERE user_id = $1',
        [userId]
      );

      expect(rows[0]!.is_required).toBe(false);
    });
  });

  describe('마이그레이션', () => {
    it('두 번 돌려도 같은 결과가 된다', async () => {
      await expect(migrate(client)).resolves.toEqual([]);
    });
  });
});
