import { MAX_DISPLAY_NAME_LENGTH, MEMBER_TIERS } from '@weddingpick/domain';
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
  /** 부를 이름. 아직 안 정했으면 null. */
  displayName: z.string().nullable(),
  /** 예식일. 아직 안 정했으면 null. */
  weddingDate: dateSchema.nullable(),
  /**
   * 처음 설정을 마쳤는가. 이름과 예식일이 둘 다 있어야 한다.
   *
   * **앱이 이 값으로 첫 화면을 정한다.** 두 값을 따로 보고 판단하게 두면 어느
   * 화면은 이름만 보고, 어느 화면은 날짜만 보게 된다.
   */
  setupComplete: z.boolean(),

  /** 배우자가 연결돼 있는가. 등급과 미션이 이 값을 본다. */
  spouseLinked: z.boolean(),
  /** 업체가 매칭된 결제인증이 있는가. Level 3 Unlock과 같은 조건이다. */
  hasPaymentProof: z.boolean(),
  /** 한 곳이라도 Pick했는가. 미션 ②가 본다. */
  hasPick: z.boolean(),
  /**
   * 한 업종이라도 비교해봤는가. 미션 ③이 본다.
   *
   * 비교할 수 있는 상태가 아니라 **비교한 사실**이다 — 후보 두 곳을 담았다고
   * 비교한 것은 아니다.
   */
  hasCompared: z.boolean(),
  /**
   * 지금 등급. 서버가 정한다.
   *
   * 앱이 세 값으로 계산하게 두면, 화면마다 조건을 다시 적게 되고 언젠가 한 곳이
   * 어긋난다 — 그러면 같은 사람이 화면에 따라 다른 등급으로 보인다.
   */
  tier: z.enum(MEMBER_TIERS),
  tierLabel: z.string().min(1),
});

/**
 * 이름·예식일 등록. 핸드오프 2번 — **스킵할 수 없는 화면**이다.
 *
 * 둘을 한 번에 받는다. 따로 받으면 이름만 넣고 나간 사람이 생기고, 그 사람의 홈은
 * 이름은 부르는데 D-Day가 없는 반쪽이 된다.
 */
export const completeSetupRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(MAX_DISPLAY_NAME_LENGTH),
  weddingDate: dateSchema,
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
export type CompleteSetupRequest = z.infer<typeof completeSetupRequestSchema>;
