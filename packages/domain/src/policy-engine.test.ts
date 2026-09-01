import { DISCLOSURE_LIMIT_LABEL, decideDisclosure } from './policy-engine';

describe('가격 공개 Policy Engine', () => {
  it('건수만으로 네 상태를 가른다', () => {
    // 화면은 이 상태만 받는다. 건수 기준은 화면에 없다.
    expect(decideDisclosure({ count: 2 }).stage).toBe('collecting');
    expect(decideDisclosure({ count: 3 }).stage).toBe('limited');
    expect(decideDisclosure({ count: 5 }).stage).toBe('normal');
    expect(decideDisclosure({ count: 10 }).stage).toBe('detailed');
  });

  it('건수가 넉넉해도 조건별 자료가 얇으면 내려 잡는다', () => {
    /*
     * 전체 12건 중 그 조건이 1건이면, 그 1건은 조건별 가격이 아니라 한 사람의
     * 결제다.
     */
    const decision = decideDisclosure({ count: 12, conditionCount: 1 });

    expect(decision.stageByCount).toBe('detailed');
    expect(decision.stage).toBe('collecting');
    expect(decision.limitedBy).toContain('condition_thin');
  });

  it('조건별 자료가 어중간하면 구간까지만 연다', () => {
    const decision = decideDisclosure({ count: 20, conditionCount: 5 });

    expect(decision.stage).toBe('normal');
    expect(decision.limitedBy).toContain('condition_thin');
  });

  it('좁힌 조건에 자료가 모자라면 숨긴다', () => {
    // 지역·시기·상품까지 좁힌 한 건은 통계가 아니라 한 사람의 계약이다.
    const decision = decideDisclosure({ count: 4, narrowedAxes: 3 });

    expect(decision.stage).toBe('collecting');
    expect(decision.limitedBy).toContain('reidentifiable');
  });

  it('안 좁혔으면 재식별을 이유로 막지 않는다', () => {
    expect(decideDisclosure({ count: 12, narrowedAxes: 0 }).stage).toBe('detailed');
  });

  it('최근 자료가 없으면 기준금액을 내지 않는다', () => {
    /*
     * 열 건이 다 2년 전이면 그 중앙값은 지금 값이 아니다. 기준금액은 "지금 얼마쯤
     * 하는가"에 답하는 숫자다.
     */
    const decision = decideDisclosure({ count: 12, recentCount: 0 });

    expect(decision.stage).toBe('normal');
    expect(decision.limitedBy).toContain('stale');
  });

  it('확인 등급이 낮은 자료만 있으면 상세를 열지 않는다', () => {
    const decision = decideDisclosure({ count: 12, minVerificationLevel: 'L1' });

    expect(decision.stage).toBe('normal');
    expect(decision.limitedBy).toContain('low_trust');
  });

  it('등급이 충분하면 그대로 연다', () => {
    expect(decideDisclosure({ count: 12, minVerificationLevel: 'L2' }).stage).toBe('detailed');
  });

  it('튀는 값이 많으면 중앙값을 내지 않는다', () => {
    // 이상값이 섞인 중앙값은 중앙값이 아니다.
    const decision = decideDisclosure({ count: 10, outlierCount: 3 });

    expect(decision.stage).toBe('normal');
    expect(decision.limitedBy).toContain('outliers');
  });

  it('튀는 값이 조금이면 그대로 연다', () => {
    expect(decideDisclosure({ count: 10, outlierCount: 1 }).stage).toBe('detailed');
  });

  it('올려 잡지 않는다', () => {
    /*
     * 신호 하나가 좋다고 부족한 자료를 자세히 보여주면, 그 화면은 우리가 아는
     * 것보다 많이 아는 척하게 된다.
     */
    const decision = decideDisclosure({
      count: 3,
      conditionCount: 100,
      recentCount: 100,
      minVerificationLevel: 'L4',
      outlierCount: 0,
    });

    expect(decision.stage).toBe('limited');
  });

  it('내려 잡았으면 왜인지 한 줄로 말한다', () => {
    const decision = decideDisclosure({ count: 12, conditionCount: 1 });

    expect(decision.note).toBe(DISCLOSURE_LIMIT_LABEL.condition_thin);
  });

  it('건수가 모자라 적은 것은 내려 잡은 것이 아니다', () => {
    // 그건 이 자료의 지금 상태고, 캡션이 이미 데이터가 적다고 말한다.
    const decision = decideDisclosure({ count: 3 });

    expect(decision.limitedBy).toEqual([]);
    expect(decision.note).toBeNull();
  });
});
