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
  /** 이 응답을 받는 사람 자신인지. 이름 대신 이걸로 구분한다. */
  isMe: z.boolean(),
});

export const weddingDetailSchema = weddingSchema.extend({
  members: z.array(weddingMemberSchema).min(1).max(2),
});

/** 아직 웨딩이 없는 계정이 하나 만든다. 날짜는 나중에 정해도 된다. */
export const createWeddingRequestSchema = z.object({
  weddingDate: dateSchema.nullable().optional(),
});

export const currentUserSchema = z.object({
  userId: idSchema,
  weddingId: idSchema.nullable(),
});

/**
 * A-18 배우자 초대.
 *
 * `code`는 만들 때 한 번만 내려온다. 서버는 해시만 들고 있어 다시 보여줄 수 없다 —
 * 세션 토큰과 같다.
 */
export const createInviteResponseSchema = z.object({
  inviteId: idSchema,
  code: z.string().min(1),
  expiresAt: timestampSchema,
  /** 초대받은 사람이 볼 안내. 무엇이 공유되고 무엇이 안 되는지. */
  shared: z.array(z.string().min(1)).min(1),
  notShared: z.array(z.string().min(1)).min(1),
});

/** 지금 살아 있는 초대. 코드는 들어 있지 않다. */
export const weddingInviteSchema = z.object({
  inviteId: idSchema,
  expiresAt: timestampSchema,
  createdAt: timestampSchema,
});

export const weddingInviteListResponseSchema = z.object({
  invite: weddingInviteSchema.nullable(),
});

/**
 * 초대 미리보기.
 *
 * 받아들이기 전에 무엇에 동의하는지 본다 — 동의는 무엇에 동의하는지 알 때만 동의다.
 * 초대한 사람이 누구인지는 알려주지 않는다. 이름을 알려주려면 그 사람의 개인정보를
 * 꺼내야 하고, 링크를 가진 사람이 늘 배우자인 것도 아니다.
 */
export const invitePreviewResponseSchema = z.discriminatedUnion('usable', [
  z.object({
    usable: z.literal(true),
    expiresAt: timestampSchema,
    shared: z.array(z.string().min(1)).min(1),
    notShared: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    usable: z.literal(false),
    /** 왜 쓸 수 없는지. 값을 지어내는 대신 이유를 보낸다. */
    reason: z.enum(['expired', 'revoked', 'accepted', 'already_linked', 'not_found']),
    message: z.string().min(1),
  }),
]);

export const acceptInviteRequestSchema = z.object({
  code: z.string().trim().min(1).max(200),
});

export type Wedding = z.infer<typeof weddingSchema>;
export type CreateInviteResponse = z.infer<typeof createInviteResponseSchema>;
export type WeddingInvite = z.infer<typeof weddingInviteSchema>;
export type WeddingInviteListResponse = z.infer<typeof weddingInviteListResponseSchema>;
export type InvitePreviewResponse = z.infer<typeof invitePreviewResponseSchema>;
export type AcceptInviteRequest = z.infer<typeof acceptInviteRequestSchema>;
export type WeddingDetail = z.infer<typeof weddingDetailSchema>;
export type CreateWeddingRequest = z.infer<typeof createWeddingRequestSchema>;
export type CurrentUser = z.infer<typeof currentUserSchema>;
