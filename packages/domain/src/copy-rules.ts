/**
 * 화면 문구 규칙.
 *
 * 디자인 핸드오프 카피 규칙 — **우리는 가격의 적정 여부를 판정하지 않는다.**
 * 판정처럼 들리는 말을 쓰면 하지 않는 일을 한다고 말하는 것이 되고, 그건 규칙을
 * 어긴 것보다 나쁘다. 사람들은 문구를 믿고 결정한다.
 *
 * 규칙을 코드에 두는 이유는 문서에만 적어두면 지켜지지 않기 때문이다. 실제로
 * "찍으면, 진짜 가격이 보인다"가 네 곳에 박혀 있었다.
 */

export const BANNED_PHRASES = [
  '진짜 가격',
  '적정가',
  '적정 가격',
  '적정한 가격',
  '정확한 가격',
  '바가지',
  '비싼 편',
  '싼 편',
] as const;

/** 그 자리에 대신 쓰는 말. */
export const PREFERRED_PHRASES = [
  '가격 차이',
  '실제 결제 사례',
  '결제 구간',
  '결제 분포',
] as const;

export type CopyViolation = { phrase: string; index: number };

/**
 * 화면에 나갈 문구인가.
 *
 * **주석과 문서는 검사 대상이 아니다.** 규칙 자체를 설명하려면 금지어를 적어야
 * 하고, 그걸 막으면 왜 금지했는지 적을 수 없게 된다.
 */
export function findBannedPhrases(text: string): CopyViolation[] {
  return BANNED_PHRASES.flatMap((phrase) => {
    const index = text.indexOf(phrase);

    return index >= 0 ? [{ phrase, index }] : [];
  });
}

export function violatesCopyRules(text: string): boolean {
  return findBannedPhrases(text).length > 0;
}

/**
 * 느낌표와 이모지도 쓰지 않는다. 핸드오프 카피 규칙.
 *
 * 느낌표는 문구를 광고처럼 만들고, 광고처럼 읽히는 숫자는 믿기 어려워진다.
 */
export function hasExclamationOrEmoji(text: string): boolean {
  return /[!！]/u.test(text) || /\p{Extended_Pictographic}/u.test(text);
}
