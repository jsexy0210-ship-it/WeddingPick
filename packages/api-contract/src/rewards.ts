import {
  MONTHLY_DRAW_STATUSES,
  REFERRAL_CODE_LENGTH,
  REWARD_KINDS,
  REWARD_STATUSES,
} from '@weddingpick/domain';
import { z } from 'zod';

import { idSchema, timestampSchema } from './common';

/**
 * 이벤트 보상. 최종통합정책 v2.0 I장.
 *
 * **금액을 화면이 정하지 않는다.** 응답이 금액을 들고 오고, 화면은 그것을 적는다 —
 * 두 곳에 적어두면 정책이 바뀔 때 한 곳만 바뀐다.
 */
export const rewardGrantSchema = z.object({
  id: idSchema,
  kind: z.enum(REWARD_KINDS),
  kindLabel: z.string().min(1),
  amountKrw: z.int().positive(),
  status: z.enum(REWARD_STATUSES),
  statusLabel: z.string().min(1),
  statusNote: z.string().min(1),
  /** 지급하지 않기로 했을 때의 사유. 사람이 적는다. */
  decisionNote: z.string().nullable(),
  createdAt: timestampSchema,
});

/**
 * 내 초대 현황.
 *
 * 초대받은 사람이 누구인지는 나가지 않는다 — 초대한 사람이 알아야 할 것은 몇
 * 명이 조건을 채웠는지이지, 그 사람이 무엇을 결제했는지가 아니다.
 */
export const myRewardsResponseSchema = z.object({
  referralCode: z.string().length(REFERRAL_CODE_LENGTH),
  /** 내 코드를 넣고 들어온 사람 수. */
  invitedCount: z.int().nonnegative(),
  /** 그중 첫 결제내역까지 등록한 사람 수. 보상 조건을 채운 수다. */
  qualifiedCount: z.int().nonnegative(),
  grants: z.array(rewardGrantSchema),
});

export const redeemReferralRequestSchema = z.object({
  code: z.string().trim().length(REFERRAL_CODE_LENGTH),
});

export const submitPromotionRequestSchema = z.object({
  url: z.string().trim().min(1).max(500),
});

export type RewardGrant = z.infer<typeof rewardGrantSchema>;
export type MyRewardsResponse = z.infer<typeof myRewardsResponseSchema>;
export type RedeemReferralRequest = z.infer<typeof redeemReferralRequestSchema>;
export type SubmitPromotionRequest = z.infer<typeof submitPromotionRequestSchema>;

/**
 * 월간 웨딩지원금 현황.
 *
 * 응모 여부·당첨 여부를 화면이 계산하지 않고 서버가 내려준다.
 * 화면은 `status`에 따른 말만 고른다.
 */
export const myMonthlyDrawResponseSchema = z.object({
  drawMonth: z.string(),
  status: z.enum(MONTHLY_DRAW_STATUSES),
  statusLabel: z.string(),
  statusNote: z.string(),
  amountKrw: z.int().positive(),
  winnersPerMonth: z.int().positive(),
});

export type MyMonthlyDrawResponse = z.infer<typeof myMonthlyDrawResponseSchema>;
