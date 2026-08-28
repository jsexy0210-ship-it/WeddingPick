import {
  PLANNER_LISTING_BASIS,
  PLANNER_WITHDRAWAL_NOTICE,
  computePriceStat,
  type PlannerListingSource,
  type PriceSample,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';

import { requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { notFound } from '../errors';

const searchQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  /** "서울"처럼 시도까지만. regions 배열에 그 값이 들어 있는지 본다. */
  region: z.string().trim().max(20).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

type PlannerRow = {
  id: string;
  name: string;
  vendor_id: string | null;
  vendor_name: string | null;
  regions: string[];
  listing_source: PlannerListingSource;
  comparable_quote_count: string;
};

function encodeCursor(row: PlannerRow): string {
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
    // 망가진 커서는 첫 쪽으로 되돌린다.
  }

  return null;
}

function toSummary(row: PlannerRow) {
  return {
    id: row.id,
    name: row.name,
    vendor: row.vendor_id ? { id: row.vendor_id, name: row.vendor_name! } : null,
    regions: row.regions,
    // 개인 이름을 목록에 싣고 이유를 적지 않으면 아무도 그것을 따져볼 수 없다.
    listingBasis: PLANNER_LISTING_BASIS[row.listing_source],
    listingSource: row.listing_source,
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

/*
 * 두 쿼리 모두 structured.listed_planners만 본다.
 *
 * 노출 조건(listing_status = 'public')이 뷰 안에 있어, 이 경로가 조건을 빠뜨릴 방법이
 * 없다. structured.comparable_quotes가 집계에 대해 하는 일과 같다.
 */
const SELECT_PLANNER = `
  SELECT p.id, p.name, p.vendor_id, v.name AS vendor_name, p.regions, p.listing_source,
         (SELECT count(*) FROM structured.comparable_quotes c WHERE c.planner_id = p.id)
           AS comparable_quote_count
  FROM structured.listed_planners p
  LEFT JOIN structured.vendors v ON v.id = p.vendor_id
`;

async function loadPlannerDetail(pool: Pool, plannerId: string) {
  const { rows } = await pool.query<PlannerRow>(`${SELECT_PLANNER} WHERE p.id = $1`, [plannerId]);

  const planner = rows[0];

  if (!planner) {
    // 비공개 플래너도 여기로 온다. "있지만 안 보여준다"와 "없다"를 구분해주지 않는다.
    throw notFound('플래너');
  }

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
     WHERE c.planner_id = $1
     ORDER BY c.product_key, c.doc_type`,
    [planner.id]
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

    // 표본이 모자란 상품은 내려보내지 않는다. 업체 상세와 같은 규칙이다.
    if (!stat || !label) {
      continue;
    }

    products.push({ productLabel: label, docType: group.docType, stat });
  }

  products.sort((a, b) => a.productLabel.localeCompare(b.productLabel, 'ko'));

  return {
    ...toSummary(planner),
    products,
    withdrawalNotice: PLANNER_WITHDRAWAL_NOTICE,
  };
}

export function registerPlannerRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  /**
   * 지역 필터 목록.
   *
   * 검색에 나오는 플래너의 활동 지역만 모은다. 업체 지역 목록을 그대로 쓰면 플래너가
   * 한 명도 없는 지역이 필터로 뜬다.
   */
  app.get('/v1/planners/regions', auth, async () => {
    const { rows } = await context.pool.query<{ name: string; planner_count: string }>(
      `SELECT region AS name, count(*) AS planner_count
       FROM structured.listed_planners, unnest(regions) AS region
       GROUP BY 1
       ORDER BY 1`
    );

    return {
      regions: rows.map((row) => ({ name: row.name, plannerCount: Number(row.planner_count) })),
    };
  });

  /**
   * A-16 플래너 검색.
   *
   * 플래너는 개인이다. 견적서에서 읽어낸 이름은 사용자가 자기 계약을 확인받으려고 올린
   * 문서에서 나온 것이고, 그것을 누구나 검색할 수 있는 목록에 싣는 것은 수집한 목적과
   * 다른 이용이다. 그래서 공개 근거가 있는 플래너만 나온다 — 조건은
   * structured.listed_planners 뷰 안에 있다.
   */
  app.get('/v1/planners', auth, async (request) => {
    const query = searchQuerySchema.parse(request.query);
    const after = query.cursor ? decodeCursor(query.cursor) : null;

    const { rows } = await context.pool.query<PlannerRow>(
      `WITH needle AS (
         SELECT CASE WHEN $1::text IS NULL THEN NULL
                     ELSE structured.normalize_vendor_name($1) END AS value
       )
       ${SELECT_PLANNER}, needle n
       WHERE (n.value IS NULL OR p.normalized_name LIKE '%' || n.value || '%')
         AND ($2::text IS NULL OR $2 = ANY (p.regions))
         AND ($3::text IS NULL OR (p.name, p.id) > ($3, $4::uuid))
       ORDER BY p.name, p.id
       LIMIT $5`,
      [
        query.q && query.q.length > 0 ? query.q : null,
        query.region && query.region.length > 0 ? query.region : null,
        after?.[0] ?? null,
        after?.[1] ?? null,
        query.limit + 1,
      ]
    );

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      planners: page.map(toSummary),
      nextCursor: hasMore && page.length > 0 ? encodeCursor(page[page.length - 1]!) : null,
      // 목록에 오른 사람이 내려달라고 할 방법을 결과와 함께 늘 보낸다.
      withdrawalNotice: PLANNER_WITHDRAWAL_NOTICE,
    };
  });

  app.get<{ Params: { plannerId: string } }>('/v1/planners/:plannerId', auth, async (request) =>
    loadPlannerDetail(context.pool, request.params.plannerId)
  );
}
