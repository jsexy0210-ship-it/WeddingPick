import { hasFinalConsonant, particle, withParticle } from './particle';

describe('받침 판정', () => {
  it('한글 받침을 읽는다', () => {
    expect(hasFinalConsonant('청담')).toBe(true);
    expect(hasFinalConsonant('강남')).toBe(true);
    expect(hasFinalConsonant('부산')).toBe(true);
    expect(hasFinalConsonant('제주')).toBe(false);
    expect(hasFinalConsonant('대구')).toBe(false);
  });

  it('숫자는 읽는 소리로 판정한다', () => {
    // 영·일·삼·육·칠·팔에 받침이 있고 이·사·오·구에는 없다.
    expect(hasFinalConsonant('웨딩홀 1')).toBe(true);
    expect(hasFinalConsonant('웨딩홀 8')).toBe(true);
    expect(hasFinalConsonant('웨딩홀 2')).toBe(false);
    expect(hasFinalConsonant('웨딩홀 9')).toBe(false);
  });

  it('알파벳도 읽는 소리로 판정한다', () => {
    // 엘·엠·엔·알 넷만 받침이 있다.
    expect(hasFinalConsonant('Hotel L')).toBe(true);
    expect(hasFinalConsonant('스튜디오 M')).toBe(true);
    expect(hasFinalConsonant('W')).toBe(false);
    expect(hasFinalConsonant('스튜디오 A')).toBe(false);
  });

  it('판정할 수 없으면 받침 없음으로 본다', () => {
    // 둘 중 하나는 골라야 한다. `를`·`가` 쪽이 어느 이름 뒤에도 덜 어색하다.
    expect(hasFinalConsonant('')).toBe(false);
    expect(hasFinalConsonant('   ')).toBe(false);
    expect(hasFinalConsonant('웨딩홀 ·')).toBe(false);
  });

  it('뒤에 붙은 공백에 속지 않는다', () => {
    expect(hasFinalConsonant('청담 ')).toBe(true);
  });
});

describe('조사 고르기', () => {
  it('을과 를을 가른다', () => {
    expect(withParticle('청담', '을를')).toBe('청담을');
    expect(withParticle('제주', '을를')).toBe('제주를');
  });

  it('이·가, 은·는, 와·과를 가른다', () => {
    expect(withParticle('강남', '이가')).toBe('강남이');
    expect(withParticle('제주', '이가')).toBe('제주가');
    expect(withParticle('강남', '은는')).toBe('강남은');
    expect(withParticle('제주', '은는')).toBe('제주는');
    expect(withParticle('강남', '와과')).toBe('강남과');
    expect(withParticle('제주', '와과')).toBe('제주와');
  });

  it('ㄹ 받침 뒤에는 로를 쓴다', () => {
    // `서울로`지 `서울으로`가 아니다.
    expect(withParticle('서울', '으로로')).toBe('서울로');
    expect(withParticle('강남', '으로로')).toBe('강남으로');
    expect(withParticle('제주', '으로로')).toBe('제주로');
  });

  it('괄호를 만들지 않는다', () => {
    /*
     * 이 함수가 있는 이유가 이것이다. 카피 규칙이 코드처럼 보이는 문자열을 막고,
     * `을(를)`은 사람이 말할 때 쓰지 않는 기호다.
     */
    for (const name of ['청담', '제주', 'W', 'Hotel L', '웨딩홀 8']) {
      expect(particle(name, '을를')).not.toContain('(');
    }
  });
});
