import type { VendorSummary } from '@weddingpick/api-contract';
import { top3QuerySchema } from '@weddingpick/api-contract';
import {
  DEFAULT_PERIOD_LABEL,
  DEFAULT_PERIOD_MONTHS,
  PREPARATION_CATEGORIES,
  RECOMMEND_VENDORS_PER_CATEGORY,
  RECENT_PERIOD_MONTHS,
  TOP3_LIMIT,
  TOP3_EMPTY,
  TOP3_PARTIAL_NOTE,
  TOP3_REASON_LABEL,
  VENDOR_CATEGORY_LABEL,
  categoryPickState,
  compareRecommendCategories,
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
  showsInRecommend,
  styleOverlap,
  type CategoryPickState,
  type PreparationState,
  type Top3Reason,
  type VendorCategory,
  type WeddingBudgetBracket,
  type WeddingStyle,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { currentUserId, optionalUser, optionalUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { assertFeatureEnabled } from '../kill-switches';
import { summaryRating } from '../review-view';
import { loadVendorSummaries } from './vendors';
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
  rating_count: string;
  rating_avg: string | null;
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
  /** 별점. 검색 카드와 같은 관문·같은 문턱이다(review-view summaryRating). 없으면 null. */
  rating: { average: number; count: number } | null;
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
  // 관리자가 «AI 추천»을 껐으면 빈 목록을 돌려주지 않는다 — 「추천할 것이 없다」와
  // 「추천을 껐다」는 화면에서 같아 보이면 안 된다. 503으로 멈춘다.
  await assertFeatureEnabled(context.pool, 'ai-recommendations');

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
          WHERE i.vendor_id = v.id AND i.status = 'approved' AND i.copyright_basis <> 'unknown'
            AND i.source_url IS NOT NULL
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
       (SELECT count(*) FROM structured.scored_reviews sr WHERE sr.vendor_id = v.id)
         AS rating_count,
       (SELECT avg(sr.overall) FROM structured.scored_reviews sr WHERE sr.vendor_id = v.id)
         AS rating_avg,
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
        rating: summaryRating({
          category: row.category,
          count: Number(row.rating_count ?? 0),
          average: row.rating_avg === null ? null : Number(row.rating_avg),
        }),
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
 * 아직 정하지 않은 업종과 그 업종의 추천 업체. GET /v1/me/recommendations.
 *
 * **홈의 Pick 추천과 「웨딩픽 추천」 전체 페이지가 이 하나를 나눠 쓴다**(대표 사양 §12 · §14).
 * 홈은 `limit=3`으로 앞의 셋만, 전체 페이지는 `limit` 없이 전부 받는다. 두 화면이 각자
 * 추천을 만들면 「전체 페이지에서 본 곳이 홈에 없다」가 생기고, 그때 어느 쪽이 맞는지
 * 아무도 모른다.
 *
 * 업종을 고르는 일과 업체를 고르는 일을 나눠 둔다 — 업종 순서는 도메인
 * (`compareRecommendCategories`)이, 업체는 `recommendVendors`(TOP3와 같은 함수)가 정한다.
 */
export async function categoryRecommendations(
  context: AppContext,
  input: { userId: string; limit?: number }
): Promise<{
  groups: {
    category: VendorCategory;
    categoryLabel: string;
    state: CategoryPickState;
    pickCount: number;
    vendors: VendorSummary[];
  }[];
  remaining: number;
  remainingCategories: VendorCategory[];
}> {
  const wedding = (
    await context.pool.query<{ id: string; prepared_categories: VendorCategory[] }>(
      `SELECT id, prepared_categories::text[] AS prepared_categories
       FROM structured.weddings
       WHERE owner_user_id = $1 OR partner_user_id = $1
       ORDER BY created_at LIMIT 1`,
      [input.userId]
    )
  ).rows[0];

  /*
   * 웨딩이 없으면 준비 상태도 없다. 그래도 빈 목록을 돌려주지 않는다 — 준비 순서의 앞에서부터
   * 시작 전으로 세운다. 온보딩을 막 끝낸 사람이 홈에서 빈 자리를 보는 것이 가장 나쁘다.
   */
  const prepared = new Set(wedding?.prepared_categories ?? []);
  const progress = new Map<VendorCategory, { state: PreparationState; pickCount: number }>();

  if (wedding) {
    const { rows } = await context.pool.query<{
      category: VendorCategory;
      state: PreparationState;
      pick_count: string;
    }>(
      `SELECT p.category::text AS category, p.state, p.pick_count
       FROM structured.wedding_preparation p
       WHERE p.wedding_id = $1`,
      [wedding.id]
    );

    for (const row of rows) {
      progress.set(row.category, { state: row.state, pickCount: Number(row.pick_count) });
    }
  }

  const open = PREPARATION_CATEGORIES.map((category) => {
    const row = progress.get(category);
    const pickCount = row?.pickCount ?? 0;

    return {
      category,
      pickCount,
      state: categoryPickState({
        state: row?.state ?? 'before',
        pickCount,
        prepared: prepared.has(category),
      }),
    };
  })
    .filter((row) => showsInRecommend(row.state))
    .sort(compareRecommendCategories);

  const limit = input.limit ?? open.length;
  /*
   * 업종마다 추천을 부른다. **보여줄 업종만** 부른다 — 홈이 셋만 그리는데 열둘을 다 부르면
   * 그 아홉은 버려지고 질의만 남는다. 서로 기대지 않으므로 병렬로 묶는다.
   */
  const shown = await Promise.all(
    open.slice(0, limit).map(async (row) => {
      const vendors = await vendorsFor(context, {
        userId: input.userId,
        weddingId: wedding?.id ?? null,
        category: row.category,
        pickCount: row.pickCount,
      });

      return {
        category: row.category,
        categoryLabel: VENDOR_CATEGORY_LABEL[row.category],
        state: row.state,
        pickCount: row.pickCount,
        vendors,
      };
    })
  );

  return {
    groups: shown,
    /*
     * 「아직 결정하지 않은 준비가 N개 있어요」는 **보이는 수가 아니라 전체 수**다. 잘린 뒤에
     * 세면 홈에서는 늘 3이 되고, 그 줄은 아무것도 말하지 않게 된다.
     */
    remaining: open.length,
    remainingCategories: open.map((row) => row.category),
  };
}

/**
 * 펼쳤을 때 무엇이 보이는가. 대표 사양 §7의 「펼침 내용」 칸 그대로다.
 *
 *   담아둔 곳이 있다   **그 사람이 Pick한 곳**(SHORTLISTED · COMPARING)
 *   담아둔 곳이 없다   추천 업체(NOT_STARTED)
 *
 * **자기가 담은 곳을 자기 업종에서 못 보면 안 된다.** 웨딩홀 셋을 Pick해둔 사람이 웨딩홀을
 * 펼쳤을 때 모르는 세 곳이 나오면, 그 사람은 자기 Pick이 어디로 갔는지부터 찾는다 —
 * 사양 §8의 「추천 → 보기 → Pick → 비교 → 결정」이 거기서 끊긴다.
 *
 * 담은 곳이 셋을 넘으면 최근에 담은 셋이다. 카드 줄은 셋까지고(§6), 넘치는 것은
 * 「한눈에 비교」가 여는 업종 화면이 다 보여준다.
 */
async function vendorsFor(
  context: AppContext,
  input: { userId: string; weddingId: string | null; category: VendorCategory; pickCount: number }
) {
  if (input.pickCount > 0 && input.weddingId !== null) {
    const { rows } = await context.pool.query<{ vendor_id: string }>(
      `SELECT c.vendor_id
       FROM structured.vendor_candidates c
       JOIN structured.vendors v ON v.id = c.vendor_id
       WHERE c.wedding_id = $1 AND v.category = $2::vendor_category
       ORDER BY c.added_at DESC
       LIMIT $3`,
      [input.weddingId, input.category, RECOMMEND_VENDORS_PER_CATEGORY]
    );

    const picked = await loadVendorSummaries(
      context.pool,
      rows.map((row) => row.vendor_id)
    );

    /* 담은 곳을 못 읽었으면(업체가 사라졌다든가) 빈 칸을 두지 않고 추천으로 메운다. */
    if (picked.length > 0) return picked;
  }

  const { items } = await recommendVendors(context, {
    userId: input.userId,
    category: input.category,
    limit: RECOMMEND_VENDORS_PER_CATEGORY,
  });

  /* 이유 문장과 실 제보 수는 카드가 안 쓴다 — 목록 요약(vendorSummary)만 남긴다. */
  return items.map(({ reasonKeys: _keys, confirmedCount: _count, ...vendor }) => vendor);
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
  /**
   * Pick 추천 — 아직 정하지 않은 업종과 업종별 추천 업체.
   *
   * 로그인한 사람만이다. 준비 상태가 웨딩에 매달려 있어 비회원에게는 세울 업종이 없다.
   */
  app.get<{ Querystring: { limit?: string } }>(
    '/v1/me/recommendations',
    { preHandler: requireUser(context) },
    async (request) => {
      const limit = Number(request.query.limit);

      return categoryRecommendations(context, {
        userId: currentUserId(request),
        limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
      });
    }
  );

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
