import {
  COLLECTING_LABEL,
  MINIMUM_REVIEW_COUNT,
  OBJECTION_HOLD_MAX_DAYS,
  REVIEW_CAVEAT,
  REVIEW_VERIFICATION,
  aspectsFor,
  aspectsForRole,
  canMergeScores,
  canSubmitReview,
  computeUsageScore,
  countsTowardScore,
  isVisible,
  objectionHoldUntil,
  reviewReportAcknowledgement,
  reviewVerificationFromQuote,
  shouldRestore,
  strongerVerification,
  verificationNote,
} from './review';

describe('누가 무엇에 답하는가', () => {
  it('하객은 계약 조건을 모르므로 묻지 않는다', () => {
    const forGuest = aspectsForRole('sdm', 'guest').map((a) => a.key);

    // 모르는 것을 물으면 짐작으로 채우고, 그 짐작이 점수가 된다.
    expect(forGuest).not.toContain('extra_cost');
    expect(forGuest).not.toContain('retouch');
  });

  it('하객도 주차·교통·식사는 안다', () => {
    const forGuest = aspectsForRole('hall', 'guest').map((a) => a.key);

    // 사업계획서 17번: 하객은 주차+교통+식사 데이터의 중요 생산자다.
    expect(forGuest).toEqual(
      expect.arrayContaining(['parking', 'transport', 'food_taste', 'crowding'])
    );
  });

  it('계약자에게는 전부 묻는다', () => {
    expect(aspectsForRole('hall', 'contractor')).toEqual(aspectsFor('hall'));
  });

  it('웨딩홀에서도 추가비용은 계약자만 안다', () => {
    // 사업계획서 1번이 꼽은 문제가 이것이다 — 견적서의 금액과 실제로 낸 금액이
    // 다르다. 그런데 그걸 아는 사람은 계약한 사람뿐이다.
    expect(aspectsForRole('hall', 'contractor').map((a) => a.key)).toContain('extra_cost');
    expect(aspectsForRole('hall', 'guest').map((a) => a.key)).not.toContain('extra_cost');
  });

  it('업종마다 항목이 다르다', () => {
    const hall = aspectsFor('hall').map((a) => a.key);
    const sdm = aspectsFor('sdm').map((a) => a.key);

    // 웨딩홀에서 중요한 것과 스튜디오에서 중요한 것은 겹치지 않는다.
    expect(hall).toContain('food_taste');
    expect(sdm).not.toContain('food_taste');
    expect(sdm).toContain('retouch');
  });
});

describe('이용점수', () => {
  const review = (overall: number, verification: 'unverified' | 'payment' | 'contract') => ({
    overall,
    verification,
    aspects: { parking: overall },
  });

  it('확인된 후기만 센다', () => {
    /*
     * 누구나 쓸 수 있는 글이 업체 점수를 움직이면 그 점수는 사고팔 수 있는 것이
     * 된다(서비스정책서 5번).
     */
    const score = computeUsageScore([
      review(5, 'unverified'),
      review(5, 'unverified'),
      review(5, 'unverified'),
      review(1, 'contract'),
    ]);

    expect(score.available).toBe(false);
    expect(score.count).toBe(1);
  });

  it('표본이 모자라면 만들지 않는다', () => {
    const score = computeUsageScore([review(4, 'contract'), review(5, 'payment')]);

    // 후기 두세 건으로 만든 점수는 정보가 아니라 소음이다.
    expect(score.available).toBe(false);
    expect(score.available === false && score.reason).toContain(`${MINIMUM_REVIEW_COUNT}건이`);
    // 스펙 5.5: 기준에 못 미치면 확정 비율을 내보내지 않는다.
    expect(score.available === false && score.reason).toContain(COLLECTING_LABEL);
  });

  it('충분하면 평균과 항목별 점수를 함께 준다', () => {
    const score = computeUsageScore([
      review(4, 'contract'),
      review(5, 'payment'),
      review(3, 'contract'),
      review(4, 'contract'),
      review(4, 'payment'),
    ]);

    expect(score.available).toBe(true);
    expect(score.available === true && score.average).toBe(4);
    expect(score.available === true && score.byAspect.parking).toBe(4);
    expect(score.count).toBe(MINIMUM_REVIEW_COUNT);
  });

  it('한 건 모자라면 아무 숫자도 내보내지 않는다', () => {
    // 스펙 5.5: 확정 비율 노출 금지. 흐린 숫자도 숫자고, 사람들은 숫자를 읽는다.
    const score = computeUsageScore(
      Array.from({ length: MINIMUM_REVIEW_COUNT - 1 }, () => review(5, 'contract'))
    );

    expect(score.available).toBe(false);
    expect(Object.keys(score)).not.toContain('average');
  });

  it('미인증은 점수를 움직이지 않는다', () => {
    expect(countsTowardScore('unverified')).toBe(false);
    expect(countsTowardScore('payment')).toBe(true);
    expect(countsTowardScore('contract')).toBe(true);
  });
});

describe('스드메 세 업체를 합치지 않는다', () => {
  it('업체가 둘 이상이면 하나로 만들 수 없다', () => {
    // 사업계획서 19번. 스튜디오는 좋았고 드레스는 나빴던 경험을 3.5점 하나로
    // 만들면 다음 사람은 무엇이 문제였는지 알 수 없다.
    expect(canMergeScores(['studio', 'dress', 'makeup'])).toBe(false);
    expect(canMergeScores(['studio'])).toBe(true);
  });
});

describe('이미 인증한 문서로 후기를 확인한다', () => {
  it('계약인증 이상이면 계약 확인', () => {
    // 같은 것을 두 번 확인하게 하면 사람들은 두 번째에서 그만둔다.
    expect(reviewVerificationFromQuote('L2')).toBe('contract');
    expect(reviewVerificationFromQuote('L4')).toBe('contract');
  });

  it('견적인증으로는 확인해 주지 않는다', () => {
    // 견적서를 받은 것과 그 업체를 이용한 것은 다른 일이다.
    expect(reviewVerificationFromQuote('L1')).toBeNull();
  });

  it('미인증 문서로는 올릴 수 없다', () => {
    expect(reviewVerificationFromQuote('L0')).toBeNull();
  });
});

describe('임시조치', () => {
  it('법이 정한 30일을 쓴다', () => {
    // 정보통신망법 제44조의2. 우리가 정하는 숫자가 아니다 — 길게 잡으면 업체가
    // 이의만 제기해도 불리한 후기를 오래 지울 수 있다.
    expect(OBJECTION_HOLD_MAX_DAYS).toBe(30);

    const hold = objectionHoldUntil(new Date('2026-09-01T00:00:00Z'));

    expect(hold.until.toISOString().slice(0, 10)).toBe('2026-10-01');
  });

  it('기간이 지나면 다시 올린다', () => {
    // 결론을 못 냈다는 이유로 계속 내려두면 이의 제기가 곧 삭제가 된다.
    expect(
      shouldRestore({
        status: 'under_objection',
        holdUntil: new Date('2026-09-01'),
        now: new Date('2026-09-02'),
      })
    ).toBe(true);
  });

  it('기간 안이면 그대로 둔다', () => {
    expect(
      shouldRestore({
        status: 'under_objection',
        holdUntil: new Date('2026-10-01'),
        now: new Date('2026-09-02'),
      })
    ).toBe(false);
  });

  it('이의 확인 중인 글은 보이지 않는다', () => {
    expect(isVisible('published')).toBe(true);
    expect(isVisible('under_objection')).toBe(false);
    expect(isVisible('removed')).toBe(false);
  });
});

describe('후기 쓰기', () => {
  const draft = { overall: 4, role: 'contractor' as const, body: '가'.repeat(50) };

  it('별점을 골라야 한다', () => {
    expect(canSubmitReview({ ...draft, overall: 0 }).ok).toBe(false);
  });

  it('짧으면 받지 않는다', () => {
    const result = canSubmitReview({ ...draft, body: '좋았어요' });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain('50자');
  });

  it('조건을 갖추면 받는다', () => {
    expect(canSubmitReview(draft)).toEqual({ ok: true });
  });
});

describe('쓰기 전에 알려주는 말', () => {
  it('확인 단계마다 이유를 준다', () => {
    // 다 쓰고 나서 "미인증입니다"라고 하면 그건 통보고, 그 자리에서 글을 지운다.
    for (const value of REVIEW_VERIFICATION) {
      expect(verificationNote(value).length).toBeGreaterThan(0);
    }
  });

  it('올릴 방법이 있으면 그 방법을 말한다', () => {
    expect(verificationNote('payment')).toContain('계약서를 인증하시면');
  });

  it('미인증이어도 글은 보인다고 말한다', () => {
    expect(verificationNote('unverified')).toContain('그대로 보이지만');
  });
});

describe('두 근거가 다 있을 때', () => {
  it('사람이 심사한 쪽이 이긴다', () => {
    // 사람이 심사한 것과 기계가 읽고 등록한 것은 무게가 다르다.
    expect(strongerVerification('payment', 'contract')).toBe('contract');
    expect(strongerVerification('contract', 'payment')).toBe('contract');
    expect(strongerVerification('unverified', 'payment')).toBe('payment');
  });
});

describe('신고 접수', () => {
  it('신고만으로 내려간다고 말하지 않는다', () => {
    // 신고만으로 글이 내려가면 그건 신고가 아니라 삭제 버튼이다.
    expect(reviewReportAcknowledgement()).toContain('신고만으로 글이 내려가지는 않습니다');
  });

  it('정해지지 않은 기한을 약속하지 않는다', () => {
    expect(reviewReportAcknowledgement()).not.toMatch(/\d+일 안에/);
  });
});

describe('후기에 함께 나가는 말', () => {
  it('사실 여부를 확인하지 않는다고 밝힌다', () => {
    // 가격 비교에 "금액만으로는 비교하기 어렵다"를 붙이는 것과 같은 이유다.
    expect(REVIEW_CAVEAT).toContain('사실 여부를 확인하지 않습니다');
    expect(REVIEW_CAVEAT).toContain('실제로 이용했다는 것까지만');
  });
});
