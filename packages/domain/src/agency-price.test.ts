import {
  AGENCY_CONDITIONS,
  AGENCY_CONDITION_LABEL,
  AGENCY_MIN_CONDITIONS,
  AGENCY_PRICE_SOURCE_LABEL,
  decideAgencyDisclosure,
  isAgency,
  type AgencyCondition,
} from './agency-price';
import { findBannedPhrases } from './copy-rules';

const FOUR: AgencyCondition[] = ['period', 'intro_count', 'intro_method', 'success_fee'];

describe('결혼정보회사 판정', () => {
  it('업종으로 가른다', () => {
    expect(isAgency('wedding_info_company')).toBe(true);
    expect(isAgency('hall')).toBe(false);
  });
});

describe('결혼정보회사 금액 공개', () => {
  it('한 건은 결코 금액이 되지 않는다', () => {
    /*
     * "개인 1건의 실제 결제금액 단독 공개 금지"는 사다리의 부수 효과가 아니라
     * 그 자체로 규칙이다. 사다리를 낮추는 날이 와도 이 줄은 남는다.
     */
    const decision = decideAgencyDisclosure({ count: 1, knownConditions: AGENCY_CONDITIONS });

    expect(decision.stage).toBe('collecting');
  });

  it('조건을 모르면 구간까지만 연다', () => {
    // 기간도 모르는 채 금액을 보여주면 3개월 3회와 1년 무제한이 같은 줄에 선다.
    const decision = decideAgencyDisclosure({
      count: 20,
      recentCount: 10,
      knownConditions: ['period', 'intro_count'],
    });

    expect(decision.stageByCount).toBe('detailed');
    expect(decision.stage).toBe('normal');
    expect(decision.note).toContain('이용기간');
  });

  it('조건이 넷 모이면 상세를 연다', () => {
    const decision = decideAgencyDisclosure({
      count: 20,
      recentCount: 10,
      knownConditions: FOUR,
    });

    expect(decision.stage).toBe('detailed');
  });

  it('같은 조건을 두 번 세지 않는다', () => {
    const decision = decideAgencyDisclosure({
      count: 20,
      recentCount: 10,
      knownConditions: ['period', 'period', 'intro_count', 'intro_method'],
    });

    expect(decision.stage).toBe('normal');
  });

  it('공통 Policy Engine의 제한을 그대로 물려받는다', () => {
    // 조건을 다 알아도 재식별 위험이 있으면 열지 않는다.
    const decision = decideAgencyDisclosure({
      count: 4,
      narrowedAxes: 3,
      knownConditions: AGENCY_CONDITIONS,
    });

    expect(decision.stage).toBe('collecting');
    expect(decision.limitedBy).toContain('reidentifiable');
  });

  it('넷이 기준이다', () => {
    expect(AGENCY_MIN_CONDITIONS).toBe(4);
    expect(AGENCY_CONDITIONS).toHaveLength(6);
  });

  it('모든 조건에 사용자 이름이 있다', () => {
    for (const condition of AGENCY_CONDITIONS) {
      expect(AGENCY_CONDITION_LABEL[condition]).toBeTruthy();
    }
  });

  it('공식가격과 실 제보를 따로 부른다', () => {
    // 둘을 한 숫자로 합치면 어느 쪽이 근거인지 물을 수 없게 된다.
    expect(AGENCY_PRICE_SOURCE_LABEL.official).toBe('업체 안내');
    expect(AGENCY_PRICE_SOURCE_LABEL.confirmed).toBe('실 제보');
  });

  it('가격을 값매김하는 말을 쓰지 않는다', () => {
    // 싸다·비싸다·적정가·바가지. 웨딩픽은 데이터를 보여주고 사용자가 판단한다.
    const copy = [
      ...Object.values(AGENCY_CONDITION_LABEL),
      ...Object.values(AGENCY_PRICE_SOURCE_LABEL),
    ];

    for (const text of copy) {
      expect(findBannedPhrases(text)).toEqual([]);
    }
  });
});
