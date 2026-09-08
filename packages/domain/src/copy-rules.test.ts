import {
  EXEMPT_PHRASES,
  STATE_WORDS,
  findBannedPhrases,
  isVague,
  violatesCopyRules,
} from './copy-rules';
describe('애매모호 표현 금지', () => {
  it('도피처로 쓰이는 말을 잡는다', () => {
    for (const text of [
      '거의 완성됐어요',
      '아마 적용 가능해요',
      '대략 3주 걸려요',
      '어느 정도 모였어요',
      '가능성이 높습니다',
      '적용될 것으로 보인다',
    ]) {
      expect(isVague(text)).toBe(true);
    }
  });

  it('상태로 적은 말은 통과한다', () => {
    /*
     * 모르는 것을 아는 척하라는 뜻이 아니다. 모른다는 것도 상태로 적으라는
     * 뜻이다 — `아마 적용 가능`이 아니라 `현재 검증 전`이다.
     */
    for (const text of ['실 공정률 46%', '현재 검증 전', '확인 필요', '조건부 적용']) {
      expect(isVague(text)).toBe(false);
    }
  });

  it('대신 쓸 말이 목록으로 있다', () => {
    expect([...STATE_WORDS]).toContain('검증 전');
    expect([...STATE_WORDS]).toContain('추정값');
  });

  it('가격 금지어와 따로 센다', () => {
    // 하나는 판정을 막고 하나는 얼버무림을 막는다. 섞으면 왜 막았는지 흐려진다.
    expect(violatesCopyRules('거의 완성')).toBe(false);
    expect(isVague('진짜 가격')).toBe(false);
  });
});

describe('데이터 — v3.3이 화면에서 걷어낸 말', () => {
  it('화면 문구에서 막는다', () => {
    /*
     * v3.1이 정반대를 말했었다(`표본` 대신 `데이터`). 규칙이 뒤집힌 뒤에도 목록이
     * 따라오지 않아 화면 여섯 곳에 남아 있었고, 검색 화면은 같은 자리에서
     * `실 제보`와 `데이터 많은 순`을 함께 적고 있었다.
     */
    expect(violatesCopyRules('데이터 많은 순')).toBe(true);
    expect(violatesCopyRules('실 제보 많은 순')).toBe(false);
  });

  it('출처의 이름은 그대로 둔다', () => {
    // `공공데이터`는 우리가 고른 낱말이 아니라 공공누리 출처의 이름이다.
    expect(findBannedPhrases('공공데이터')).toEqual([]);
    expect(EXEMPT_PHRASES).toContain('공공데이터');
  });

  it('예외가 다른 금지어를 가려주지는 않는다', () => {
    // 예외는 그 낱말 하나를 덮을 뿐이고, 옆에 붙은 금지어는 그대로 걸린다.
    expect(violatesCopyRules('공공데이터 · 데이터 많은 순')).toBe(true);
  });
});
