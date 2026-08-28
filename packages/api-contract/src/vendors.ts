import { z } from 'zod';

import { paidPriceSchema } from './payment-proofs';
import { reportedPriceSchema } from './price-reports';
import { usageScoreSchema } from './reviews';

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

/**
 * 업체의 가격. **사업계획서 v3 7번 Level 3.**
 *
 * 자료를 내놓은 사람이 자료를 본다. 결제인증 제보가 한 건도 없으면 잠긴 채로
 * 내려가고, 화면은 잠긴 것을 그릴 수밖에 없다 — 잠금을 **판별 유니온**으로 둔
 * 이유가 이것이다. 필드를 그냥 비워 보내면 화면이 "0원"이나 빈칸을 그릴 여지가
 * 남고, 언젠가 어느 화면이 그렇게 그린다.
 *
 * 세 가격이 한 자리에 있지만 **셋은 서로 다른 숫자다.** 근거가 다르다:
 * 사람이 심사한 계약(products), 기계가 읽은 결제내역(paidPrice), 그냥 적어준
 * 숫자(reportedPrice). 배열 하나로 합치지 않는 이유다.
 */
export const vendorPricesSchema = z.discriminatedUnion('available', [
  z.object({
    available: z.literal(true),
    /** 계약 중앙값. 사람이 심사한 L2 이상 문서에서만 나온다. */
    products: z.array(vendorProductStatSchema),
    /** 이용자가 올린 결제내역에서 읽은 금액. 심사가 아니라 등록이다. */
    paidPrice: paidPriceSchema,
    /** 문서 없이 적어준 금액. */
    reportedPrice: reportedPriceSchema,
  }),
  z.object({
    available: z.literal('locked'),
    /** 잠긴 채로도 몇 건이 모였는지는 말한다. 빈 곳인지 잠긴 곳인지 알려야 한다. */
    productCount: z.int().nonnegative(),
    /** 어떻게 하면 열리는지. 잠갔다고만 하고 방법을 말하지 않으면 파는 것처럼 보인다. */
    requirement: z.string().min(1),
  }),
]);

export const vendorDetailSchema = vendorSummarySchema.extend({
  lastVerifiedAt: z.string().min(1),
  prices: vendorPricesSchema,
  /**
   * 이용점수. 확인된 후기만 들어간다.
   *
   * **잠기지 않는다.** Level 1이 후기와 이용점수를 본다(사업계획서 v3 7번) —
   * 잠기는 것은 가격뿐이다.
   */
  usageScore: usageScoreSchema,
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
export type VendorPrices = z.infer<typeof vendorPricesSchema>;
export type VendorDetail = z.infer<typeof vendorDetailSchema>;
