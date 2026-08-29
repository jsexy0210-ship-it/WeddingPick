import {
  APP_STORE_REVIEW_REWARD_FORBIDDEN,
  REWARDS,
  REWARD_DOES_NOT_AFFECT_TRUST,
  REWARD_LABEL,
  canPayReferral,
  needsHumanApproval,
} from './reward';

describe('이벤트 보상', () => {
  it('가입만으로는 주지 않는다', () => {
    /*
     * v2.0 K-7이 "친구 가입+온보딩만으로 보상"을 폐기했다. 가입만으로 돈을 주면
     * 가입만 하는 계정이 모이고, 그 계정들이 만드는 것은 데이터가 아니라 비용이다.
     */
    expect(
      canPayReferral({ invitedUserSignedUp: true, invitedUserHasUsablePaymentProof: false })
    ).toBe(false);
  });

  it('첫 유효 결제인증이 조건이다', () => {
    expect(
      canPayReferral({ invitedUserSignedUp: true, invitedUserHasUsablePaymentProof: true })
    ).toBe(true);
  });

  it('가입하지 않았으면 결제인증이 있을 수 없지만, 그래도 막는다', () => {
    expect(
      canPayReferral({ invitedUserSignedUp: false, invitedUserHasUsablePaymentProof: true })
    ).toBe(false);
  });

  it('금액이 v2.0이 정한 값이다', () => {
    expect(REWARDS.referral.amountKrw).toBe(3_000);
    expect(REWARDS.promotion.amountKrw).toBe(2_000);
    expect(REWARDS.referral.campaignLimit).toBe(100);
  });

  it('한도 안의 정상 지급은 사람이 승인하지 않는다', () => {
    // I-3. 사람이 반복 처리하는 구조를 만들지 않는다(M장).
    expect(
      needsHumanApproval({ suspectedAbuse: false, overCampaignLimit: false, overBudget: false })
    ).toBe(false);
  });

  it('어뷰징·한도 초과·예산 초과만 사람에게 올린다', () => {
    expect(
      needsHumanApproval({ suspectedAbuse: true, overCampaignLimit: false, overBudget: false })
    ).toBe(true);
    expect(
      needsHumanApproval({ suspectedAbuse: false, overCampaignLimit: true, overBudget: false })
    ).toBe(true);
    expect(
      needsHumanApproval({ suspectedAbuse: false, overCampaignLimit: false, overBudget: true })
    ).toBe(true);
  });

  it('보상은 신뢰도에 더하지 않는다', () => {
    /*
     * C-10. 돈을 받고 낸 자료가 더 믿을 만할 이유가 없고, 그렇게 두면 보상을
     * 노린 자료가 통계를 밀어 올린다.
     */
    expect(REWARD_DOES_NOT_AFFECT_TRUST).toBe(true);
  });

  it('앱스토어 리뷰와 보상을 연결하지 않는다', () => {
    // v2.0 금지사항이고, 애플·구글 정책 위반이라 앱이 내려갈 수 있는 사유다.
    expect(APP_STORE_REVIEW_REWARD_FORBIDDEN).toBe(true);
  });

  it('두 종류에 이름이 있다', () => {
    expect(REWARD_LABEL.referral).toBe('친구초대');
    expect(REWARD_LABEL.promotion).toBe('홍보인증');
  });
});
