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
  note: z.string().optional(),
});

export const contractTermSchema = z.object({
  id: idSchema,
  category: z.enum(['cancellation', 'refund', 'penalty', 'schedule', 'other']),
  body: z.string().min(1),
  flagged: z.boolean(),
});

export const quoteSchema = z.object({
  id: idSchema,
  weddingId: idSchema,
  docType: documentTypeSchema,
  vendor: z.object({ id: idSchema, name: z.string() }).nullable(),
  planner: z.object({ id: idSchema, name: z.string() }).nullable(),
  productName: z.string().nullable(),
  totalAmount: amountSchema.nullable(),
  discountAmount: amountSchema.nullable(),
  contractDate: dateSchema.nullable(),
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

export type ExtractionField = z.infer<typeof extractionFieldSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type ConfirmFieldsRequest = z.infer<typeof confirmFieldsRequestSchema>;
export type QuoteListResponse = z.infer<typeof quoteListResponseSchema>;
