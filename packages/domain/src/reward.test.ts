import {
  APP_STORE_REVIEW_REWARD_FORBIDDEN,
  REFERRAL_CODE_ALPHABET,
  REFERRAL_NOTICE,
  REWARDS,
  REWARD_DOES_NOT_AFFECT_TRUST,
  REWARD_LABEL,
  REWARD_STATUS_LABEL,
  REWARD_STATUS_NOTE,
  canPayReferral,
  checkPromotionUrl,
  checkRedeem,
  decideGrant,
  isReferralCode,
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

describe('보상 지급 규칙', () => {
  describe('초대 코드', () => {
    it('헷갈리는 글자는 코드에 쓰지 않는다', () => {
      // 0과 O, 1과 I. 눈으로 보고 손으로 옮겨 적는 것이라 닮은 글자를 뺀다.
      for (const letter of ['0', 'O', '1', 'I']) {
        expect(REFERRAL_CODE_ALPHABET).not.toContain(letter);
      }
    });

    it('여섯 자리가 아니면 코드가 아니다', () => {
      expect(isReferralCode('ABC23')).toBe(false);
      expect(isReferralCode('ABC234')).toBe(true);
      expect(isReferralCode('abc234')).toBe(true);
    });

    it('내 코드는 넣을 수 없다', () => {
      const result = checkRedeem({ code: 'ABC234', isOwnCode: true, alreadyInvited: false });

      expect(result).toEqual({ ok: false, message: '내 코드는 넣을 수 없어요' });
    });

    it('두 번 넣을 수 없다', () => {
      const result = checkRedeem({ code: 'ABC234', isOwnCode: false, alreadyInvited: true });

      expect(result.ok).toBe(false);
    });
  });

  describe('홍보 글 주소', () => {
    it('https가 아니면 받지 않는다', () => {
      expect(checkPromotionUrl('http://blog.example.com/a').ok).toBe(false);
    });

    it('주소 꼴이 아니면 받지 않는다', () => {
      expect(checkPromotionUrl('https://abc').ok).toBe(false);
      expect(checkPromotionUrl('https://.com/a').ok).toBe(false);
    });

    it('꼴이 맞으면 받는다', () => {
      expect(checkPromotionUrl('https://blog.example.com/wedding').ok).toBe(true);
    });
  });

  describe('지급 판정', () => {
    it('한도 안의 정상 지급은 사람을 거치지 않는다', () => {
      /*
       * I-3: 설정 한도 내 정상 지급은 사람이 승인하지 않는다. 승인 줄을 세워두면
       * 그 줄이 곧 병목이 되고, A-2가 만들지 말라고 한 구조가 된다.
       */
      const decision = decideGrant({
        kind: 'referral',
        paidCountSoFar: 10,
        suspectedAbuse: false,
      });

      expect(decision).toEqual({ status: 'earned', reasonCode: 'condition_met' });
    });

    it('캠페인 한도를 넘으면 사람에게 올린다', () => {
      const decision = decideGrant({
        kind: 'referral',
        paidCountSoFar: REWARDS.referral.campaignLimit,
        suspectedAbuse: false,
      });

      expect(decision).toEqual({ status: 'held', reasonCode: 'over_campaign_limit' });
    });

    it('어뷰징이 의심되면 한도와 무관하게 올린다', () => {
      const decision = decideGrant({ kind: 'promotion', paidCountSoFar: 0, suspectedAbuse: true });

      expect(decision.status).toBe('held');
    });
  });

  describe('안내 문구', () => {
    it('언제 준다고 적지 않는다', () => {
      // 지킬 수 있는 날짜가 정해져 있지 않다. 지키지 못할 약속은 안 하느니만 못하다.
      for (const note of Object.values(REWARD_STATUS_NOTE)) {
        expect(note).not.toMatch(/영업일|일 이내|시간 이내|주 이내/);
      }
    });

    it('조건이 찬 것과 돈이 간 것을 다르게 말한다', () => {
      expect(REWARD_STATUS_NOTE.earned).not.toBe(REWARD_STATUS_NOTE.paid);
      expect(REWARD_STATUS_LABEL.earned).toBe('지급 대기');
      expect(REWARD_STATUS_LABEL.paid).toBe('지급 완료');
    });

    it('친구초대 안내가 조건을 먼저 말한다', () => {
      // 가입만으로 준다고 읽히면 안 된다. K-7이 그 규칙을 폐기했다.
      expect(REFERRAL_NOTICE).toContain('결제내역');
      expect(REFERRAL_NOTICE).toContain('가입만으로는');
    });
  });
});
