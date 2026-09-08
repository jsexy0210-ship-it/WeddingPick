import { top3QuerySchema } from '@weddingpick/api-contract';
import {
  DEFAULT_PERIOD_LABEL,
  DEFAULT_PERIOD_MONTHS,
  PREPARATION_CATEGORIES,
  RECENT_PERIOD_MONTHS,
  TOP3_LIMIT,
  TOP3_EMPTY,
  TOP3_PARTIAL_NOTE,
  TOP3_REASON_LABEL,
  discloseAmounts,
  isRecommendable,
  isWeddingStyle,
  nextTasteCategory,
  reasonsFor,
  recommendScore,
  regionFilter,
  regionLikePattern,
  regionMatches,
  regionTokens,
  styleOverlap,
  type Top3Reason,
  type VendorCategory,
  type WeddingBudgetBracket,
  type WeddingStyle,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { optionalUser, optionalUserId } from '../auth/plugin';
import type { AppContext } from '../context';
import { vendorSourceNote } from '../vendor-view';

type CandidateRow = {
  id: string;
  name: string;
  category: VendorCategory;
  region: string;
  source: string;
  source_url: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  comparable_quote_count: string;
  style_tags: string[] | null;
  guide_price_from: string | number | null;
  guide_price_source: string | null;
  confirmed_count: string;
  recent_count: string;
  paid_amounts: string[] | null;
};

type ViewerRow = {
  region: string | null;
  budget_bracket: WeddingBudgetBracket | null;
  prepared_categories: VendorCategory[];
  style_tags: string[] | null;
};

/** 추천 한 줄 — 검색 카드와 같은 요약(vendorSummary) + 이유 + 실 제보 수. */
export type Recommendation = {
  id: string;
  name: string;
  category: VendorCategory;
  region: string;
  coordinates: { lat: number; lng: number } | null;
  sourceNote: string | null;
  imageUrl: string | null;
  comparableQuoteCount: number;
  styleTags: WeddingStyle[];
  guidePrice: { fromKrw: number; sourceLabel: string } | null;
  paidPrice: ReturnType<typeof discloseAmounts>;
  reasonKeys: Top3Reason[];
  /** 사용자 화면 문장. 스타일 일치가 먼저다. */
  reasons: string[];
  confirmedCount: number;
};

/**
 * 추천 — 통합정책 v3.10 §2 · 핸드오프 v3.22 «출시 초기 추천 근거».
 *
 *   출시   지역 + 스타일 + 업체 안내 가격
 *   이후   실 제보가 붙는 대로 가중치 상승
 *
 * 스타일 태그는 정렬 가중치로만 쓴다 — 태그가 다르다고 업체를 빼지 않는다. 자격
 * 판정(실 제보 3건 · 업체 안내 · 스타일 일치)과 이유는 도메인(top3.ts)이 정한다.
 *
 * 홈(bootstrap)과 TOP3 화면이 같은 함수를 쓴다 — 두 곳이 다른 순서를 보여주면
 * 사용자는 어느 쪽이 «웨딩픽 추천»인지 모른다.
 */
export async function recommendVendors(
  context: AppContext,
  input: { userId: string | null; category?: VendorCategory; region?: string | null; limit?: number }
): Promise<{ region: string | null; category: VendorCategory; items: Recommendation[] }> {
  const viewer = input.userId
    ? (
        await context.pool.query<ViewerRow>(
          /* enum 배열은 드라이버가 문자열 '{a,b}'로 준다 — text[]로 바꿔 읽는다. */
          `SELECT region, budget_bracket,
                  prepared_categories::text[] AS prepared_categories,
                  style_tags::text[] AS style_tags
           FROM structured.weddings
           WHERE owner_user_id = $1 OR partner_user_id = $1
           ORDER BY created_at LIMIT 1`,
          [input.userId]
        )
      ).rows[0]
    : undefined;

  /* 온보딩의 `그 외`는 전국이다 — 지역으로 거르지 않는다(regionFilter). */
  const region = regionFilter(input.region ?? viewer?.region ?? null);
  const budgetBracket = viewer?.budget_bracket ?? null;
  const prepared = viewer?.prepared_categories ?? [];
  const chosenStyles = (viewer?.style_tags ?? []).filter(isWeddingStyle);
  const limit = input.limit ?? TOP3_LIMIT;
  /*
   * 업종을 안 주면 준비 현황(3/5)에서 아직 안 정한 첫 업종을 본다 — 이미 정한
   * 업종을 추천하면 «이미 골랐는데 왜 또?»가 된다(v3.19). 아무것도 안 정했으면
   * 웨딩홀부터 — 준비 순서에서 가장 먼저 정해지는 업종이고, 나머지 업종의
   * 날짜와 예산이 여기서 갈린다. 화면이 업종을 콕 집어 보내면 그대로 따른다.
   */
  const category: VendorCategory =
    input.category ??
    nextTasteCategory(prepared) ??
    PREPARATION_CATEGORIES.find((candidate) => !prepared.includes(candidate)) ??
    'hall';

  /*
   * 후보를 넉넉히 읽는다. 자격 판정(실 제보 수 · 업체 안내 · 스타일)과 순위가
   * 도메인에 있어서 여기서는 못 거른다 — 세 줄만 읽으면 그 셋이 전부 탈락했을 때
   * 남는 것이 없다. SQL의 정렬은 후보를 고르는 1차 정렬일 뿐이고 최종 순서는
   * recommendScore가 정한다.
   */
  /*
   * 구 단위(«서울특별시 강남구»)로 먼저 찾고, 세 곳이 안 차면 시/도(«서울»)로 넓힌다.
   * 출시 초기에는 한 구에 업체가 몇 곳 없다 — 좁은 지역에서 빈 추천을 내느니 같은
   * 시/도의 곳을 뒤에 붙인다. 지역 이유는 시/도 기준으로도 참이다(regionMatches).
   */
  const regionSteps: (string | null)[] = region === null ? [null] : [region];
  if (region !== null && regionTokens(region).length > 1) regionSteps.push(regionTokens(region)[0]!);

  const scored: { score: number; item: Recommendation }[] = [];
  const seen = new Set<string>();

  for (const step of regionSteps) {
    if (scored.length >= limit) break;

    const { rows } = await context.pool.query<CandidateRow>(
    /*
     * 실 제보는 **금액 캡션이 세는 것과 같은 것**을 센다 — 기본 기간 안의
     * 확인된 결제다. 계약 자료를 따로 세면 카드가 `실 제보가 많아요`라고
     * 적어놓고 캡션에 다른 수를 적는다. `최근`은 그보다 짧은 기간이다.
     */
    `SELECT
       v.id, v.name, v.category, v.region, v.source, to_jsonb(v)->>'source_url' AS source_url, v.lat, v.lng,
       v.style_tags::text[] AS style_tags, v.guide_price_from, v.guide_price_source,
       (SELECT i.source_url FROM structured.vendor_images i
          WHERE i.vendor_id = v.id AND i.status = 'approved' AND i.source_url IS NOT NULL
          ORDER BY i.is_representative DESC, i.created_at LIMIT 1) AS image_url,
       (SELECT count(*) FROM structured.comparable_quotes c WHERE c.vendor_id = v.id)
         AS comparable_quote_count,
       (SELECT count(*) FROM structured.usable_payment_proofs p
        WHERE p.vendor_id = v.id AND p.paid_at >= now() - ($3 || ' months')::interval)
         AS confirmed_count,
       (SELECT count(*) FROM structured.usable_payment_proofs p
        WHERE p.vendor_id = v.id AND p.paid_at >= now() - ($5 || ' months')::interval)
         AS recent_count,
       coalesce(
         (SELECT array_agg(p.paid_amount)
          FROM structured.usable_payment_proofs p
          WHERE p.vendor_id = v.id
            AND p.paid_at >= now() - ($3 || ' months')::interval),
         ARRAY[]::bigint[]
       ) AS paid_amounts,
       cardinality(ARRAY(SELECT unnest(v.style_tags) INTERSECT SELECT unnest($6::wedding_style[])))
         AS style_overlap
     FROM structured.vendors v
     WHERE v.category = $1::vendor_category
       AND ($2::text IS NULL OR v.region LIKE $2)
       AND coalesce(v.is_active, true)
     ORDER BY style_overlap DESC, confirmed_count DESC, (v.guide_price_from IS NOT NULL) DESC,
              recent_count DESC, v.name, v.id
     LIMIT $4`,
    [category, step === null ? null : regionLikePattern(step), DEFAULT_PERIOD_MONTHS, Math.max(limit, TOP3_LIMIT) * 10, RECENT_PERIOD_MONTHS, chosenStyles]
  );

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const amounts = (row.paid_amounts ?? []).map(Number);
    const paidPrice = discloseAmounts({ amounts, period: DEFAULT_PERIOD_LABEL });
    const styleTags = (row.style_tags ?? []).filter(isWeddingStyle);
    const guideFrom = row.guide_price_from === null ? null : Number(row.guide_price_from);
    const guidePrice =
      guideFrom !== null && Number.isFinite(guideFrom) && guideFrom > 0
        ? { fromKrw: guideFrom, sourceLabel: row.guide_price_source ?? '업체 안내' }
        : null;
    const facts = {
      /*
       * 지역을 안 고른 사람에게는 지역이 이유가 될 수 없다. 화면은 "서울"을
       * 보내고 업체는 "서울특별시 강남구"라 앞글자로 맞춘다 — 위 SQL의 LIKE와 같다.
       */
      regionMatched: step !== null && regionMatches(row.region, step),
      chosenStyles: chosenStyles.length,
      styleOverlap: styleOverlap(chosenStyles, styleTags).length,
      hasGuidePrice: guidePrice !== null,
      confirmedCount: Number(row.confirmed_count),
      recentCount: Number(row.recent_count),
      /* 제보 금액 구간. 모으는 중(collecting)이면 아직 없다 — 그때는 예산으로 말하지도 거르지도 않는다. */
      priceMin: paidPrice.stage === 'collecting' ? null : paidPrice.low,
      priceMax: paidPrice.stage === 'collecting' ? null : paidPrice.high,
      budgetBracket,
    };

    if (!isRecommendable(facts)) continue;

    const reasonKeys = reasonsFor(facts);

    scored.push({
      score: recommendScore(facts),
      item: {
        id: row.id,
        name: row.name,
        category: row.category,
        region: row.region,
        coordinates: row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : null,
        sourceNote: vendorSourceNote(row.source, row.source_url),
        imageUrl: row.image_url ?? null,
        comparableQuoteCount: Number(row.comparable_quote_count),
        styleTags,
        guidePrice,
        paidPrice,
        reasonKeys,
        reasons: reasonKeys.map((key) => TOP3_REASON_LABEL[key]),
        confirmedCount: facts.confirmedCount,
      },
    });
  }

  }

  /* 안정 정렬 — 점수가 같으면 SQL이 준 순서(실 제보 많은 순 · 이름)를 지킨다. */
  const items = scored
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.item);

  return { region, category, items };
}

/**
 * 추천. 통합정책 v3.10 §2.
 *
 * **광고를 읽지 않는다.** 이 파일에 `ads.` 라는 글자가 없다는 것이 정책이다 —
 * "광고비는 자연 추천 순위에 영향을 줄 수 없다"를 규칙으로 적어두는 대신,
 * 광고를 섞으려면 이 파일에 스키마 이름을 새로 써야만 하도록 두었다. 리뷰에서
 * 눈에 띈다.
 */
export function registerRecommendationRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: optionalUser(context) };

  /**
   * 이 지역·업종의 TOP3.
   *
   * 비회원도 부른다. 지연 로그인이라 로그인 전에도 홈이 뜨고, 그때 지역은 기기에
   * 적혀 있어 쿼리로 넘어온다.
   */
  app.get('/v1/recommendations/top3', auth, async (request) => {
    const query = top3QuerySchema.parse(request.query);
    const userId = optionalUserId(request);

    const { region, category, items } = await recommendVendors(context, {
      userId,
      category: query.category,
      region: query.region,
    });

    return {
      region,
      category,
      items: items.map((item) => ({
        vendorId: item.id,
        name: item.name,
        category: item.category,
        region: item.region,
        imageUrl: item.imageUrl,
        reasons: item.reasonKeys,
        confirmedCount: item.confirmedCount,
        paidPrice: item.paidPrice,
        styleTags: item.styleTags,
        guidePrice: item.guidePrice,
      })),
      /*
       * 세 곳을 못 채웠으면 그렇다고 적는다. 아무 말 없이 두 줄만 두면 읽는
       * 사람은 세 번째가 로딩 중이거나 빠진 것이라고 읽는다.
       */
      note:
        items.length === 0
          ? TOP3_EMPTY
          : items.length < TOP3_LIMIT
            ? TOP3_PARTIAL_NOTE
            : null,
    };
  });
}
