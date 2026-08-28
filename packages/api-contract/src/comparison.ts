import { z } from 'zod';

import { amountSchema, dateSchema, documentTypeSchema, verificationLevelSchema } from './common';

export const priceJudgementSchema = z.enum(['low', 'similar', 'somewhat_high', 'high']);

/**
 * 가격 분포. 표본 수와 기준 기간이 함께 들어 있다.
 *
 * 사업계획서 9번이 이 셋을 항상 같이 보이라고 해서 한 객체로 묶었다. 중앙값만 떼어
 * 보내는 응답은 이 계약에 없다.
 */
export const priceStatSchema = z.object({
  sampleCount: z.int().positive(),
  periodStart: dateSchema,
  periodEnd: dateSchema,
  median: amountSchema,
  p25: amountSchema,
  p75: amountSchema,
  p90: amountSchema,
  minVerificationLevel: verificationLevelSchema,
});

/** 비교할 수 없는 이유. 값을 지어내는 대신 이유를 보낸다. */
export const comparisonUnavailableReasonSchema = z.enum([
  /** 인증된 계약 표본이 기준에 못 미친다. 사업계획서 9번, 제품 원칙 2. */
  'not_enough_samples',
  /** 어느 업체 것인지 확정되지 않았다 */
  'vendor_unknown',
  /** 무엇과 견줄지 정할 수 없다 */
  'product_unknown',
  /** 금액을 읽지 못했거나 사용자 확인 전이다 */
  'amount_unconfirmed',
]);

/**
 * A-09 가격 비교 응답.
 *
 * 비교 가능한 경우에만 stat과 judgement가 있다. 둘 다 없는 응답에는 이유가 반드시 붙는다 —
 * 화면이 "표본 부족"을 빈 가격으로 잘못 그릴 수 없다.
 */
export const comparisonResponseSchema = z.discriminatedUnion('available', [
  z.object({
    available: z.literal(true),
    docType: documentTypeSchema,
    myAmount: amountSchema,
    stat: priceStatSchema,
    judgement: priceJudgementSchema,
  }),
  z.object({
    available: z.literal(false),
    docType: documentTypeSchema,
    reason: comparisonUnavailableReasonSchema,
    /** 표본이 부족한 경우 지금까지 모인 수. 이유를 구체적으로 보여줄 때 쓴다. */
    sampleCount: z.int().nonnegative().optional(),
  }),
]);

export type PriceStat = z.infer<typeof priceStatSchema>;
export type ComparisonResponse = z.infer<typeof comparisonResponseSchema>;
