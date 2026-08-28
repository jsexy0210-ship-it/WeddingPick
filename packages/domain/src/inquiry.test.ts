import {
  INQUIRY_CATEGORIES,
  INQUIRY_CATEGORY_RULES,
  INQUIRY_RESPONSE_BUSINESS_DAYS,
  canSubmitInquiry,
  inquiryAcknowledgement,
} from './inquiry';

const base = {
  category: 'other' as const,
  body: '문의합니다',
  hasSubject: false,
  hasReplyRoute: true,
};

describe('문의 접수', () => {
  it('정해지지 않은 기한을 약속하지 않는다', () => {
    // 서비스정책서 미확정 항목. 지키지 못할 기한을 적는 것보다 못 정했다고 말하는 편이 낫다.
    expect(INQUIRY_RESPONSE_BUSINESS_DAYS).toBeNull();
    expect(inquiryAcknowledgement()).toContain('아직 정하지 못했습니다');
    expect(inquiryAcknowledgement()).not.toMatch(/\d+일 안에/);
  });

  it('기한이 정해지면 그 기한을 말한다', () => {
    expect(inquiryAcknowledgement(7)).toContain('영업일 기준 7일 안에');
  });

  it('답할 방법이 없으면 받지 않는다', () => {
    // 받아만 두고 답할 수 없으면 접수한 척한 것이다.
    expect(canSubmitInquiry({ ...base, hasReplyRoute: false })).toBe(false);
  });

  it('빈 내용은 받지 않는다', () => {
    expect(canSubmitInquiry({ ...base, body: '   ' })).toBe(false);
  });

  it('노출 중단은 누구를 내릴지 없이는 받지 않는다', () => {
    expect(canSubmitInquiry({ ...base, category: 'planner_delisting' })).toBe(false);
    expect(
      canSubmitInquiry({ ...base, category: 'planner_delisting', hasSubject: true })
    ).toBe(true);
  });

  it('항목마다 사람이 읽을 이름과 설명이 있다', () => {
    for (const category of INQUIRY_CATEGORIES) {
      expect(INQUIRY_CATEGORY_RULES[category].label).toBeTruthy();
      expect(INQUIRY_CATEGORY_RULES[category].description).toBeTruthy();
    }
  });
});
