import { ageRangeLowerBound, ageVerdictFromRange } from './age-range';

describe('연령대 판정 — SPEC 3.5', () => {
  it('카카오 연령대의 아래끝을 읽는다', () => {
    expect(ageRangeLowerBound('20~29')).toBe(20);
    expect(ageRangeLowerBound('1~9')).toBe(1);
    expect(ageRangeLowerBound('90~')).toBe(90);
    // 네이버 꼴도 읽는다.
    expect(ageRangeLowerBound('20-29')).toBe(20);
  });

  it('꼴이 아니면 모르는 것이다', () => {
    expect(ageRangeLowerBound(undefined)).toBeNull();
    expect(ageRangeLowerBound('')).toBeNull();
    expect(ageRangeLowerBound('twenties')).toBeNull();
  });

  it('14세 이상이면 체크박스 없이 통과한다', () => {
    expect(ageVerdictFromRange('15~19')).toBe('verified');
    expect(ageVerdictFromRange('20~29')).toBe('verified');
    expect(ageVerdictFromRange('90~')).toBe('verified');
  });

  it('미만이면 WP-AUTH-010이다', () => {
    // 10~14는 14세도 들어 있지만 13세도 들어 있어 확인이 아니다.
    expect(ageVerdictFromRange('1~9')).toBe('under_age');
    expect(ageVerdictFromRange('10~14')).toBe('under_age');
  });

  it('없으면 체크박스 그대로다', () => {
    expect(ageVerdictFromRange(undefined)).toBe('unknown');
    expect(ageVerdictFromRange('')).toBe('unknown');
  });
});
