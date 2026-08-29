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
 * 업체의 가격.
 *
 * **잠기지 않는다.** 최종통합정책 v2.0 K-6이 "결제인증 회원만 실제 결제 데이터
 * 접근"을 폐기했다 — 실제 결제 구간은 비회원도 본다. 무엇을 보여줄지는 이제
 * 사람이 아니라 **데이터 수**가 정한다(`paidPrice`의 4단계).
 *
 * 결제인증이 여는 것은 접근이 아니라 **깊이**다 — 조건이 비슷한 사례와 상세 분석
 * (`deepData`).
 *
 * 세 가격이 한 자리에 있지만 **셋은 서로 다른 숫자다.** 근거가 다르다:
 * 사람이 심사한 계약(products), 기계가 읽은 결제내역(paidPrice), 그냥 적어준
 * 숫자(reportedPrice). 배열 하나로 합치지 않는 이유다.
 */
export const vendorPricesSchema = z.object({
  /** 계약 중앙값. 사람이 심사한 L2 이상 문서에서만 나온다. */
  products: z.array(vendorProductStatSchema),
  /** 이용자가 올린 결제내역에서 읽은 금액. 심사가 아니라 등록이다. */
  paidPrice: paidPriceSchema,
  /** 문서 없이 적어준 금액. */
  reportedPrice: reportedPriceSchema,
  /**
   * 조건이 비슷한 사례를 볼 수 있는가. 결제내역을 한 건이라도 등록했으면 열린다.
   *
   * 구간을 가리지 않는다 — 여기서 갈리는 것은 상세 분석뿐이다.
   */
  deepData: z.boolean(),
  /** 아직 열리지 않았으면 어떻게 열리는지. 열려 있으면 null. */
  deepDataNote: z.string().nullable(),
});

export const vendorDetailSchema = vendorSummarySchema.extend({
  lastVerifiedAt: z.string().min(1),
  prices: vendorPricesSchema,
  /** 이용점수. 확인된 후기만 들어간다. */
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
