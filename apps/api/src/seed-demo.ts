import { PRICING_POLICY, productKey } from '@weddingpick/domain';
import type { PoolClient } from 'pg';

import { loadConfig } from './config';
import { createPool, withTransaction } from './db';

/*
 * 데모 계정은 가입이 끝난 상태로 만든다. v3.13 §N-2가 로그인만 한 계정을 대기로
 * 두면서, 그냥 넣으면 데모 화면이 전부 막힌 계정을 보여주게 된다. 연령은 데모
 * 데이터라 통과로 두고, 확인한 때를 남겨 판정이 언제 것인지 보이게 한다.
 */
const ACTIVE_USER = `INSERT INTO structured.users
     (age_gate, age_checked_at, age_verified, age_verified_at, activated_at)
   VALUES ('passed', now(), true, now(), now()) RETURNING id`;

const ACTIVE_OPERATOR = `INSERT INTO structured.users
     (is_operator, age_gate, age_checked_at, age_verified, age_verified_at, activated_at)
   VALUES (true, 'passed', now(), true, now(), now()) RETURNING id`;


/**
 * 시연·테스트용 데이터를 채운다.
 *
 *   npm run seed:demo --workspace @weddingpick/api -- --yes
 *   npm run seed:demo --workspace @weddingpick/api -- --yes --reset
 *
 * **여기 들어가는 것은 전부 지어낸 값이다.** 업체 이름도 금액도 실제와 무관하다.
 * 공개 인허가 자료를 받아오는 것은 `public-data:import`가 하고, 그건 진짜 자료를
 * 넣는다 — 둘을 섞지 않는다.
 *
 * 왜 필요한가. 이 앱의 화면 대부분은 데이터가 있어야 무엇을 하는지 보인다.
 * 가격 비교는 상품마다 표본이 최소 개수를 넘어야 중앙값을 만들고, 심사 화면은
 * 신청이 쌓여야 목록이 생기며, 파기 알림은 예정일이 지난 원본이 있어야 뜬다.
 * 빈 DB에서는 전부 "아직 없습니다"만 나온다.
 *
 * 그래서 각 기능이 **실제로 동작하는 상태**를 만든다 — 표본이 모자란 상품과
 * 충분한 상품, 심사 대기와 밀린 심사, 파기 예정과 심사 때문에 보류된 원본을
 * 함께 둔다. 한쪽만 있으면 경계가 맞는지 볼 수 없다.
 */

const HALLS = [
  { name: '가온예식홀', region: '서울 강남구' },
  { name: '나루컨벤션', region: '서울 마포구' },
  { name: '다올웨딩홀', region: '경기 성남시' },
  { name: '라온컨벤션', region: '인천 연수구' },
  { name: '마루예식장', region: '서울 송파구' },
];

/* v3.18 — 스튜디오·드레스·메이크업은 업종이 셋이다(`sdm` 폐지). */
const STUDIOS = [{ name: '별빛스튜디오', region: '서울 강남구' }];
const DRESSES = [{ name: '하늘드레스', region: '서울 강남구' }];
const MAKEUPS = [{ name: '고운메이크업', region: '서울 서초구' }];

const PLANNERS = [
  // 공개 근거가 있는 사람과 없는 사람을 함께 둔다. 검색에는 앞쪽만 나와야 한다.
  { name: '김하늘', regions: ['서울'], listed: true },
  { name: '이서준', regions: ['서울', '경기'], listed: true },
  { name: '박도윤', regions: ['인천'], listed: false },
];

const TERMS = [
  {
    category: 'refund' as const,
    body: '예식일 30일 이내 취소 시 총액의 50%를 위약금으로 한다.',
    flagged: true,
  },
  {
    category: 'cancellation' as const,
    body: '계약일로부터 7일 이내에는 위약금 없이 해지할 수 있다.',
    flagged: false,
  },
];

function argv(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/** 지어낸 값이라는 것이 화면에서도 보이게 접두어를 붙인다. */
const fake = (name: string): string => `[테스트] ${name}`;

async function seedVendors(client: PoolClient) {
  const ids: Record<string, string> = {};

  for (const [category, list] of [
    ['hall', HALLS],
    ['studio', STUDIOS],
    ['dress', DRESSES],
    ['makeup', MAKEUPS],
  ] as const) {
    for (const vendor of list) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO structured.vendors (category, name, region, source)
         VALUES ($1, $2, $3, 'public_data') RETURNING id`,
        [category, fake(vendor.name), vendor.region]
      );

      ids[vendor.name] = rows[0]!.id;
    }
  }

  return ids;
}

async function seedPlanners(client: PoolClient) {
  const ids: Record<string, string> = {};

  for (const planner of PLANNERS) {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO structured.planners (name, regions, listing_status, listing_source, listed_at)
       VALUES ($1, $2, $3::planner_listing_status, $4::source_type, $5) RETURNING id`,
      [
        fake(planner.name),
        planner.regions,
        planner.listed ? 'public' : 'private',
        planner.listed ? 'vendor_official' : null,
        planner.listed ? new Date() : null,
      ]
    );

    ids[planner.name] = rows[0]!.id;
  }

  return ids;
}

/** 남의 웨딩. 시장 표본이 되는 계약들이다. */
async function seedMarketSamples(
  client: PoolClient,
  vendorId: string,
  productName: string,
  count: number,
  baseAmount: number
) {
  const owner = await client.query<{ id: string }>(
    ACTIVE_USER
  );
  const wedding = await client.query<{ id: string }>(
    'INSERT INTO structured.weddings (owner_user_id) VALUES ($1) RETURNING id',
    [owner.rows[0]!.id]
  );
  const reviewer = await client.query<{ id: string }>(
    ACTIVE_OPERATOR
  );

  for (let index = 0; index < count; index += 1) {
    /*
     * 값을 조금씩 흩는다. 전부 같으면 중앙값·사분위가 한 점에 몰려 판단 4단계가
     * 무엇을 하는지 볼 수 없다.
     */
    const amount = baseAmount + (index - Math.floor(count / 2)) * Math.round(baseAmount * 0.06);

    await client.query(
      `INSERT INTO structured.quotes
         (wedding_id, vendor_id, doc_type, product_name, product_key, total_amount,
          contract_date, verification_level, source, confirmed_at,
          pii_review, pii_reviewed_at, pii_reviewed_by)
       VALUES ($1, $2, 'contract', $3, $4, $5, $6, 'L2', 'contract_verified', now(),
               'clean', now(), $7)`,
      [
        wedding.rows[0]!.id,
        vendorId,
        productName,
        productKey({ vendorId, productName }),
        amount,
        new Date(Date.now() - (30 + index * 9) * 24 * 60 * 60 * 1000),
        reviewer.rows[0]!.id,
      ]
    );
  }
}

async function main(): Promise<void> {
  if (!argv('yes')) {
    console.error(
      '지어낸 데이터를 넣는다. 정말 넣으려면 --yes를 붙일 것.\n' +
        '  npm run seed:demo --workspace @weddingpick/api -- --yes'
    );
    process.exitCode = 1;
    return;
  }

  const pool = createPool(loadConfig().databaseUrl);

  try {
    const existing = await pool.query<{ count: string }>(
      'SELECT count(*) AS count FROM structured.users'
    );

    if (Number(existing.rows[0]!.count) > 0 && !argv('reset')) {
      console.error(
        '이미 데이터가 있다. 지우고 다시 넣으려면 --reset을 붙일 것.\n' +
          '지어낸 데이터를 진짜 데이터에 섞지 않으려는 것이다.'
      );
      process.exitCode = 1;
      return;
    }

    await withTransaction(pool, async (client) => {
      if (argv('reset')) {
        // users를 지우면 웨딩·문서·신청이 CASCADE로 따라간다.
        await client.query('TRUNCATE structured.users, structured.vendors, structured.planners CASCADE');
      }

      const vendors = await seedVendors(client);
      const planners = await seedPlanners(client);

      // ── 가격 비교: 표본이 충분한 상품과 모자란 상품을 함께 둔다 ──────────
      const enough = PRICING_POLICY.minimumSampleCount + 3;

      await seedMarketSamples(client, vendors['가온예식홀']!, '그랜드볼룸', enough, 32_000_000);
      await seedMarketSamples(client, vendors['나루컨벤션']!, '루체홀', enough, 27_000_000);
      // 최소 표본에 한 건 모자라다. 화면이 "아직 만들지 않는다"고 말해야 한다.
      await seedMarketSamples(
        client,
        vendors['다올웨딩홀']!,
        '가든홀',
        PRICING_POLICY.minimumSampleCount - 1,
        24_000_000
      );
      await seedMarketSamples(client, vendors['별빛스튜디오']!, '스튜디오 촬영 패키지', enough, 3_400_000);

      // ── 내 웨딩: 화면에서 실제로 열어볼 문서들 ───────────────────────────
      const me = await client.query<{ id: string }>(
        ACTIVE_USER
      );
      const myId = me.rows[0]!.id;
      const wedding = await client.query<{ id: string }>(
        `INSERT INTO structured.weddings (owner_user_id, wedding_date)
         VALUES ($1, $2) RETURNING id`,
        [myId, new Date(Date.now() + 200 * 24 * 60 * 60 * 1000)]
      );
      const weddingId = wedding.rows[0]!.id;
      const operator = await client.query<{ id: string }>(
        ACTIVE_OPERATOR
      );
      const operatorId = operator.rows[0]!.id;

      /** 원본 파일과 그 문서 한 벌. */
      const addDocument = async (input: {
        vendorId: string;
        productName: string;
        amount: number;
        uploadedDaysAgo: number;
        confirmed: boolean;
        piiReviewed: boolean;
        plannerId?: string;
      }) => {
        const document = await client.query<{ id: string }>(
          `INSERT INTO originals.raw_documents (owner_user_id, page_count, uploaded_at, personal_info_kinds)
           VALUES ($1, 2, now() - ($2 || ' days')::interval, ARRAY['name','phone']) RETURNING id`,
          [myId, String(input.uploadedDaysAgo)]
        );
        const documentId = document.rows[0]!.id;

        for (const page of [0, 1]) {
          await client.query(
            `INSERT INTO originals.raw_document_pages (raw_document_id, page_index, storage_key, mime_type)
             VALUES ($1, $2, $3, 'image/jpeg')`,
            [documentId, page, `${documentId}/page-${page}.jpg`]
          );
        }

        const quote = await client.query<{ id: string }>(
          `INSERT INTO structured.quotes
             (wedding_id, raw_document_id, vendor_id, planner_id, doc_type, product_name,
              product_key, total_amount, deposit_amount, contract_date, verification_level,
              source, confirmed_at, pii_review, pii_reviewed_at, pii_reviewed_by)
           VALUES ($1, $2, $3, $4, 'contract', $5, $6, $7, $8, $9, 'L0', 'ai_extraction', $10,
                   $11::pii_review_status, $12, $13)
           RETURNING id`,
          [
            weddingId,
            documentId,
            input.vendorId,
            input.plannerId ?? null,
            input.productName,
            productKey({ vendorId: input.vendorId, productName: input.productName }),
            input.amount,
            Math.round(input.amount * 0.1),
            new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
            input.confirmed ? new Date() : null,
            input.piiReviewed ? 'clean' : 'pending',
            input.piiReviewed ? new Date() : null,
            input.piiReviewed ? operatorId : null,
          ]
        );
        const quoteId = quote.rows[0]!.id;

        await client.query(
          `INSERT INTO structured.analyses
             (quote_id, raw_document_id, wedding_id, status, started_at, finished_at)
           VALUES ($1, $2, $3, 'succeeded', now(), now())`,
          [quoteId, documentId, weddingId]
        );

        for (const term of TERMS) {
          await client.query(
            `INSERT INTO structured.contract_terms (quote_id, category, body, flagged)
             VALUES ($1, $2::contract_term_category, $3, $4)`,
            [quoteId, term.category, term.body, term.flagged]
          );
        }

        for (const item of [
          { kind: 'included' as const, label: '기본 촬영 2부' },
          { kind: 'excluded' as const, label: '원본 파일 제공' },
          { kind: 'additional_candidate' as const, label: '헬퍼 이모님 (현장 결제)' },
        ]) {
          await client.query(
            `INSERT INTO structured.quote_line_items (quote_id, kind, label)
             VALUES ($1, $2::line_item_kind, $3)`,
            [quoteId, item.kind, item.label]
          );
        }

        return { quoteId, documentId };
      };

      // 내 견적 하나 — 시장 중앙값보다 높게 둬서 판단 문구가 나오게 한다.
      const mine = await addDocument({
        vendorId: vendors['가온예식홀']!,
        productName: '그랜드볼룸',
        amount: 38_000_000,
        uploadedDaysAgo: 3,
        confirmed: true,
        piiReviewed: true,
        plannerId: planners['김하늘'],
      });

      // 개인정보 재검토를 아직 안 받은 문서. 검토 대기 목록에 뜬다.
      await addDocument({
        vendorId: vendors['별빛스튜디오']!,
        productName: '스튜디오 촬영 패키지',
        amount: 3_800_000,
        uploadedDaysAgo: 2,
        confirmed: true,
        piiReviewed: false,
      });

      // ── 인증 심사: 대기 중인 것과 밀린 것 ────────────────────────────────
      const addRequest = async (quoteId: string, documentId: string, daysAgo: number) => {
        const request = await client.query<{ id: string }>(
          `INSERT INTO structured.verification_requests (quote_id, requested_by, target_level, received_at)
           VALUES ($1, $2, 'L2', now() - ($3 || ' days')::interval) RETURNING id`,
          [quoteId, myId, String(daysAgo)]
        );

        await client.query(
          `INSERT INTO structured.verification_evidence (request_id, kind, raw_document_id)
           VALUES ($1, 'contract_document', $2)`,
          [request.rows[0]!.id, documentId]
        );
      };

      await addRequest(mine.quoteId, mine.documentId, 2);

      // 밀린 심사. 기준(7일)을 넘긴 것이 있어야 적체 알림을 볼 수 있다.
      const stale = await addDocument({
        vendorId: vendors['나루컨벤션']!,
        productName: '루체홀',
        amount: 29_000_000,
        uploadedDaysAgo: 40,
        confirmed: true,
        piiReviewed: true,
      });

      await addRequest(stale.quoteId, stale.documentId, 12);

      // ── 파기 예정 원본. 검증이 끝났고 30일이 지난 것 ─────────────────────
      const old = await client.query<{ id: string }>(
        `INSERT INTO originals.raw_documents (owner_user_id, page_count, uploaded_at, personal_info_kinds)
         VALUES ($1, 1, now() - interval '45 days', ARRAY['name','resident_number']) RETURNING id`,
        [myId]
      );

      await client.query(
        `INSERT INTO originals.raw_document_pages (raw_document_id, page_index, storage_key, mime_type)
         VALUES ($1, 0, $2, 'application/pdf')`,
        [old.rows[0]!.id, `${old.rows[0]!.id}/page-0.pdf`]
      );

      // ── 문의: 처리 대기 ──────────────────────────────────────────────────
      await client.query(
        `INSERT INTO structured.inquiries (category, body, requester_user_id, subject_kind, subject_id)
         VALUES ('planner_delisting', '검색에 나오지 않게 해주세요.', $1, 'planner', $2)`,
        [myId, planners['이서준']]
      );

      await client.query(
        `INSERT INTO structured.inquiries (category, body, contact, subject_kind, subject_id, evidence_url)
         VALUES ('planner_listing', '저희 소속 플래너입니다.', 'test@example.invalid',
                 'planner', $1, 'https://example.invalid/team')`,
        [planners['박도윤']]
      );
    });

    await report(pool);
  } finally {
    await pool.end();
  }
}

/** 넣고 나서 각 기능이 실제로 무엇을 보게 되는지 세어 보여준다. */
async function report(pool: ReturnType<typeof createPool>): Promise<void> {
  const counts = await pool.query<{ label: string; count: string }>(
    `SELECT '업체' AS label, count(*)::text FROM structured.vendors
     UNION ALL SELECT '검색에 나오는 플래너', count(*)::text FROM structured.listed_planners
     UNION ALL SELECT '문서 전체', count(*)::text FROM structured.quotes
     UNION ALL SELECT '가격 비교에 들어가는 문서', count(*)::text FROM structured.comparable_quotes
     UNION ALL SELECT '개인정보 재검토 대기', count(*)::text FROM structured.pending_pii_reviews
     UNION ALL SELECT '심사 대기', count(*)::text FROM structured.pending_verification_requests
     UNION ALL SELECT '밀린 심사(7일 초과)', count(*)::text FROM structured.backlogged_verification_requests
     UNION ALL SELECT '파기 예정 원본', count(*)::text FROM originals.documents_due_for_deletion
     UNION ALL SELECT '심사 때문에 보류된 원본', count(*)::text FROM originals.retention_held_for_verification
     UNION ALL SELECT '처리 대기 문의', count(*)::text FROM structured.inquiries WHERE status = 'received'`
  );

  console.log('지어낸 데이터를 넣었다. 각 기능이 보게 되는 것:');
  for (const row of counts.rows) console.log(`  ${row.label}: ${row.count}`);
  console.log('\n가격 통계는 아직 계산 전이다: npm run worker (또는 통계 재계산 경로)');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
