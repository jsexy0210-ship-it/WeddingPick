import {
  MONTHLY_DRAW_CONDITION_KEYS,
  RECIPIENT_NAME_MAX,
  REWARD_PAYOUT_STATUSES,
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
export const monthlyDrawConditionSchema = z.object({
  key: z.enum(MONTHLY_DRAW_CONDITION_KEYS),
  label: z.string().min(1),
  done: z.boolean(),
});

export const myMonthlyDrawResponseSchema = z.object({
  drawMonth: z.string(),
  status: z.enum(MONTHLY_DRAW_STATUSES),
  statusLabel: z.string(),
  statusNote: z.string(),
  amountKrw: z.int().positive(),
  winnersPerMonth: z.int().positive(),
  /** 응모 조건 3개. 순서가 화면 순서다(WP-EVT-005 · WP-SHT-017). */
  conditions: z.array(monthlyDrawConditionSchema),
  /** 아직 안 채운 조건 수. 혜택 안내 시트 제목이 이 수로 정해진다. */
  remaining: z.int().nonnegative(),
});

export type MonthlyDrawCondition = z.infer<typeof monthlyDrawConditionSchema>;

export type MyMonthlyDrawResponse = z.infer<typeof myMonthlyDrawResponseSchema>;

/**
 * Npay 리워드 수령(WP-EVT-006).
 *
 * 휴대폰 번호는 본인에게도 전체를 되돌려주지 않는다 — 가린 꼴(010-****-5678)만 나간다.
 * 보낸 뒤에는 서버에서 지워지므로 null이다.
 */
export const rewardPayoutSchema = z.object({
  id: idSchema,
  amountKrw: z.int().positive(),
  recipientName: z.string().min(1),
  phoneMasked: z.string().nullable(),
  status: z.enum(REWARD_PAYOUT_STATUSES),
  statusLabel: z.string().min(1),
  statusNote: z.string().min(1),
  /** 실패했을 때만. 받는 사람이 읽는다. */
  failureReason: z.string().nullable(),
  requestedAt: timestampSchema,
  settledAt: timestampSchema.nullable(),
});

export const myRewardPayoutResponseSchema = z.object({
  /** 지금 받을 수 있는 금액 — 지급 대기(earned) 중 아직 어떤 요청에도 안 묶인 보상의 합. */
  receivableKrw: z.int().nonnegative(),
  receivableGrantIds: z.array(idSchema),
  /** 받는 분 칸의 기본값 — 부를 이름. 없으면 null. */
  recipientNameDefault: z.string().nullable(),
  /** 열린 요청(확인 중). 있으면 화면은 폼 대신 이 상태를 보여준다. */
  open: rewardPayoutSchema.nullable(),
  /** 끝난 요청들 — 최신이 앞. */
  history: z.array(rewardPayoutSchema),
});

export const requestRewardPayoutRequestSchema = z.object({
  recipientName: z.string().trim().min(1).max(RECIPIENT_NAME_MAX),
  /** 숫자 · 하이픈 · 공백 섞여도 된다. 서버가 010-XXXX-XXXX로 정리한다. */
  phone: z.string().trim().min(10).max(20),
  /** 개인정보 제공 동의. true가 아니면 요청이 성립하지 않는다. */
  consent: z.literal(true),
});

export type RewardPayout = z.infer<typeof rewardPayoutSchema>;
export type MyRewardPayoutResponse = z.infer<typeof myRewardPayoutResponseSchema>;
export type RequestRewardPayoutRequest = z.infer<typeof requestRewardPayoutRequestSchema>;
