import {
  ageRangeLowerBound,
  ageVerdictFromBirthDate,
  ageVerdictFromBirthYear,
  ageVerdictFromRange,
} from './age-range';

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

  it('미만이면 WP-AUTH-009이다', () => {
    // 10~14는 14세도 들어 있지만 13세도 들어 있어 확인이 아니다.
    expect(ageVerdictFromRange('1~9')).toBe('under_age');
    expect(ageVerdictFromRange('10~14')).toBe('under_age');
  });

  it('없으면 체크박스 그대로다', () => {
    expect(ageVerdictFromRange(undefined)).toBe('unknown');
    expect(ageVerdictFromRange('')).toBe('unknown');
  });
});

describe('출생 연도로 만 14세 판정 (2026-09-09 사용자 결정)', () => {
  const now = new Date('2026-09-09T00:00:00Z');

  it('올해 - 출생연도가 15 이상이면 생일과 무관하게 통과다', () => {
    expect(ageVerdictFromBirthYear(2011, now)).toBe('verified');
    expect(ageVerdictFromBirthYear('2000', now)).toBe('verified');
  });

  it('13 이하면 생일이 지났어도 미만이다', () => {
    expect(ageVerdictFromBirthYear(2013, now)).toBe('under_age');
  });

  /*
   * 경계다. 2012년생은 오늘 만 13일 수도 14일 수도 있다. 통과로 처리하면 아직
   * 열세 살인 사람이 들어오고, 막으면 진짜 열네 살이 막힌다. 모르는 것은 모른다고 한다.
   */
  /*
   * 생일 동의를 뺐으므로(2026-09-09) 경계를 가릴 수단이 없다. 통과시키면 아직
   * 열세 살인 사람이 들어오고, 막으면 진짜 열네 살이 생일까지 기다린다.
   * 법이 금지하는 것은 앞쪽이라 뒤쪽을 고른다.
   */
  it('경계(올해 - 연도 == 14)는 막는다', () => {
    expect(ageVerdictFromBirthYear(2012, now)).toBe('under_age');
  });

  it('연도가 없거나 꼴이 아니면 모른다', () => {
    expect(ageVerdictFromBirthYear(undefined, now)).toBe('unknown');
    expect(ageVerdictFromBirthYear('', now)).toBe('unknown');
    expect(ageVerdictFromBirthYear('열두', now)).toBe('unknown');
  });

  it('생일까지 있으면 경계가 사라진다 — 지났으면 통과, 안 지났으면 미만', () => {
    expect(ageVerdictFromBirthDate(2012, '0421', now)).toBe('verified');
    expect(ageVerdictFromBirthDate(2012, '1231', now)).toBe('under_age');
  });

  it('생일이 오늘이면 그날 만 나이가 오른다', () => {
    expect(ageVerdictFromBirthDate(2012, '0909', now)).toBe('verified');
  });

  it('생일 꼴이 아니면 연도만으로 돌아간다 — 틀린 값으로 판정하지 않는다', () => {
    expect(ageVerdictFromBirthDate(2012, '4월21일', now)).toBe('under_age');
    expect(ageVerdictFromBirthDate(2012, '9999', now)).toBe('under_age');
  });
});
