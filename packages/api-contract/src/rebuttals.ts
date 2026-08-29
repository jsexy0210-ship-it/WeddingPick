import { MIN_REBUTTAL_BODY_LENGTH, REBUTTAL_STATUSES } from '@weddingpick/domain';
import { z } from 'zod';

import { idSchema, timestampSchema } from './common';

/**
 * 내가 낸 반론 한 줄.
 *
 * 원본 후기가 함께 온다. 반론만 목록에 세우면 무엇에 대한 답인지 알 수 없고,
 * 핸드오프도 "원본 후기 카드 안에 반론 블록이 붙은 실제 게시 형태"로 보여달라고
 * 적었다 — 게시되면 어떻게 보일지를 미리 보는 것이 요점이다.
 */
export const myRebuttalSchema = z.object({
  id: idSchema,
  status: z.enum(REBUTTAL_STATUSES),
  statusLabel: z.string().min(1),
  statusNote: z.string().min(1),
  claimedRole: z.string().min(1),
  body: z.string().min(1),
  /** 게시하지 않기로 한 이유. 사람이 적는다. */
  decisionNote: z.string().nullable(),
  createdAt: timestampSchema,

  review: z.object({
    id: idSchema,
    vendorId: idSchema,
    vendorName: z.string().min(1),
    title: z.string().min(1),
    body: z.string().min(1),
    overall: z.int().min(1).max(5),
    createdAt: timestampSchema,
  }),
});

export const createRebuttalRequestSchema = z.object({
  reviewId: idSchema,
  /** 업체와 어떤 관계인지 본인이 밝힌 말. 우리는 아직 확인하지 않았다. */
  claimedRole: z.string().trim().min(1).max(60),
  body: z.string().trim().min(MIN_REBUTTAL_BODY_LENGTH),
});

export const updateRebuttalRequestSchema = z.object({
  claimedRole: z.string().trim().min(1).max(60),
  body: z.string().trim().min(MIN_REBUTTAL_BODY_LENGTH),
});

export const rebuttalListResponseSchema = z.object({
  rebuttals: z.array(myRebuttalSchema),
});

export type MyRebuttal = z.infer<typeof myRebuttalSchema>;
export type CreateRebuttalRequest = z.infer<typeof createRebuttalRequestSchema>;
export type UpdateRebuttalRequest = z.infer<typeof updateRebuttalRequestSchema>;
export type RebuttalListResponse = z.infer<typeof rebuttalListResponseSchema>;
