import { z } from 'zod';

import {
  amountSchema,
  dateSchema,
  documentTypeSchema,
  idSchema,
  sourceTypeSchema,
  timestampSchema,
  verificationLevelSchema,
} from './common';

/**
 * AI가 뽑은 값 하나. 신뢰도 없이는 보낼 수 없다.
 *
 * 신뢰도가 낮은 항목을 숨기지 않고 "확인 필요"로 드러내려면 화면이 신뢰도를 알아야 한다.
 * 서비스정책서 1번.
 */
export const extractionFieldSchema = z.object({
  path: z.string().min(1),
  value: z.string(),
  confidence: z.number().min(0).max(1),
  /** 계약금액·계약일·환불조건은 항상 true다. 서버가 정하고 앱은 따른다. */
  requiresConfirmation: z.boolean(),
  confirmedByUser: z.boolean(),
  correctedValue: z.string().optional(),
});

export const quoteLineItemSchema = z.object({
  id: idSchema,
  kind: z.enum(['included', 'excluded', 'additional_candidate']),
  label: z.string().min(1),
  amount: amountSchema.nullable(),
  /** 금액이 범위로 적혀 있을 때. */
  amountMin: amountSchema.nullable(),
  amountMax: amountSchema.nullable(),
  note: z.string().optional(),
  /**
   * 공개된 소비자 보호 기준과 견준 결과. 서버가 계산해 문장으로 내려준다.
   * 법률 판단이 아니라 확인해볼 거리다 (이용약관 제3조, 사업계획서 8번).
   */
  standardNote: z.string().nullable(),
});

export const contractTermSchema = z.object({
  id: idSchema,
  category: z.enum(['cancellation', 'refund', 'penalty', 'schedule', 'other']),
  body: z.string().min(1),
  flagged: z.boolean(),
  /** 조항이 적용되는 시점(예식일까지 남은 날)과 총액 대비 비율. 읽어내지 못하면 null. */
  daysBeforeWedding: z.int().nonnegative().nullable(),
  penaltyRate: z.number().min(0).max(1).nullable(),
  /** 공개 기준과 견준 결과. 기준 안이면 null. */
  standardNote: z.string().nullable(),
});

export const quoteSubVendorSchema = z.object({
  role: z.enum(['studio', 'dress', 'makeup', 'planning', 'snap', 'other']),
  name: z.string().min(1),
  amount: amountSchema.nullable(),
  /** 업체로 연결됐는지. 연결돼야 그 업체 기준으로 비교할 수 있다. */
  matched: z.boolean(),
});

/**
 * 문서에 붙은 업체.
 *
 * 업체 정보를 공공데이터에서 가져왔다면 출처를 밝혀야 한다. 공공누리는 유형과 무관하게
 * 출처 표시를 요구한다. 앱이 코드로 판단하지 않도록 서버가 한글 문장으로 만들어 내려준다.
 */
export const quoteVendorSchema = z.object({
  id: idSchema,
  name: z.string(),
  /** 예: "행정안전부 지방행정 인허가 데이터 (2026-08-28 확인)". 사용자가 올린 문서에서만 온 업체면 null. */
  sourceNote: z.string().nullable(),
});

export const quoteSchema = z.object({
  id: idSchema,
  weddingId: idSchema,
  docType: documentTypeSchema,
  vendor: quoteVendorSchema.nullable(),
  planner: z.object({ id: idSchema, name: z.string() }).nullable(),
  productName: z.string().nullable(),
  totalAmount: amountSchema.nullable(),
  discountAmount: amountSchema.nullable(),
  contractDate: dateSchema.nullable(),
  weddingDate: dateSchema.nullable(),
  depositAmount: amountSchema.nullable(),
  balanceAmount: amountSchema.nullable(),
  /** 웨딩홀 견적에만 있다. */
  hallName: z.string().nullable(),
  guaranteedGuests: z.int().positive().nullable(),
  mealPricePerPerson: amountSchema.nullable(),
  /** 스드메처럼 업체가 여럿인 패키지의 개별 업체. */
  subVendors: z.array(quoteSubVendorSchema),
  verificationLevel: verificationLevelSchema,
  source: sourceTypeSchema,
  lineItems: z.array(quoteLineItemSchema),
  terms: z.array(contractTermSchema),
  extractionFields: z.array(extractionFieldSchema),
  createdAt: timestampSchema,
  /** 핵심 필드 확인을 마친 시각. null이면 비교·통계에 쓰이지 않는다. */
  confirmedAt: timestampSchema.nullable(),
});

/**
 * 사용자 확인. 값을 고쳤으면 correctedValue를 함께 보낸다.
 * 확인하지 않은 채 "확인함"으로 보낼 방법은 없다.
 */
export const confirmFieldsRequestSchema = z.object({
  fields: z
    .array(
      z.object({
        path: z.string().min(1),
        correctedValue: z.string().optional(),
      })
    )
    .min(1),
});

export const quoteListResponseSchema = z.object({
  quotes: z.array(quoteSchema),
  nextCursor: z.string().nullable(),
});

export type QuoteVendor = z.infer<typeof quoteVendorSchema>;
export type ExtractionField = z.infer<typeof extractionFieldSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type ConfirmFieldsRequest = z.infer<typeof confirmFieldsRequestSchema>;
export type QuoteListResponse = z.infer<typeof quoteListResponseSchema>;
