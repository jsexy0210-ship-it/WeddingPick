import {
  CONDITION_NARROWING,
  DEEP_DATA_NOTE,
  DEFAULT_PERIOD_LABEL,
  DEFAULT_PERIOD_MONTHS,
  DISCLOSURE_THRESHOLDS,
  MAX_COMPARED_VENDORS,
  NARROWED_NOT_ENOUGH,
  PRICE_REPORT_CAVEAT,
  RECENT_PERIOD_LABEL,
  RECENT_PERIOD_MONTHS,
  SPONSORED_LABEL,
  VENDOR_CATEGORY_LABEL,
  budgetBand,
  coarseRegion,
  comparisonCaveats,
  computePriceStat,
  discloseAmounts,
  displayableImageCondition,
  hasDeepData,
  isWeddingStyle,
  narrowedLabel,
  summarizeReports,
  type PriceSample,
  type VendorCategory,
  widestDisclosable,
} from '@weddingpick/domain';
import { vendorSearchQuerySchema, vendorSortSchema } from '@weddingpick/api-contract';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';

import { optionalUser, optionalUserId } from '../auth/plugin';
import type { AppContext } from '../context';
import { ApiError, notFound } from '../errors';
import { loadUsageScore } from '../review-view';
import { vendorSourceNote } from '../vendor-view';

/**
 * 질의는 계약(`vendorSearchQuerySchema`)이 들고 있다 — 여기서 따로 베끼면 v3.18처럼
 * 화면이 거는 조건이 늘 때 서버만 옛 칸으로 남는다.
 */
const searchQuerySchema = vendorSearchQuerySchema;

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
  source_url: string | null;
  last_verified_at: Date;
  /** 지도 핀 좌표. 아직 지오코딩하지 않았으면 둘 다 null. */
  lat: number | null;
  lng: number | null;
  /** 승인된 대표 이미지 주소. 검색·상세 질의가 서브쿼리로 채운다. */
  image_url?: string | null;
  comparable_quote_count: string;
  /** 스타일 태그(0090). enum 배열은 드라이버가 문자열로 주므로 text[]로 읽는다. */
  style_tags: string[] | null;
  /** 업체 안내 가격(정보 0층). 없으면 null. */
  guide_price_from: string | number | null;
  guide_price_source: string | null;
  /** 검색 목록에서만 채워진다. 상세는 따로 읽는다. */
  proof_count?: string;
  total?: string;
  paid_amounts?: string[];
  sort_key?: string | null;
};

/**
 * 다음 쪽을 가리키는 키. `[정렬값, 이름, id]`.
 *
 * 이름이 같은 업체가 있어 id를 함께 넣고, 정렬값을 함께 넣는 것은 **이름 아닌
 * 순서로도 이어붙일 수 있게** 하기 위해서다. 정렬값 없이 이름만 들고 가면
 * "데이터 많은 순"의 둘째 쪽이 첫 쪽과 겹친다.
 */
type Cursor = [string, string, string];

function encodeCursor(row: VendorRow): string {
  return Buffer.from(JSON.stringify([row.sort_key ?? '', row.name, row.id]), 'utf8').toString(
    'base64url'
  );
}

function decodeCursor(cursor: string): Cursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));

    if (Array.isArray(parsed) && parsed.length === 3 && parsed.every((v) => typeof v === 'string')) {
      return parsed as Cursor;
    }
  } catch {
    // 망가진 커서는 첫 쪽으로 되돌린다. 오류를 띄우느니 처음부터 보여주는 편이 낫다.
  }

  return null;
}

/**
 * 정렬마다 무엇으로 줄을 세우는가.
 *
 * `key`는 **절대 NULL이 되지 않는다.** 자료가 없는 업체를 coalesce로 양 끝에
 * 보내는데, NULL을 남겨두면 커서 비교가 NULL과 견주게 되어 그 자리에서 목록이
 * 끊긴다. 어느 쪽 끝으로 보낼지는 정렬마다 다르다 — 금액 낮은 순에서 자료 없는
 * 업체가 맨 앞에 오면 "가장 싼 곳"이 자료 없는 곳이 된다.
 */
const SORTS = {
  name: { key: null, direction: 'ASC' as const },
  data: { key: 'coalesce(w.proof_count, 0)', direction: 'DESC' as const },
  price_low: {
    // 자료 없는 업체를 맨 뒤로. bigint의 최댓값이면 어떤 금액보다 크다.
    key: 'coalesce(w.median_amount, 9223372036854775807)',
    direction: 'ASC' as const,
  },
  price_high: { key: 'coalesce(w.median_amount, 0)', direction: 'DESC' as const },
};

function toSummary(row: VendorRow) {
  return {
    id: row.id,
    name: row.name,
    category: row.category as VendorCategory,
    region: row.region,
    coordinates: row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : null,
    sourceNote: vendorSourceNote(row.source, row.source_url),
    imageUrl: row.image_url ?? null,
    comparableQuoteCount: Number(row.comparable_quote_count),
    styleTags: (row.style_tags ?? []).filter(isWeddingStyle),
    guidePrice: guidePriceOf(row),
  };
}

/**
 * 업체 안내 가격(정보 0층 · v3.22). 금액과 출처가 같이 있어야 한다 — 출처 없는
 * 숫자는 «업체 안내»라고 적을 수 없다(마이그레이션 0090의 CHECK와 같은 규칙).
 */
function guidePriceOf(row: Pick<VendorRow, 'guide_price_from' | 'guide_price_source'>) {
  if (row.guide_price_from === null || row.guide_price_from === undefined) return null;
  const fromKrw = Number(row.guide_price_from);
  if (!Number.isFinite(fromKrw) || fromKrw <= 0) return null;
  return { fromKrw, sourceLabel: row.guide_price_source ?? '업체 안내' };
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
 * 판정 전 사진을 화면에 내보내는가.
 *
 * **2026-09-11 대표 지시 — 「이미지 720장만 우선 삽입한다」.** 운영에 들어 있는
 * 720장은 저작권 근거가 `unknown`이고 매칭 신뢰도가 0이라 한 장도 나가지 않았다.
 * 처음에는 운영자에게만 열었는데, 대표님이 전부 넣으라고 정했으므로 모두에게 연다.
 *
 * **값은 여전히 고치지 않는다.** `copyright_basis`를 배치로 바꾸면 판정한 적 없는
 * 것이 판정된 것으로 남고 되돌릴 근거까지 사라진다. 표에 적힌 사실은 그대로 두고
 * 내보낼지만 여기서 정한다 — 닫을 때 되돌릴 것이 이 스위치 하나다.
 *
 * `VENDOR_IMAGES_SHOW_UNVERIFIED=0`이면 닫힌다. 그때는 예전처럼 운영자에게만
 * 열리므로, 닫은 뒤에도 무엇이 들어 있는지는 계속 볼 수 있다.
 */
export function showsUnverifiedImages(): boolean {
  return process.env.VENDOR_IMAGES_SHOW_UNVERIFIED !== '0';
}

async function previewsImages(pool: Pool, viewerId: string | null): Promise<boolean> {
  if (showsUnverifiedImages()) return true;

  /*
   * 닫아둔 동안에도 운영자는 본다. 로그인하지 않았으면 질의도 하지 않는다 — 목록
   * 한 번에 한 번씩 더 묻는 자리라, 대부분인 비로그인 요청에서 아무 일도 일어나지
   * 않는 편이 맞다.
   */
  if (!viewerId) return false;

  const { rows } = await pool.query<{ is_operator: boolean }>(
    `SELECT is_operator FROM structured.users WHERE id = $1 AND deleted_at IS NULL`,
    [viewerId]
  );

  return rows[0]?.is_operator === true;
}

/**
 * 업체 한 곳의 상세.
 *
 * 상품별 가격은 comparable_quotes에서 그때그때 계산한다. 표본이 기준에 못 미치는
 * 상품은 아예 내려보내지 않는다 — 중앙값 없는 상품 이름만 늘어놓으면 화면이 그것을
 * 가격으로 그릴 여지가 생긴다.
 */
async function loadVendorDetail(pool: Pool, vendorId: string, viewerId: string | null) {
  const preview = await previewsImages(pool, viewerId);

  const { rows } = await pool.query<VendorRow>(
    `SELECT v.id, v.name, v.category, v.region, v.source, to_jsonb(v)->>'source_url' AS source_url, v.last_verified_at, v.lat, v.lng,
              v.style_tags::text[] AS style_tags, v.guide_price_from, v.guide_price_source,
              (SELECT i.source_url FROM structured.vendor_images i
                 WHERE i.vendor_id = v.id AND ${displayableImageCondition('i', { preview })}
                   AND i.source_url IS NOT NULL
                 ORDER BY i.is_representative DESC, i.created_at LIMIT 1) AS image_url,
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
         -- 폐업으로 넘긴 업체는 세지 않는다. 세면 눌러도 아무것도 안 나오는 필터가 생긴다.
         AND coalesce(is_active, true)
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

    /* 판정 전 사진은 운영자에게만 열린다(previewsImages). */
    const preview = await previewsImages(context.pool, optionalUserId(request));

    /*
     * 정규화는 DB의 normalize_vendor_name을 그대로 쓴다. 서버가 따로 흉내내면 색인에
     * 저장된 값과 어긋나 "분명히 있는데 안 나오는" 업체가 생긴다.
     *
     * 확인된 계약 수는 comparable_quotes 뷰에서 센다 — 등급·확인 조건이 뷰 안에 있어
     * 여기서 다시 쓰지 않는다.
     */
    const sort = SORTS[query.sort];

    /*
     * 예산 구간 · «실 제보가 있는 곳만»(WP-SRCH-005).
     *
     * 무엇을 기준으로 거를지는 **화면이 보여주는 금액과 같아야 한다.** 목록의 금액
     * 한 줄은 `priceLine`이 정한다 — 실 제보가 공개 기준(3건)에 닿으면 그 금액들,
     * 아니면 업체 안내 시작 금액이다. 그래서 거르는 값도 같은 순서로 고른다:
     * 창 안의 실 제보가 기준에 닿으면 그 중앙값, 아니면 `guide_price_from`.
     *
     * 공개 기준 수(3)는 SQL에 적지 않고 도메인에서 받아 넘긴다 — 정책이 바뀌면
     * `DISCLOSURE_THRESHOLDS` 하나만 고치면 되게.
     *
     * 둘 다 없는 업체(«수집 중»)는 예산을 걸면 빠진다. 금액을 모르는 곳을 어느
     * 구간에 넣어도 그건 우리가 지어낸 값이다.
     */
    const budget = budgetBand(query.budget);
    const inWindow = `FROM structured.usable_payment_proofs p
                       WHERE p.vendor_id = v.id
                         AND p.paid_at >= now() - ($8 || ' months')::interval`;
    const proofCount = `(SELECT count(*) ${inWindow})`;
    /** 화면이 보여주는 금액 — 실 제보가 공개 기준에 닿으면 그 중앙값, 아니면 업체 안내 시작 금액. */
    const shownAmount = `CASE WHEN ${proofCount} >= $9::int
                              THEN (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY p.paid_amount) ${inWindow})
                              ELSE v.guide_price_from END`;
    /*
     * 조건이 꺼져 있으면 그 줄은 통째로 참이 된다($10 · $11 · $12가 NULL). 파라미터를
     * 늘였다 줄였다 하면 번호가 밀려 조용히 다른 칸을 본다.
     *
     * 금액을 모르는 업체(«수집 중»)는 예산을 걸면 저절로 빠진다 — NULL과의 비교가
     * 참이 되지 않는다. 모르는 곳을 어느 구간에 넣어도 그건 우리가 지어낸 값이다.
     */
    const narrow = `AND (NOT $10::boolean OR ${proofCount} >= $9::int)
                    AND ($11::bigint IS NULL OR (${shownAmount}) >= $11::bigint)
                    AND ($12::bigint IS NULL OR (${shownAmount}) < $12::bigint)`;

    /*
     * 이어붙이기 조건.
     *
     * 정렬값이 같은 업체가 여럿이라 `(값, 이름, id)`를 한 줄로 견주지 못한다 —
     * 첫 칸은 내림차순인데 나머지는 오름차순인 경우가 있어서다. 그래서 "값이
     * 지났거나, 값이 같고 이름·id가 지났거나"로 나눠 적는다.
     */
    const after = query.cursor ? decodeCursor(query.cursor) : null;
    const beyond = sort.direction === 'DESC' ? '<' : '>';

    const where = sort.key
      ? `($4::text IS NULL OR ${sort.key} ${beyond} $4::bigint
           OR (${sort.key} = $4::bigint AND (v.name, v.id) > ($5, $6::uuid)))`
      : `($4::text IS NULL OR (v.name, v.id) > ($5, $6::uuid))`;

    const orderBy = sort.key
      ? `${sort.key} ${sort.direction}, v.name, v.id`
      : 'v.name, v.id';

    const { rows } = await context.pool.query<VendorRow>(
      `WITH needle AS (
         SELECT CASE WHEN $1::text IS NULL THEN NULL
                     ELSE structured.normalize_vendor_name($1) END AS value
       ),
       found AS (
         SELECT v.id, v.name, v.category, v.region, v.source, to_jsonb(v)->>'source_url' AS source_url, v.last_verified_at, v.lat, v.lng,
                v.style_tags, v.guide_price_from, v.guide_price_source
         FROM structured.vendors v, needle n
         WHERE (n.value IS NULL
                OR v.normalized_name LIKE '%' || n.value || '%'
                OR EXISTS (SELECT 1 FROM structured.vendor_aliases a
                           WHERE a.vendor_id = v.id
                             AND a.normalized_alias LIKE '%' || n.value || '%'))
           AND ($2::vendor_category IS NULL OR v.category = $2)
           AND ($3::text IS NULL OR v.region LIKE $3 || '%')
           /*
            * 폐업으로 넘긴 업체는 검색에 내보내지 않는다(0047 is_active).
            * 그 컬럼은 0047부터 「검색·비교에서 폐업 업체를 뺀다」고 적어두고 있었는데
            * 실제로 거르는 곳은 추천 하나뿐이었다 — 검색은 그대로 내보내고 있었다.
            * 상세와 비교는 계속 열린다: 이미 담아둔 사람이 왜 사라졌는지 봐야 한다.
            */
           AND coalesce(v.is_active, true)
           ${narrow}
       )
       SELECT v.id, v.name, v.category, v.region, v.source, to_jsonb(v)->>'source_url' AS source_url, v.last_verified_at, v.lat, v.lng,
              v.style_tags::text[] AS style_tags, v.guide_price_from, v.guide_price_source,
              (SELECT i.source_url FROM structured.vendor_images i
                 WHERE i.vendor_id = v.id AND ${displayableImageCondition('i', { preview })}
                   AND i.source_url IS NOT NULL
                 ORDER BY i.is_representative DESC, i.created_at LIMIT 1) AS image_url,
              (SELECT count(*) FROM structured.comparable_quotes c WHERE c.vendor_id = v.id)
                AS comparable_quote_count,
              coalesce(w.proof_count, 0) AS proof_count,
              /* 전체 건수는 한 번만 센다 — 행마다 found를 다시 훑으면 업체 수의 제곱으로 느려진다. */
              count(*) OVER () AS total,
              ${sort.key ? `(${sort.key})::text` : 'NULL::text'} AS sort_key,
              /*
               * 목록에 실을 금액들. 구간은 도메인이 만든다 — 몇 건부터 무엇을
               * 보여줄지를 SQL이 다시 정하면 상세와 어긋난다.
               */
              coalesce(
                (SELECT array_agg(p.paid_amount)
                 FROM structured.usable_payment_proofs p
                 WHERE p.vendor_id = v.id
                   AND p.paid_at >= now() - ($8 || ' months')::interval),
                ARRAY[]::bigint[]
              ) AS paid_amounts
       FROM found v
       LEFT JOIN structured.vendor_paid_window w ON w.vendor_id = v.id
       WHERE ${where}
       ORDER BY ${orderBy}
       LIMIT $7`,
      [
        query.q && query.q.length > 0 ? query.q : null,
        query.category ?? null,
        query.region && query.region.length > 0 ? query.region : null,
        after?.[0] ?? null,
        after?.[1] ?? null,
        after?.[2] ?? null,
        query.limit + 1,
        DEFAULT_PERIOD_MONTHS,
        DISCLOSURE_THRESHOLDS.limited,
        query.onlyVerified,
        budget?.fromKrw ?? null,
        budget?.toKrw ?? null,
      ]
    );

    // 한 건 더 불러 다음 쪽이 있는지 본다. 마지막 쪽에서 빈 쪽을 한 번 더 부르지 않게.
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    /*
     * 광고는 첫 쪽에만 싣는다. 쪽마다 다시 나오면 스크롤할수록 광고가 늘어난다.
     * 커서가 없다는 것이 첫 쪽이라는 뜻이다.
     */
    const sponsored =
      after === null
        ? await loadSponsored(context.pool, {
            category: query.category,
            region: query.region && query.region.length > 0 ? query.region : undefined,
          }).catch((error: unknown) => {
            /*
             * 광고를 못 읽었다고 검색이 안 되면 곁가지가 본줄기를 끊는 셈이다.
             * 대신 조용히 지나가지 않게 남긴다 — 처음 이걸 삼켰을 때 질의가
             * 깨져 있는 것을 한참 못 봤다.
             */
            request.log.error({ error }, '광고 자리를 읽지 못했다');
            return [];
          })
        : [];

    return {
      vendors: page.map((row) => ({
        ...toSummary(row),
        paidPrice: discloseAmounts({
          amounts: (row.paid_amounts ?? []).map(Number),
          period: DEFAULT_PERIOD_LABEL,
        }),
      })),
      // 같은 배열에 넣지 않는다. 타입이 섞을 자리를 주지 않는다(E-1).
      sponsored,
      nextCursor: hasMore && page.length > 0 ? encodeCursor(page[page.length - 1]!) : null,
      total: Number(page[0]?.total ?? 0),
    };
  });

/**
 * 검색 지면의 광고. 최종통합정책 v2.0 E-1.
 *
 * **자연 결과를 세는 질의와 따로 부른다.** 한 질의에 조인해 넣으면 광고 여부가
 * 정렬·페이징과 한 덩어리가 되고, 그때부터 "이 업체가 위에 있는 것이 광고
 * 때문인지"에 답할 수 없다. `ads.`를 앞에 적어야 닿는 것도 같은 이유다.
 *
 * 실패해도 검색을 막지 않는다 — 광고를 못 읽었다고 검색이 안 되면, 곁가지가
 * 본줄기를 끊는 셈이 된다.
 */
async function loadSponsored(
  pool: Pool,
  filter: { category?: string; region?: string }
): Promise<{ vendorId: string; name: string; category: VendorCategory; region: string; imageUrl: string | null; label: typeof SPONSORED_LABEL }[]> {
  const { rows } = await pool.query<{
    vendor_id: string;
    name: string;
    category: string;
    region: string;
    image_url: string | null;
  }>(
    /*
     * 한 업체는 한 번만 실린다.
     *
     * 자리를 겹쳐 잡아둘 수 있고(기간이 겹치는 두 건), 그러면 같은 업체가 두 줄로
     * 나온다. 렌더해보고 잡았다 — 표에서 막기보다 여기서 묶는 이유는, 겹치는
     * 기간을 표로 막으려면 자리를 나눠 잡는 정상적인 경우까지 걸리기 때문이다.
     */
    /*
     * 광고 자리에는 검수 모드를 걸지 않는다. 여기 실리는 사진은 업체가 돈을 내고
     * 건 자리에 나가는 것이라, 판정 전 사진이 섞이면 「우리가 고르지 않은 사진이
     * 우리 광고에 나갔다」가 된다. 운영자가 보고 있어도 마찬가지다.
     */
    `SELECT picked.vendor_id, picked.name, picked.category, picked.region,
            (SELECT i.source_url FROM structured.vendor_images i
             WHERE i.vendor_id = picked.vendor_id AND ${displayableImageCondition('i')}
               AND i.source_url IS NOT NULL
             ORDER BY i.is_representative DESC, i.created_at LIMIT 1) AS image_url
     FROM (
       SELECT DISTINCT ON (p.vendor_id)
              p.vendor_id, v.name, v.category, v.region
       FROM ads.active_placements p
       JOIN structured.vendors v ON v.id = p.vendor_id
       /*
        * 실운영으로 연 상품만 실린다. 결정이 없으면 테스트라 화면에 안 나간다 —
        * "AI가 멋대로 광고 스위치를 올리는 일 금지"가 여기까지 와야 뜻이 있다.
        */
       JOIN ads.tier_state t ON t.tier = p.tier AND t.state = 'live'
       WHERE p.surface = 'search'
         AND EXISTS (SELECT 1 FROM ads.production_gate g WHERE g.id = true AND g.activated)
         AND (p.category IS NULL OR $1::text IS NULL OR p.category::text = $1::text)
         AND (p.region IS NULL OR $2::text IS NULL OR p.region = $2::text)
       ORDER BY p.vendor_id
     ) picked
     ORDER BY picked.name
     LIMIT $3::int`,
    [filter.category ?? null, filter.region ?? null, SPONSORED_LIMIT]
  );

  return rows.map((row) => ({
    vendorId: row.vendor_id,
    name: row.name,
    category: row.category as VendorCategory,
    region: row.region,
    imageUrl: row.image_url ?? null,
    label: SPONSORED_LABEL,
  }));
}

/**
 * 한 화면에 실을 광고 수.
 *
 * 자연 결과가 스무 곳인데 광고가 열 개면, 그건 분리된 영역이 아니라 광고 화면에
 * 검색 결과가 딸려 있는 것이다.
 */
const SPONSORED_LIMIT = 2;

/**
 * 조건이 비슷한 결제 사례. v2.0 D-1 · C-3 · C-4.
 *
 * 세 겹으로 좁혀 세어보고, **보여줄 수 있는 가장 넓은 겹**을 고른다
 * (`widestDisclosable`). 못 보여줄 바에는 넓게라도 보여주는 것이 낫고, 그게 C-4의
 * "묶거나 숨긴다"에서 묶는 쪽이다.
 *
 * 좁힐수록 더 많은 건수를 요구하는 이유는 건수가 아니라 조합이 문제이기 때문이다 —
 * "서울 · 최근 3개월"로 좁힌 3건은 서로를 알 만한 사람 셋일 수 있다.
 */
async function loadConditionStats(
  pool: Pool,
  vendorId: string,
  userId: string | null
): Promise<
  | { available: false; note: string }
  | { available: true; condition: string; axes: number; price: ReturnType<typeof discloseAmounts> }
> {
  const vendor = await pool.query<{ category: string; region: string }>(
    'SELECT category, region FROM structured.vendors WHERE id = $1',
    [vendorId]
  );

  const found = vendor.rows[0];
  if (!found) throw notFound('업체');

  /*
   * 결제인증이 여는 것은 접근이 아니라 깊이다(K-6 · D-1). 실제 결제 구간은
   * 누구나 보고, 조건을 좁힌 사례가 여기서 열린다.
   */
  const proofs = userId
    ? await pool.query<{ count: string }>(
        'SELECT count(*) AS count FROM structured.usable_payment_proofs WHERE reporter_user_id = $1',
        [userId]
      )
    : null;

  if (!hasDeepData({ usablePaymentProofCount: Number(proofs?.rows[0]?.count ?? 0) })) {
    return { available: false, note: DEEP_DATA_NOTE };
  }

  /*
   * 좁힌 겹마다 금액을 따로 읽는다. 한 번에 읽어 코드에서 나누지 않는 이유는,
   * 지역과 시기를 SQL에서 거르는 것이 나중에 축이 늘어날 때 늘리기 쉬워서다.
   */
  const region = coarseRegion(found.region);

  const layers = await Promise.all(
    CONDITION_NARROWING.map(async (_, axes) =>
      pool.query<{ paid_amount: string }>(
        `SELECT p.paid_amount
         FROM structured.usable_payment_proofs p
         JOIN structured.vendors v ON v.id = p.vendor_id
         WHERE v.category = $1
           AND p.paid_at >= now() - ($2 || ' months')::interval
           AND ($3 = 0 OR v.region LIKE $4 || '%')
           AND ($3 < 2 OR p.paid_at >= now() - ($5 || ' months')::interval)`,
        [found.category, DEFAULT_PERIOD_MONTHS, axes, region, RECENT_PERIOD_MONTHS]
      )
    )
  );

  const counts = layers.map((layer) => layer.rows.length);
  const axes = widestDisclosable(counts);

  if (axes === null) return { available: false, note: NARROWED_NOT_ENOUGH };

  return {
    available: true,
    condition: narrowedLabel(axes, {
      category: VENDOR_CATEGORY_LABEL[found.category as VendorCategory],
      region: found.region,
    }),
    axes,
    price: discloseAmounts({
      amounts: layers[axes]!.rows.map((row) => Number(row.paid_amount)),
      /*
       * 캡션의 기간은 실제로 거른 기간과 같아야 한다. 시기까지 좁힌 겹은 최근
       * 3개월만 세는데 캡션이 12개월이라고 적으면, 조건과 캡션이 서로 다른 말을
       * 하게 된다 — 라벨이 사실보다 앞서면 안 된다.
       */
      period: axes >= 2 ? RECENT_PERIOD_LABEL : DEFAULT_PERIOD_LABEL,
    }),
  };
}

  /** A-17 업체 상세. */
  app.get<{ Params: { vendorId: string } }>('/v1/vendors/:vendorId', auth, async (request) =>
    loadVendorDetail(context.pool, request.params.vendorId, optionalUserId(request))
  );

  /**
   * 조건이 비슷한 결제 사례. v2.0 D-1.
   *
   * 로그인은 선택이다 — 안 한 사람에게는 여는 방법을 알려주는 안내가 나간다.
   * 로그인을 요구하면 무엇이 열리는지 보기도 전에 계정을 만들라는 말이 된다.
   */
  app.get<{ Params: { vendorId: string } }>(
    '/v1/vendors/:vendorId/conditions',
    auth,
    async (request) =>
      loadConditionStats(context.pool, request.params.vendorId, optionalUserId(request))
  );

  /**
   * 업체 이벤트·혜택.
   *
   * 별도 수집 파이프라인이 아직 없어 지금은 빈 배열을 돌려준다. vendor_events
   * 테이블이 생기면 이 핸들러만 채운다 — 응답 모양은 바꾸지 않는다.
   */
  app.get<{ Params: { vendorId: string } }>(
    '/v1/vendors/:vendorId/events',
    auth,
    async (request) => {
      const { vendorId } = request.params;

      const { rows } = await context.pool.query<{ id: string }>(
        'SELECT id FROM structured.vendors WHERE id = $1',
        [vendorId]
      );

      if (!rows[0]) throw notFound('업체');

      return {
        events: [] as Array<{ id: string; title: string; endsOn: string | null }>,
      };
    }
  );

  /**
   * WP-VEND-002 업체 이미지 전체보기.
   *
   * approved 상태만 내려간다 — pending·rejected는 아직 검증 전이거나 노출 기준에
   * 못 미친 것이라 사용자에게 보이면 안 된다. 대표 이미지가 맨 앞에 오도록
   * `is_representative DESC`로 정렬하고, 그다음은 수집 순서(created_at ASC)다.
   *
   * URL은 source_url이 있으면 그대로 쓴다 — 외부 출처를 우리 저장소를 거치지
   * 않고 직접 보여줄 수 있는 경우다. storage_key만 있으면 스토리지에 서명된
   * 조회 URL을 그때그때 발급한다 — 영구 URL을 내려주면 만료 시각을 관리할
   * 방법이 없다.
   */
  app.get<{ Params: { vendorId: string } }>(
    '/v1/vendors/:vendorId/images',
    auth,
    async (request) => {
      const { vendorId } = request.params;

      const vendorCheck = await context.pool.query<{ id: string }>(
        'SELECT id FROM structured.vendors WHERE id = $1',
        [vendorId]
      );

      if (!vendorCheck.rows[0]) throw notFound('업체');

      /* 판정 전 사진은 운영자에게만 열린다(previewsImages). */
      const preview = await previewsImages(context.pool, optionalUserId(request));

      const { rows } = await context.pool.query<{
        id: string;
        storage_key: string | null;
        source_url: string | null;
        is_representative: boolean;
        use_contain: boolean;
        copyright_note: string | null;
        verified_at: Date | null;
      }>(
        `SELECT id, storage_key, source_url, is_representative, use_contain,
                copyright_note, verified_at
         FROM structured.vendor_images
         WHERE vendor_id = $1 AND ${displayableImageCondition('vendor_images', { preview })}
         ORDER BY is_representative DESC, created_at ASC`,
        [vendorId]
      );

      /*
       * 둘 다 없는 줄은 거른다. 가리킬 곳이 없는 사진이라 화면에 빈 칸만 남는데,
       * 예전에는 `storage_key!`가 그 경우를 「있다」로 단정하고 있었다. 판정 전
       * 사진까지 열리면서 지나가는 줄이 늘었으므로 여기서 먼저 막는다.
       */
      const photos = await Promise.all(
        rows
          .filter((row) => row.source_url !== null || row.storage_key !== null)
          .map(async (row) => ({
            id: row.id,
            url: row.source_url ?? (await context.storage.getPublicUrl(row.storage_key!, 3600)),
            isRepresentative: row.is_representative,
            useContain: row.use_contain,
            sourceNote: row.copyright_note,
            verifiedAt: row.verified_at ? row.verified_at.toISOString() : null,
          }))
      );

      return { photos };
    }
  );

  /**
   * 업체 가격 구간 통계.
   *
   * Pick 인증된 결제 자료를 바탕으로 가격 구간과 건수를 돌려준다.
   * 공개 기준(discloseAmounts)을 그대로 따른다.
   */
  app.get<{ Params: { vendorId: string } }>(
    '/v1/vendors/:vendorId/price-range',
    auth,
    async (request) => {
      const { vendorId } = request.params;

      const vendorCheck = await context.pool.query<{ id: string }>(
        'SELECT id FROM structured.vendors WHERE id = $1',
        [vendorId]
      );

      if (!vendorCheck.rows[0]) throw notFound('업체');

      const proofs = await context.pool.query<{ paid_amount: string }>(
        `SELECT paid_amount
         FROM structured.usable_payment_proofs
         WHERE vendor_id = $1
           AND paid_at >= now() - ($2 || ' months')::interval`,
        [vendorId, DEFAULT_PERIOD_MONTHS]
      );

      const amounts = proofs.rows.map((r) => Number(r.paid_amount));

      return {
        vendorId,
        ...discloseAmounts({ amounts, period: DEFAULT_PERIOD_LABEL }),
        caveat: PRICE_REPORT_CAVEAT,
      };
    }
  );
}
