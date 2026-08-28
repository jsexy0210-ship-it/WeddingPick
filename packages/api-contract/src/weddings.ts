import { z } from 'zod';

import { dateSchema, idSchema, timestampSchema } from './common';

export const weddingSchema = z.object({
  id: idSchema,
  weddingDate: dateSchema.nullable(),
  /** 배우자 연결 전에는 null. 연결 후 "우리 웨딩"이 된다. 사업계획서 12번. */
  partnerLinked: z.boolean(),
  createdAt: timestampSchema,
});

/**
 * 원본 계약서와 개인정보는 배우자 연결 시에도 자동 공유하지 않는다(이용약관 제5조).
 * 그래서 이 응답에는 상대방의 개인정보가 들어갈 자리가 없다.
 */
export const weddingMemberSchema = z.object({
  role: z.enum(['owner', 'partner']),
  joinedAt: timestampSchema,
});

export const weddingDetailSchema = weddingSchema.extend({
  members: z.array(weddingMemberSchema).min(1).max(2),
});

export const currentUserSchema = z.object({
  userId: idSchema,
  weddingId: idSchema.nullable(),
});

export type Wedding = z.infer<typeof weddingSchema>;
export type WeddingDetail = z.infer<typeof weddingDetailSchema>;
export type CurrentUser = z.infer<typeof currentUserSchema>;
