import {
  DEEP_DATA_NOTE,
  DEFAULT_PERIOD_LABEL,
  DEFAULT_PERIOD_MONTHS,
  MAX_COMPARED_VENDORS,
  PRICE_REPORT_CAVEAT,
  comparisonCaveats,
  computePriceStat,
  discloseAmounts,
  summarizeReports,
  type PriceSample,
  type VendorCategory,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';

import { optionalUser, optionalUserId } from '../auth/plugin';
import type { AppContext } from '../context';
import { ApiError, notFound } from '../errors';
import { loadUsageScore } from '../review-view';
import { vendorSourceNote } from '../vendor-view';

const searchQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  category: z
    .enum(['wedding_info_company', 'hall', 'sdm', 'planner_agency', 'snap', 'goods', 'etc'])
    .optional(),
  /** "서울"처럼 시도까지만. region은 "서울 마포구" 형태라 앞부분으로 맞춘다. */
  region: z.string().trim().max(20).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const compareQuerySchema = z.object({
  /** 쉼표로 이은 업체 id. */
  ids: z.string().min(1).max(200),
});

type VendorRow = {
  id: string;
  name: string;
  category: string;
  region: string;
  source: string;
  last_verified_at: Date;
  comparable_quote_count: string;
};

/** 다음 쪽을 가리키는 키. 이름이 같은 업체가 있어 id를 함께 넣는다. */
function encodeCursor(row: VendorRow): string {
  return Buffer.from(JSON.stringify([row.name, row.id]), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): [string, string] | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));

    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string'
    ) {
      return [parsed[0], parsed[1]];
    }
  } catch {
    // 망가진 커서는 첫 쪽으로 되돌린다. 오류를 띄우느니 처음부터 보여주는 편이 낫다.
  }

  return null;
}

function toSummary(row: VendorRow) {
  return {
    id: row.id,
    name: row.name,
    category: row.category as VendorCategory,
    region: row.region,
    sourceNote: vendorSourceNote(row.source),
    comparableQuoteCount: Number(row.comparable_quote_count),
  };
}

/** 같은 상품을 두고 표기가 갈릴 때 가장 많이 쓰인 표기를 고른다. */
function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;

  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }

  return best;
}

/**
 * 업체 한 곳의 상세.
 *
 * 상품별 가격은 comparable_quotes에서 그때그때 계산한다. 표본이 기준에 못 미치는
 * 상품은 아예 내려보내지 않는다 — 중앙값 없는 상품 이름만 늘어놓으면 화면이 그것을
 * 가격으로 그릴 여지가 생긴다.
 */
async function loadVendorDetail(pool: Pool, vendorId: string, viewerId: string | null) {
  const { rows } = await pool.query<VendorRow>(
    `SELECT v.id, v.name, v.category, v.region, v.source, v.last_verified_at,
            (SELECT count(*) FROM structured.comparable_quotes c WHERE c.vendor_id = v.id)
              AS comparable_quote_count
     FROM structured.vendors v WHERE v.id = $1`,
    [vendorId]
  );

  const vendor = rows[0];

  if (!vendor) {
    throw notFound('업체');
  }

  /*
   * 조건이 비슷한 사례를 볼 수 있는가.
   *
   * **가격을 가리는 값이 아니다.** 최종통합정책 v2.0 K-6이 "결제인증 회원만 실제
   * 결제 데이터 접근"을 폐기했다 — 구간은 비회원도 본다. 여기서 갈리는 것은
   * 깊이뿐이고, 무엇을 보여줄지는 사람이 아니라 데이터 수가 정한다.
   */
  const deep = viewerId
    ? await pool.query('SELECT 1 FROM structured.data_unlocks WHERE user_id = $1', [viewerId])
    : null;

  const deepData = (deep?.rows.length ?? 0) > 0;

  const samples = await pool.query<{
    product_key: string;
    doc_type: string;
    product_label: string | null;
    amount: string;
    verification_level: PriceSample['verificationLevel'];
    contract_date: Date;
  }>(
    `SELECT c.product_key, c.doc_type,
            coalesce(q.product_name, q.hall_name) AS product_label,
            c.total_amount AS amount, c.verification_level, c.contract_date
     FROM structured.comparable_quotes c
     JOIN structured.quotes q ON q.id = c.id
     WHERE c.vendor_id = $1
     ORDER BY c.product_key, c.doc_type`,
    [vendor.id]
  );

  const groups = new Map<string, { docType: string; labels: string[]; samples: PriceSample[] }>();

  for (const row of samples.rows) {
    const key = `${row.product_key} ${row.doc_type}`;
    const group = groups.get(key) ?? { docType: row.doc_type, labels: [], samples: [] };

    if (row.product_label) {
      group.labels.push(row.product_label);
    }

    group.samples.push({
      amount: Number(row.amount),
      verificationLevel: row.verification_level,
      contractDate: row.contract_date.toISOString().slice(0, 10),
    });

    groups.set(key, group);
  }

  const products = [];

  for (const group of groups.values()) {
    const stat = computePriceStat(group.samples);
    const label = mostCommon(group.labels);

    // 표본이 모자라거나 이름을 모르는 상품은 내려보내지 않는다.
    if (!stat || !label) {
      continue;
    }

    products.push({ productLabel: label, docType: group.docType, stat });
  }

  products.sort((a, b) => a.productLabel.localeCompare(b.productLabel, 'ko'));

  /*
   * 제보는 따로 읽어 따로 내려보낸다.
   *
   * 위의 comparable_quotes와 UNION하지 않는다 — 서비스정책서 2번은 시장
   * 대표가격의 근거를 L2 이상으로 못박았고, 제보는 그 근거를 갖지 못한다.
   * 표를 나눠둔 이유가 여기서 지켜진다.
   */
  const reports = await pool.query<{ total_amount: string; contracted_on: Date }>(
    `SELECT total_amount, contracted_on
     FROM structured.usable_price_reports
     WHERE vendor_id = $1`,
    [vendor.id]
  );

  const reported = summarizeReports(
    reports.rows.map((row) => ({
      totalAmount: Number(row.total_amount),
      contractedOn: row.contracted_on.toISOString().slice(0, 7),
    }))
  );

  /*
   * 결제인증은 또 따로 읽는다. 계약 중앙값과도, 수기 제보와도 UNION하지 않는다.
   *
   * 셋의 근거가 다르다 — 사람이 심사한 계약, 기계가 읽은 결제내역, 그냥 적어준
   * 숫자. 한 번이라도 합치면 그 뒤로는 어느 숫자가 무엇이었는지 아무도 모른다.
   */
  /*
   * 최근 12개월만 본다. v2.0 C-1.
   *
   * 라벨이 사실보다 앞서면 안 된다 — 화면이 "최근 12개월"이라고 적는데 3년 전
   * 결제가 섞여 있으면, 그건 안내가 아니라 틀린 말이다. 오래된 것을 지우지는
   * 않는다(C-1) — 과거 이력으로 남고, 이 질의에서만 빠진다.
   */
  const paid = await pool.query<{ paid_amount: string }>(
    `SELECT paid_amount
     FROM structured.usable_payment_proofs
     WHERE vendor_id = $1
       AND paid_at >= now() - ($2 || ' months')::interval`,
    [vendor.id, DEFAULT_PERIOD_MONTHS]
  );

  /*
   * 4단계 사다리로 정리한다(v2.0 C장·D-1). 몇 건부터 무엇을 보여줄지는 도메인이
   * 정하고, 이 경로는 금액만 넘긴다 — 화면마다 기준을 다시 적지 않기 위해서다.
   */
  const paidPrice = discloseAmounts({
    amounts: paid.rows.map((row) => Number(row.paid_amount)),
    period: DEFAULT_PERIOD_LABEL,
  });

  return {
    ...toSummary(vendor),
    usageScore: await loadUsageScore(pool, vendor.id, vendor.category as VendorCategory),
    lastVerifiedAt: vendor.last_verified_at.toISOString(),
    prices: {
      products,
      paidPrice,
      reportedPrice: reported.available ? { ...reported, caveat: PRICE_REPORT_CAVEAT } : reported,
      deepData,
      // 열려 있으면 여는 방법을 말하지 않는다. 이미 한 일을 권하는 셈이 된다.
      deepDataNote: deepData ? null : DEEP_DATA_NOTE,
    },
  };
}

export function registerVendorRoutes(app: FastifyInstance, context: AppContext): void {
  /*
   * 로그인 없이 본다. 사업계획서 v3 7번 Level 1.
   *
   * 앱을 켜자마자 로그인을 요구하면, 무엇을 주는 서비스인지 보기도 전에 계정을
   * 만들라는 말이 된다. 가격은 여전히 잠겨 있다(Level 3) — 여는 것은 목록·기본정보·
   * 이용점수까지다.
   */
  const auth = { preHandler: optionalUser(context) };

  /**
   * 지역 필터 목록.
   *
   * 자료에 실제로 있는 시도만 내려간다. 전국 목록을 박아두면 눌러도 아무것도 나오지 않는
   * 필터가 생긴다.
   */
  app.get('/v1/vendors/regions', auth, async () => {
    const { rows } = await context.pool.query<{ name: string; vendor_count: string }>(
      `SELECT split_part(region, ' ', 1) AS name, count(*) AS vendor_count
       FROM structured.vendors
       WHERE region <> ''
       GROUP BY 1
       ORDER BY 1`
    );

    return {
      regions: rows.map((row) => ({ name: row.name, vendorCount: Number(row.vendor_count) })),
    };
  });

  /**
   * A-17 업체 비교. 최대 세 곳.
   *
   * 단서를 결과와 한 응답에 담아 보낸다. 따로 받아오게 두면 화면이 표만 그리고
   * "금액만으로는 비교할 수 없다"는 말을 빠뜨릴 수 있다 — 사업계획서 2번이 꼽은
   * "비교의 어려움"을 우리가 만든 표가 되레 가리게 된다.
   */
  app.get('/v1/vendors/compare', auth, async (request) => {
    const { ids } = compareQuerySchema.parse(request.query);

    // 같은 업체를 두 번 골라 "두 곳"을 만들 수 없게 한다.
    const unique = [
      ...new Set(
        ids
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      ),
    ];

    if (unique.length < 2) {
      throw new ApiError('invalid_request', '견줄 업체를 두 곳 이상 골라주세요.');
    }

    if (unique.length > MAX_COMPARED_VENDORS) {
      throw new ApiError(
        'invalid_request',
        `한 번에 ${MAX_COMPARED_VENDORS}곳까지 견줄 수 있습니다.`
      );
    }

    const viewerId = optionalUserId(request);

    const vendors = await Promise.all(
      unique.map((id) => loadVendorDetail(context.pool, id, viewerId))
    );

    return {
      vendors,
      caveats: comparisonCaveats(
        vendors.map((vendor) => ({
          category: vendor.category,
          region: vendor.region,
          hasPriceData:
            vendor.prices.products.length > 0 || vendor.prices.paidPrice.stage !== 'collecting',
        }))
      ),
    };
  });

  /**
   * A-16 업체 검색.
   *
   * 별점도 후기도 없다. 우리가 아는 것은 이 업체가 있다는 사실과 확인된 계약이 몇 건
   * 모였는지뿐이다. 정렬도 이름 순이다 — "인기순"을 만들려면 인기를 재는 무언가가
   * 있어야 하는데 없다.
   */
  app.get('/v1/vendors', auth, async (request) => {
    const query = searchQuerySchema.parse(request.query);
    const after = query.cursor ? decodeCursor(query.cursor) : null;

    /*
     * 정규화는 DB의 normalize_vendor_name을 그대로 쓴다. 서버가 따로 흉내내면 색인에
     * 저장된 값과 어긋나 "분명히 있는데 안 나오는" 업체가 생긴다.
     *
     * 확인된 계약 수는 comparable_quotes 뷰에서 센다 — 등급·확인 조건이 뷰 안에 있어
     * 여기서 다시 쓰지 않는다.
     */
    const { rows } = await context.pool.query<VendorRow>(
      `WITH needle AS (
         SELECT CASE WHEN $1::text IS NULL THEN NULL
                     ELSE structured.normalize_vendor_name($1) END AS value
       )
       SELECT v.id, v.name, v.category, v.region, v.source, v.last_verified_at,
              (SELECT count(*) FROM structured.comparable_quotes c WHERE c.vendor_id = v.id)
                AS comparable_quote_count
       FROM structured.vendors v, needle n
       WHERE (n.value IS NULL
              OR v.normalized_name LIKE '%' || n.value || '%'
              OR EXISTS (SELECT 1 FROM structured.vendor_aliases a
                         WHERE a.vendor_id = v.id
                           AND a.normalized_alias LIKE '%' || n.value || '%'))
         AND ($2::vendor_category IS NULL OR v.category = $2)
         AND ($3::text IS NULL OR v.region LIKE $3 || '%')
         AND ($4::text IS NULL OR (v.name, v.id) > ($4, $5::uuid))
       ORDER BY v.name, v.id
       LIMIT $6`,
      [
        query.q && query.q.length > 0 ? query.q : null,
        query.category ?? null,
        query.region && query.region.length > 0 ? query.region : null,
        after?.[0] ?? null,
        after?.[1] ?? null,
        query.limit + 1,
      ]
    );

    // 한 건 더 불러 다음 쪽이 있는지 본다. 마지막 쪽에서 빈 쪽을 한 번 더 부르지 않게.
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      vendors: page.map(toSummary),
      nextCursor: hasMore && page.length > 0 ? encodeCursor(page[page.length - 1]!) : null,
    };
  });

  /** A-17 업체 상세. */
  app.get<{ Params: { vendorId: string } }>('/v1/vendors/:vendorId', auth, async (request) =>
    loadVendorDetail(context.pool, request.params.vendorId, optionalUserId(request))
  );
}
