import {
  instrumentParticle,
  objectParticle,
  subjectParticle,
  topicParticle,
  withSubject,
} from './korean';

describe('조사', () => {
  it('받침이 있으면 이/은/을', () => {
    expect(subjectParticle('결제 내역')).toBe('이');
    expect(topicParticle('계약금 환급')).toBe('은');
    expect(objectParticle('계약금 환급')).toBe('을');
  });

  it('받침이 없으면 가/는/를', () => {
    expect(subjectParticle('견적서')).toBe('가');
    expect(topicParticle('드레스 피팅비')).toBe('는');
    expect(objectParticle('이용 확인 자료')).toBe('를');
  });

  it('숫자와 기호로 끝나면 받침 없는 것으로 본다', () => {
    // "35%을 기준으로"라고 쓰던 자리다.
    expect(objectParticle('총 비용의 35%')).toBe('를');
    expect(subjectParticle('PDF')).toBe('가');
  });

  it('ㄹ 받침은 로를 받는다', () => {
    expect(instrumentParticle('파일')).toBe('로');
    expect(instrumentParticle('결제 내역')).toBe('으로');
    expect(instrumentParticle('견적서')).toBe('로');
  });

  it('이름과 조사를 붙여 준다', () => {
    expect(withSubject('결제 내역')).toBe('결제 내역이');
    expect(withSubject('견적서')).toBe('견적서가');
  });
});
