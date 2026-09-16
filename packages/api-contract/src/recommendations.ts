import { z } from 'zod';

import { CATEGORY_PICK_STATES, RECOMMEND_VENDORS_PER_CATEGORY, TOP3_REASONS } from '@weddingpick/domain';

import { idSchema, vendorCategorySchema } from './common';
import { paidPriceSchema } from './payment-proofs';
import { guidePriceSchema, vendorSummarySchema, weddingStyleSchema } from './vendors';

/**
 * TOP3 추천. 통합정책 v3.10 §2.
 *
 * 한 줄의 위계는 정책이 정했다(v3.10 디자인 §): `대표 이미지 → 추천 이유 →
 * 업체명 → 핵심 조건 → 실제 결제 데이터 → 현재 혜택 → Pick`.
 *
 * **혜택 칸은 없다.** 아직 우리가 가진 자료가 아니다. 칸을 미리 뚫어두고 늘
 * null을 채워 보내면 화면은 그 칸을 그리려 들고, 그러다 빈 회색 자리가 남는다
 * (정책이 금지한 그 화면이다). 이미지 칸은 vendor_images가 생기면서 열었다
 * (2026-09-08) — 없으면 카테고리 기본으로 대체한다.
 */
export const top3ReasonSchema = z.enum(TOP3_REASONS);

export const top3ItemSchema = z.object({
  vendorId: idSchema,
  name: z.string().min(1),
  category: vendorCategorySchema,
  region: z.string().min(1),
  /** 승인된 대표 이미지. 없으면 null — 카테고리 기본으로 대체한다. */
  imageUrl: z.string().nullable(),
  /**
   * 왜 이 곳인지. **비어 있을 수 없다.**
   *
   * 이유 없는 추천을 계약이 표현할 수 없게 만든다 — 서버가 이유를 못 찾으면
   * 그 업체를 빼는 것 말고 다른 길이 없다.
   */
  reasons: z.array(top3ReasonSchema).min(1),
  /** 실 제보 건수. 추천 자격의 근거라 그대로 내려준다. */
  confirmedCount: z.int().nonnegative(),
  /** 실제 결제. 공개 사다리를 그대로 쓴다 — 검색·상세와 같은 값이어야 한다. */
  paidPrice: paidPriceSchema,
  /** 업체 스타일 태그(v3.22). 고른 것과 겹치는 것만 화면이 coral로 켠다. */
  styleTags: z.array(weddingStyleSchema),
  /** 업체 안내 가격(정보 0층). 실 제보 3건 미만이면 이것으로 금액 자리를 채운다. */
  guidePrice: guidePriceSchema.nullable(),
});

export const top3ResponseSchema = z.object({
  /** 무엇을 기준으로 고른 것인지. 화면이 "서울 · 웨딩홀"처럼 적는다. */
  region: z.string().nullable(),
  category: vendorCategorySchema,
  /** 최대 세 곳. 자료가 모자라면 그만큼만 — 억지로 채우지 않는다. */
  items: z.array(top3ItemSchema).max(3),
  /**
   * 세 곳을 못 채웠으면 그 사실을 적은 한 줄. 다 채웠으면 null.
   *
   * 빈자리를 설명하지 않으면 읽는 사람은 무언가 빠졌다고 느낀다.
   */
  note: z.string().nullable(),
});

/**
 * 무엇을 기준으로 고를지. 둘 다 선택이다.
 *
 * 지역을 받는 이유: 지연 로그인이라 로그인 전에도 홈이 뜬다. 그때 지역은
 * 서버가 아니라 기기에 적혀 있다(최소 온보딩 초안). 로그인한 사람은 안 보내면
 * 서버가 자기 웨딩에서 읽는다.
 */
export const top3QuerySchema = z.object({
  region: z.string().trim().min(1).optional(),
  category: vendorCategorySchema.optional(),
});

export type Top3Query = z.infer<typeof top3QuerySchema>;
export type Top3Item = z.infer<typeof top3ItemSchema>;
export type Top3Response = z.infer<typeof top3ResponseSchema>;

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
