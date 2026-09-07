import { MAX_DISPLAY_NAME_LENGTH, MEMBER_TIERS, WEDDING_BUDGET_BRACKETS } from '@weddingpick/domain';
import { z } from 'zod';

import { dateSchema, idSchema, timestampSchema } from './common';

/** 온보딩 3/4 예산 스텝. 핸드오프가 정한 다섯 구간 중 하나 — 자유 입력이 아니다. */
export const budgetBracketSchema = z.enum(WEDDING_BUDGET_BRACKETS);

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
  /** 준비 지역. 아직 안 골랐으면 null. 업체 지역 목록과 같은 문자열이다. */
  region: z.string().nullable(),
  /**
   * 총예산 구간. 온보딩 3/4에서 고른 값 그대로다. 아직 안 골랐으면 null.
   *
   * `budgetAmount`는 top3 추천이 숫자로 비교하려고 이 값에서 서버가 파생한 것이다
   * (packages/domain budgetBracketCeiling) — 화면에 보여줄 값은 이 필드를 쓴다.
   */
  budgetBracket: budgetBracketSchema.nullable(),
  /** budgetBracket에서 서버가 파생한 상한값. 화면 표시용이 아니라 추천 로직용이다. */
  budgetAmount: z.int().positive().nullable(),
  /**
   * 최소 온보딩을 마쳤는가. **예식일과 지역**이 둘 다 있어야 한다(v3.10 §3).
   *
   * **앱이 이 값으로 첫 화면을 정한다.** 두 값을 따로 보고 판단하게 두면 어느
   * 화면은 날짜만 보고, 어느 화면은 지역만 보게 된다. 이름은 여기 들어가지
   * 않는다 — 이름이 없다고 첫 화면에 다시 붙잡아두면 그게 강제 가입이다.
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
 * 부를 이름. MY에서 정한다.
 *
 * 최소 온보딩에서 뺀 값이라(v3.10 §3) 이 계약이 없으면 이름을 정할 방법이 없다.
 * null은 "안 부름"이다 — 한 번 적었다고 영영 못 지우게 할 이유가 없다.
 */
export const displayNameRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(MAX_DISPLAY_NAME_LENGTH).nullable(),
});

export const displayNameResponseSchema = z.object({
  displayName: z.string().nullable(),
});

/**
 * 최소 온보딩. 통합정책 v3.10 §3.
 *
 * **이름을 받지 않는다.** v3.10이 닉네임을 최초 필수입력에서 뺐다 — 이름을 물어보는
 * 화면은 "가입" 냄새가 나고, 이 앱은 로그인을 앞세우지 않는다. 부를 이름은 MY에서
 * 따로 정한다.
 *
 * 예식일과 지역은 함께 받는다. 따로 받으면 날짜만 넣고 나간 사람이 생기고, 그
 * 사람에게 보여줄 것은 전국 평균뿐이다.
 *
 * 총예산은 선택이고, 자유 입력이 아니라 다섯 구간 중 하나다(01-onboarding.dc.html
 * #11e). 안 보내면 아직 안 고른 것이다 — `unknown`("아직 모르겠어요")과는 다르다.
 */
export const completeSetupRequestSchema = z.object({
  weddingDate: dateSchema,
  region: z.string().trim().min(1),
  budgetBracket: budgetBracketSchema.nullable().optional(),
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
export type BudgetBracket = z.infer<typeof budgetBracketSchema>;
