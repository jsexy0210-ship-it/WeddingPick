import { top3QuerySchema } from '@weddingpick/api-contract';
import {
  DEFAULT_PERIOD_LABEL,
  DEFAULT_PERIOD_MONTHS,
  PREPARATION_CATEGORIES,
  RECENT_PERIOD_MONTHS,
  TOP3_LIMIT,
  TOP3_EMPTY,
  TOP3_PARTIAL_NOTE,
  discloseAmounts,
  isRecommendable,
  nextTasteCategory,
  reasonsFor,
  regionFilter,
  regionMatches,
  type VendorCategory,
  type WeddingBudgetBracket,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { optionalUser, optionalUserId } from '../auth/plugin';
import type { AppContext } from '../context';

type CandidateRow = {
  id: string;
  name: string;
  category: VendorCategory;
  region: string;
  image_url: string | null;
  confirmed_count: string;
  recent_count: string;
  paid_amounts: string[] | null;
};

type ViewerRow = {
  region: string | null;
  budget_bracket: WeddingBudgetBracket | null;
  prepared_categories: VendorCategory[];
};

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

    /*
     * 로그인한 사람이면 자기 웨딩에서 지역 · 준비 예산 · 준비 현황을 읽는다. 쿼리가
     * 있으면 쿼리가 이긴다 — 화면에서 지역을 바꿔보는 중일 수 있다.
     */
    const viewer = userId
      ? (
          await context.pool.query<ViewerRow>(
            /* enum 배열은 드라이버가 문자열 '{a,b}'로 준다 — text[]로 바꿔 읽는다. */
            `SELECT region, budget_bracket, prepared_categories::text[] AS prepared_categories FROM structured.weddings
             WHERE owner_user_id = $1 OR partner_user_id = $1
             ORDER BY created_at LIMIT 1`,
            [userId]
          )
        ).rows[0]
      : undefined;

    /* 온보딩의 `그 외`는 전국이다 — 지역으로 거르지 않는다(regionFilter). */
    const region = regionFilter(query.region ?? viewer?.region ?? null);
    /* 준비 예산 구간. 예산 매칭은 겹침 기준이라(SPEC §13.6) 숫자 하나가 아니라 구간을 넘긴다. */
    const budgetBracket = viewer?.budget_bracket ?? null;
    const prepared = viewer?.prepared_categories ?? [];
    /*
     * 업종을 안 주면 준비 현황(3/5)에서 아직 안 정한 첫 업종을 본다 — 이미 정한
     * 업종을 추천하면 «이미 골랐는데 왜 또?»가 된다(v3.19). 아무것도 안 정했으면
     * 웨딩홀부터 — 준비 순서에서 가장 먼저 정해지는 업종이고, 나머지 업종의
     * 날짜와 예산이 여기서 갈린다. 화면이 업종을 콕 집어 보내면 그대로 따른다.
     */
    const category: VendorCategory =
      query.category ??
      nextTasteCategory(prepared) ??
      PREPARATION_CATEGORIES.find((candidate) => !prepared.includes(candidate)) ??
      'hall';

    /*
     * 후보를 넉넉히 읽는다. 자격 판정(실 제보 수·이유)이 도메인에 있어서
     * 여기서는 못 거른다 — 세 줄만 읽으면 그 셋이 전부 탈락했을 때 남는 것이 없다.
     */
    const { rows } = await context.pool.query<CandidateRow>(
      /*
       * 실 제보는 **금액 캡션이 세는 것과 같은 것**을 센다 — 기본 기간 안의
       * 확인된 결제다. 계약 자료를 따로 세면 카드가 `실 제보가 많아요`라고
       * 적어놓고 캡션에 다른 수를 적는다.
       *
       * `최근`은 그보다 짧은 기간이다. 같은 기간을 두 번 세면 두 이유가 늘 붙어
       * 다니는 한 문장이 된다.
       */
      `SELECT
         v.id, v.name, v.category, v.region,
         (SELECT i.source_url FROM structured.vendor_images i
            WHERE i.vendor_id = v.id AND i.status = 'approved' AND i.source_url IS NOT NULL
            ORDER BY i.is_representative DESC, i.created_at LIMIT 1) AS image_url,
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
         ) AS paid_amounts
       FROM structured.vendors v
       WHERE v.category = $1::vendor_category
         AND ($2::text IS NULL OR v.region LIKE $2 || '%')
       ORDER BY confirmed_count DESC, recent_count DESC, v.name, v.id
       LIMIT $4`,
      [category, region, DEFAULT_PERIOD_MONTHS, TOP3_LIMIT * 10, RECENT_PERIOD_MONTHS]
    );

    const items = [];

    for (const row of rows) {
      const amounts = (row.paid_amounts ?? []).map(Number);
      const paidPrice = discloseAmounts({ amounts, period: DEFAULT_PERIOD_LABEL });
      const facts = {
        /*
         * 지역을 안 고른 사람에게는 지역이 이유가 될 수 없다. 화면은 "서울"을
         * 보내고 업체는 "서울특별시 강남구"라 앞글자로 맞춘다 — 위 SQL의 LIKE와 같다.
         */
        regionMatched: region !== null && regionMatches(row.region, region),
        confirmedCount: Number(row.confirmed_count),
        recentCount: Number(row.recent_count),
        /* 제보 금액 구간. 모으는 중(collecting)이면 아직 없다 — 그때는 예산으로 말하지도 거르지도 않는다. */
        priceMin: paidPrice.stage === 'collecting' ? null : paidPrice.low,
        priceMax: paidPrice.stage === 'collecting' ? null : paidPrice.high,
        budgetBracket,
      };

      if (!isRecommendable(facts)) continue;

      items.push({
        vendorId: row.id,
        name: row.name,
        category: row.category,
        region: row.region,
        imageUrl: row.image_url ?? null,
        reasons: reasonsFor(facts),
        confirmedCount: facts.confirmedCount,
        paidPrice,
      });

      if (items.length === TOP3_LIMIT) break;
    }

    return {
      region,
      category,
      items,
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
