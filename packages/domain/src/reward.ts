/**
 * 이벤트 보상. 최종통합정책 v2.0 I장.
 *
 * 아직 만들지 않았다. 여기 있는 것은 **만들 때 지켜야 하는 규칙**이고, 금액과
 * 조건을 한곳에 모아두는 이유는 나중에 코드 여기저기에 흩어지지 않게 하려는
 * 것이다.
 */

/** 지금 정해진 금액. v2.0 I장 — "현재 우선안"이라고 적혀 있어 바뀔 수 있다. */
export const REWARDS = {
  /** 친구초대. **가입만으로는 주지 않는다** — 첫 유효 결제인증이 조건이다(I-1). */
  referral: { amountKrw: 3_000, campaignLimit: 100 },
  /** 홍보인증. 공개 게시물 URL 자동검증이 기본(I-2). */
  promotion: { amountKrw: 2_000, perPerson: 1 },
} as const;

export type RewardKind = keyof typeof REWARDS;

export const REWARD_LABEL: Record<RewardKind, string> = {
  referral: '친구초대',
  promotion: '홍보인증',
};

/**
 * 친구초대 보상 조건. I-1 · K-7.
 *
 * 폐기된 것: `친구 가입+온보딩만으로 보상`
 * 새 규칙: **추천받은 사람의 첫 유효 결제인증**이 조건이다.
 *
 * 가입만으로 돈을 주면 가입만 하는 계정이 모이고, 그 계정들이 만드는 것은
 * 데이터가 아니라 비용이다.
 */
export function canPayReferral(input: {
  invitedUserSignedUp: boolean;
  invitedUserHasUsablePaymentProof: boolean;
}): boolean {
  return input.invitedUserSignedUp && input.invitedUserHasUsablePaymentProof;
}

/**
 * 보상은 신뢰도에 더하지 않는다. C-10.
 *
 * > NPay 등 보상 수령 여부는 결제 데이터의 신뢰점수에 가산하지 않는다.
 *
 * 돈을 받고 낸 자료가 더 믿을 만할 이유가 없고, 그렇게 두면 보상을 노린 자료가
 * 통계를 밀어 올린다. **검증과 보상은 다른 시스템이다.**
 */
export const REWARD_DOES_NOT_AFFECT_TRUST = true;

/**
 * 앱스토어 리뷰와 보상을 **절대 연결하지 않는다.**
 *
 * v2.0이 금지사항으로 못박았고, 애플·구글 정책 위반이기도 하다. 리뷰를 써주면
 * 돈을 주는 구조는 앱이 내려갈 수 있는 사유다.
 *
 * 상수로 두는 이유는 이 규칙이 코드로 표현될 자리가 없어서다 — 만들지 않는 것이
 * 곧 구현이라, 대신 여기 적어 두고 테스트가 이 파일을 읽게 한다.
 */
export const APP_STORE_REVIEW_REWARD_FORBIDDEN = true;

/**
 * 자동지급 흐름. I-3.
 *
 * `조건확인 → 어뷰징검사 → 지급판정 → 한도확인 → 자동지급 → 실패 재시도 → 기록`
 *
 * **설정 한도 안의 정상 지급은 사람이 승인하지 않는다.** 비정상 패턴·예산 초과·
 * 한도 초과만 막거나 위로 올린다.
 */
export const REWARD_STEPS = [
  'check_condition',
  'check_abuse',
  'decide',
  'check_budget',
  'pay',
  'retry',
  'record',
] as const;

export type RewardStep = (typeof REWARD_STEPS)[number];

/** 사람에게 올려야 하는 때. 그 밖에는 자동으로 끝난다. */
export function needsHumanApproval(input: {
  suspectedAbuse: boolean;
  overCampaignLimit: boolean;
  overBudget: boolean;
}): boolean {
  return input.suspectedAbuse || input.overCampaignLimit || input.overBudget;
}
