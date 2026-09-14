import {
  BANNED_PHRASES,
  EXEMPT_PHRASES,
  PENDING_PHRASES,
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

/**
 * 게이트가 무엇을 잡는지 못으로 박는다.
 *
 * **2026-09-09까지 이 여섯을 하나도 잡지 못했다.** 목록이 `spec/glossary.json`과
 * `copy-rules.ts` 두 곳에 따로 있었고, v3.18·v3.22가 금지어를 정할 때 코드 쪽 목록이
 * 따라오지 않았다. 규칙은 문서에 있는데 게이트는 통과시키고 있었다 — 잔존이 0이던 것은
 * 사람이 손으로 지웠기 때문이고, 지키는 장치가 있었기 때문이 아니다.
 *
 * 그래서 「목록을 읽어 온다」가 아니라 「이 말들이 실제로 걸린다」를 검사한다.
 */
describe('v3.18 · v3.22 금지어를 게이트가 잡는다', () => {
  it.each([
    ['AI', 'AI 추천'],
    ['탐색', '업체 탐색'],
    ['관심업체', '관심업체 목록'],
    ['확인된 제보', '확인된 제보 12건'],
    ['오늘의 Pick', '오늘의 Pick'],
    ['네이버페이 포인트', '네이버페이 포인트 5,000원'],
  ])('%s', (phrase, copy) => {
    expect(violatesCopyRules(copy)).toBe(true);
    expect(findBannedPhrases(copy).map((v) => v.phrase)).toContain(phrase);
  });

  it('대신 쓰는 말은 통과한다', () => {
    for (const text of ['웨딩픽 추천', '업체 검색', 'Pick 목록', '실 제보 12건', 'Npay 5,000원']) {
      expect(violatesCopyRules(text)).toBe(false);
    }
  });
});

describe('금지어 목록의 원본은 spec/glossary.json이다', () => {
  it('코드가 목록을 따로 갖지 않는다', () => {
    // 두 곳에 적으면 한 곳만 고치는 날이 온다. 실제로 그랬다.
    expect(BANNED_PHRASES).toContain('오늘의 Pick');
    expect(BANNED_PHRASES).toContain('우리 준비');
  });

  it('라틴 낱말은 낱말 경계까지 본다', () => {
    /*
     * `AI`를 그냥 찾으면 식별자가 전부 걸린다 — 실제로 43건이 걸렸고 화면 문구는
     * 0건이었다. 잡아야 할 것을 못 잡는 것만큼 엉뚱한 것을 잡는 것도 게이트를 죽인다.
     */
    for (const identifier of ['FAILURE_MESSAGE', 'CLAIM_METHODS', 'MAIN', 'detail']) {
      expect(violatesCopyRules(identifier)).toBe(false);
    }

    expect(violatesCopyRules('AI가 분석했어요')).toBe(true);
  });

  it('allow는 낱말이 아니라 문구 하나만 풀어준다', () => {
    /*
     * 「중앙값」을 통째로 풀어주면 「중앙값 168만원」까지 통과한다. 승인된 문구
     * 하나만 풀어야 그 자리만 지나간다 — glossary의 note가 원래 그렇게 적고 있었다.
     */
    expect(violatesCopyRules('기준금액은 실 제보의 중앙값이에요')).toBe(false);
    expect(violatesCopyRules('중앙값 168만원')).toBe(true);
  });

  it('강제를 미룬 항목이 없다', () => {
    /*
     * `pending`은 도망갈 구멍이라 비어 있는 것이 정상이다. 무언가 들어오면 이
     * 검사가 먼저 깨지고, 깨진 자리에서 «왜 미뤘는지»를 읽게 된다.
     */
    expect([...PENDING_PHRASES]).toEqual([]);
    expect(BANNED_PHRASES).toContain('둘러보기');
  });
});
