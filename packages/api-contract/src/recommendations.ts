import { z } from 'zod';

import { CATEGORY_PICK_STATES, RECOMMEND_VENDORS_PER_CATEGORY } from '@weddingpick/domain';

import { vendorCategorySchema } from './common';
import { vendorSummarySchema } from './vendors';

/*
 * `GET /v1/recommendations/top3`(TOP3 추천 · 통합정책 v3.10 §2)를 이 계약이 지키던
 * 요청·응답 스키마(top3QuerySchema · top3ItemSchema · top3ResponseSchema ·
 * top3ReasonSchema)는 2026-09-23 v3.29 홈 재구축에서 지웠다 — 그 라우트를 부르는
 * 화면(top3.tsx)이 먼저 지워졌고 API·클라이언트가 뒤늦게 orphan으로 남아 있었다.
 * 업종별 추천(`categoryRecommendationSchema` 아래)이 홈과 「웨딩픽 추천」 전체 화면을
 * 계속 맡는다. `Top3Reason`(도메인 · `packages/domain/src/top3.ts`)은 그 업종별
 * 추천이 그대로 쓰므로 남겨 뒀다.
 */

/* ------------------------------------------------- 업종별 추천(Pick 추천 · 2026-09-15) */

/**
 * 업종 하나와 그 업종의 추천 업체. GET /v1/me/recommendations.
 *
 * 홈의 Pick 추천 아코디언과 「웨딩픽 추천」 전체 페이지가 **이 응답 하나**를 나눠 쓴다
 * (대표 사양 §12 · §14 — 「홈과 같은 추천 데이터를 쓴다. 별도 추천 로직을 중복 생성하지
 * 않는다」). 홈은 앞에서 셋만 받고 전체 페이지는 전부 받는다 — 두 화면이 다른 순서를
 * 보여줄 길이 자체가 없다.
 *
 * 업체 한 줄은 검색·홈과 **같은 `vendorSummary`**다. 카드를 두 벌 만들지 않는다.
 */
export const categoryRecommendationSchema = z.object({
  category: vendorCategorySchema,
  categoryLabel: z.string().min(1),
  /** 여섯 값 중 하나. 카테고리 줄 오른쪽 액션(추천 · 보기 · 비교)이 이 값에서 나온다. */
  state: z.enum(CATEGORY_PICK_STATES),
  /** 담아둔 후보 수. 상태를 다시 계산하려는 화면이 없도록 함께 내려준다. */
  pickCount: z.int().nonnegative(),
  /** 최대 3곳. 자료가 모자라면 그만큼만 — 억지로 채우지 않는다. */
  vendors: z.array(vendorSummarySchema).max(RECOMMEND_VENDORS_PER_CATEGORY),
});

export const categoryRecommendationsResponseSchema = z.object({
  /**
   * 노출 순서 그대로다(사양 §11 — COMPARING → SHORTLISTED → NOT_STARTED, 동순위는 준비 순서).
   * **정한 업종(`DECIDED`)과 안 하기로 한 업종(`SKIPPED`)은 들어오지 않는다.**
   */
  groups: z.array(categoryRecommendationSchema),
  /**
   * 아직 정하지 않은 업종이 모두 몇 개인가. `groups`가 잘려 와도 홈이 「아직 결정하지 않은
   * 준비가 N개 있어요」를 정확히 적을 수 있어야 한다 — 보이는 수로 세면 늘 3이 된다.
   */
  remaining: z.int().nonnegative(),
  /** 홈이 「스튜디오 · 메이크업 …」을 적을 때 쓰는, 안 보이는 것까지 포함한 전체 순서. */
  remainingCategories: z.array(vendorCategorySchema),
});

export type CategoryRecommendation = z.infer<typeof categoryRecommendationSchema>;
export type CategoryRecommendationsResponse = z.infer<typeof categoryRecommendationsResponseSchema>;
