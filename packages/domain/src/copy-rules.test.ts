import { STATE_WORDS, isVague, violatesCopyRules } from './copy-rules';
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
