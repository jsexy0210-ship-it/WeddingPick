import { z } from 'zod';

import { idSchema, timestampSchema, verificationLevelSchema } from './common';

/**
 * 인증 신청. 올릴 수 있는 증빙 종류는 목표 등급에 따라 다르다.
 * 서비스정책서 2번.
 */
export const verificationEvidenceKindSchema = z.enum([
  'quote_document',
  'contract_document',
  'payment_receipt',
  'usage_proof',
]);

export const createVerificationRequestSchema = z.object({
  targetLevel: z.enum(['L1', 'L2', 'L3', 'L4']),
  evidence: z
    .array(
      z.object({
        kind: verificationEvidenceKindSchema,
        rawDocumentId: idSchema,
      })
    )
    .min(1),
});

/**
 * 접수 응답.
 *
 * 서비스정책서 7번이 자동승인을 금지한다. 그래서 접수 응답에는 'received'밖에 없다 —
 * 서버가 실수로 즉시 승인을 내려보내도 이 계약을 통과하지 못한다.
 */
export const createVerificationResponseSchema = z.object({
  requestId: idSchema,
  status: z.literal('received'),
  receivedAt: timestampSchema,
});

/** 심사 결과 조회. 승인은 여기서만 나온다. */
export const verificationRequestSchema = z.object({
  requestId: idSchema,
  quoteId: idSchema,
  targetLevel: verificationLevelSchema,
  status: z.enum(['received', 'in_review', 'needs_supplement', 'approved', 'rejected']),
  receivedAt: timestampSchema,
  decidedAt: timestampSchema.nullable(),
  /** 반려 사유. 승인이면 없다. */
  rejectionReason: z.string().optional(),
  /** 보완 요청 사유. needs_supplement 상태일 때만 있다. */
  supplementReason: z.string().optional(),
});

export type CreateVerificationRequest = z.infer<typeof createVerificationRequestSchema>;
export type CreateVerificationResponse = z.infer<typeof createVerificationResponseSchema>;
export type VerificationRequest = z.infer<typeof verificationRequestSchema>;
