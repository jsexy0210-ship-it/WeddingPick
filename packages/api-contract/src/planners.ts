import { z } from 'zod';

import { idSchema, sourceTypeSchema } from './common';
import { vendorProductStatSchema } from './vendors';

/**
 * A-16 플래너 검색 결과 한 줄.
 *
 * 검색에 나오는 플래너는 공개 근거가 있는 사람뿐이다. 그 근거를 응답에 함께 담아
 * 화면이 "왜 여기 있는지"를 적을 수 있게 한다 — 개인 이름을 목록에 싣고 이유를
 * 적지 않으면, 본인도 다른 사람도 그것을 따져볼 방법이 없다.
 */
export const plannerSummarySchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  /** 소속 업체. 프리랜서면 없다 — 플래너는 업체 부속정보가 아니다 (사업계획서 11번). */
  vendor: z.object({ id: idSchema, name: z.string().min(1) }).nullable(),
  /** 활동 지역. 시도까지만 담는다. */
  regions: z.array(z.string().min(1)),
  /**
   * 왜 검색에 나오는지. 서버가 만든 한글 문장이다.
   *
   * nullable이 아니다 — 근거 없이 목록에 오를 수 있는 길을 계약에서 없앤다.
   */
  listingBasis: z.string().min(1),
  /** 공개 근거의 출처. AI 추출은 여기 올 수 없다. */
  listingSource: sourceTypeSchema.extract(['public_data', 'vendor_official']),
  comparableQuoteCount: z.int().nonnegative(),
});

export const plannerSearchResponseSchema = z.object({
  planners: z.array(plannerSummarySchema),
  nextCursor: z.string().nullable(),
  /** 노출 중단 안내. 검색 결과에 늘 함께 나간다. */
  withdrawalNotice: z.string().min(1),
});

/** 지역 필터에 쓸 시도 목록. 검색에 나오는 플래너가 실제로 활동하는 곳만 내려간다. */
export const plannerRegionsResponseSchema = z.object({
  regions: z.array(z.object({ name: z.string().min(1), plannerCount: z.int().positive() })),
});

export const plannerDetailSchema = plannerSummarySchema.extend({
  /** 이 플래너를 통한 계약 가운데 표본이 모인 상품. 업체 상세와 같은 규칙을 쓴다. */
  products: z.array(vendorProductStatSchema),
  withdrawalNotice: z.string().min(1),
});

export type PlannerSummary = z.infer<typeof plannerSummarySchema>;
export type PlannerSearchResponse = z.infer<typeof plannerSearchResponseSchema>;
export type PlannerRegionsResponse = z.infer<typeof plannerRegionsResponseSchema>;
export type PlannerDetail = z.infer<typeof plannerDetailSchema>;
