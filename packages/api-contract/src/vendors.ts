import { z } from 'zod';

import { reportedPriceSchema } from './price-reports';

import { MAX_COMPARED_VENDORS } from '@weddingpick/domain';

import { documentTypeSchema, idSchema, vendorCategorySchema } from './common';
import { priceStatSchema } from './comparison';

/**
 * A-16 검색 결과 한 줄.
 *
 * 별점도 후기도 없다. 우리가 아는 것은 이 업체가 있다는 사실과, 확인된 계약이 몇 건
 * 모였는지뿐이다. 모르는 것을 아는 척하지 않는다.
 */
export const vendorSummarySchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  category: vendorCategorySchema,
  region: z.string().min(1),
  /** 공공데이터에서 온 업체면 출처 문장. 서버가 만들어 내려준다. */
  sourceNote: z.string().nullable(),
  /**
   * 가격 비교에 쓸 수 있는 계약이 몇 건 모였는지.
   *
   * 0이어도 숨기지 않는다 — "아직 자료가 없다"는 것도 사용자가 알아야 할 사실이다.
   * L2 이상이고 사용자 확인을 마친 문서만 센다.
   */
  comparableQuoteCount: z.int().nonnegative(),
});

export const vendorSearchResponseSchema = z.object({
  vendors: z.array(vendorSummarySchema),
  /** 다음 쪽. 없으면 null. */
  nextCursor: z.string().nullable(),
});

/** 지역 필터에 쓸 시도 목록. 자료에 실제로 있는 것만 내려간다. */
export const vendorRegionsResponseSchema = z.object({
  regions: z.array(z.object({ name: z.string().min(1), vendorCount: z.int().positive() })),
});

/**
 * 업체별 가격 분포 한 줄.
 *
 * 표본이 기준에 못 미치는 상품은 아예 들어오지 않는다 — 중앙값 없이 상품 이름만
 * 늘어놓으면 화면이 "가격 0원"으로 그릴 여지가 생긴다.
 */
export const vendorProductStatSchema = z.object({
  /** 사람이 읽는 상품 이름. 내부 키를 그대로 내보내지 않는다. */
  productLabel: z.string().min(1),
  docType: documentTypeSchema,
  stat: priceStatSchema,
});

export const vendorDetailSchema = vendorSummarySchema.extend({
  lastVerifiedAt: z.string().min(1),
  /** 가격을 보여줄 수 있는 상품들. 비어 있으면 아직 자료가 모이지 않았다는 뜻이다. */
  products: z.array(vendorProductStatSchema),
  /**
   * 이용자가 문서 없이 적어준 금액.
   *
   * `products`와 **다른 자리에 둔다.** 하나로 합치지 않는 것이 규칙이라
   * 계약에서부터 갈라놓는다 — 같은 배열에 넣으면 화면이 둘을 헷갈리고,
   * 헷갈리면 섞여 나간다(서비스정책서 2번).
   */
  reportedPrice: reportedPriceSchema,
});

/**
 * A-17 업체 비교. 최대 세 곳.
 *
 * 단서(caveats)는 결과와 한 객체로 나간다. 떼어놓을 수 있게 두면 화면이 표만 그리고
 * "금액만으로는 비교할 수 없다"는 말을 빠뜨릴 수 있다 — 사업계획서 2번이 꼽은
 * "비교의 어려움"을 우리가 만든 표가 되레 가리게 된다.
 */
export const vendorComparisonResponseSchema = z.object({
  vendors: z.array(vendorDetailSchema).min(2).max(MAX_COMPARED_VENDORS),
  caveats: z.array(z.string().min(1)).min(1),
});

export type VendorSummary = z.infer<typeof vendorSummarySchema>;
export type VendorComparisonResponse = z.infer<typeof vendorComparisonResponseSchema>;
export type VendorSearchResponse = z.infer<typeof vendorSearchResponseSchema>;
export type VendorRegionsResponse = z.infer<typeof vendorRegionsResponseSchema>;
export type VendorProductStat = z.infer<typeof vendorProductStatSchema>;
export type VendorDetail = z.infer<typeof vendorDetailSchema>;
