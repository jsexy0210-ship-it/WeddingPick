import { z } from 'zod';

import { amountSchema, idSchema } from './common';

/**
 * 가격 제보.
 *
 * 문서 없이 받는 값이라, 응답에서도 **계약 중앙값과 다른 이름을 쓴다.**
 * 같은 필드 이름을 쓰면 화면이 둘을 헷갈리고, 헷갈리면 섞여 나간다.
 */
export const createPriceReportRequestSchema = z.object({
  vendorId: idSchema,
  /** 같은 업체라도 상품마다 가격이 다르다. */
  productName: z.string().trim().min(1).max(120),
  totalAmount: amountSchema,
  /** 계약한 연월. 가격은 시점에 따라 달라진다. */
  contractedOn: z.string().regex(/^\d{4}-\d{2}$/),
  guaranteedGuests: z.int().positive().max(2000).optional(),
  mealPricePerPerson: amountSchema.optional(),
  includedNote: z.string().trim().max(500).optional(),
});

export const createPriceReportResponseSchema = z.object({
  reportId: idSchema,
  /** 제보가 무엇인지 화면이 그대로 보여줄 문구. */
  caveat: z.string().min(1),
});

/**
 * 업체의 제보 요약.
 *
 * 계약 중앙값(`stat`)과 **나란히** 내려간다. 하나로 합치지 않는다 —
 * 서비스정책서 2번은 시장 대표가격의 근거를 L2 이상으로 못박았고, 제보는
 * 그 근거를 갖지 못한다.
 */
export const reportedPriceSchema = z.discriminatedUnion('available', [
  z.object({
    available: z.literal(true),
    median: amountSchema,
    count: z.int().positive(),
    /** YYYY-MM */
    periodStart: z.string(),
    periodEnd: z.string(),
    caveat: z.string().min(1),
  }),
  z.object({
    available: z.literal(false),
    /** 왜 보여주지 않는지. 빈 화면 대신 이유를 준다. */
    reason: z.string().min(1),
    count: z.int().nonnegative(),
  }),
]);

export type CreatePriceReportRequest = z.infer<typeof createPriceReportRequestSchema>;
export type CreatePriceReportResponse = z.infer<typeof createPriceReportResponseSchema>;
export type ReportedPrice = z.infer<typeof reportedPriceSchema>;
