/**
 * 조사 붙이기.
 *
 * 이름을 문장에 끼워 넣는 문구가 서버와 앱 여러 곳에 있다. 조사를 하나로 고정해두면
 * "결제 내역가 있어야 합니다" 같은 문장이 화면에 그대로 나간다.
 */

const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
/** 종성 표에서 ㄹ의 자리. 'ㄹ'은 '으로'가 아니라 '로'를 받는다. */
const RIEUL = 8;

/** 마지막 글자의 종성. 한글 음절이 아니면 undefined — 판단하지 않는다. */
function finalConsonant(word: string): number | undefined {
  const last = word.trimEnd().at(-1);

  if (!last) {
    return undefined;
  }

  const code = last.charCodeAt(0);

  if (code < HANGUL_FIRST || code > HANGUL_LAST) {
    return undefined;
  }

  return (code - HANGUL_FIRST) % 28;
}

function hasFinalConsonant(word: string): boolean {
  const final = finalConsonant(word);

  // 숫자·기호·영문으로 끝나면 받침 없는 것으로 본다. "35%를", "PDF를".
  return final !== undefined && final !== 0;
}

/** 이/가 */
export function subjectParticle(word: string): string {
  return hasFinalConsonant(word) ? '이' : '가';
}

/** 은/는 */
export function topicParticle(word: string): string {
  return hasFinalConsonant(word) ? '은' : '는';
}

/** 을/를 */
export function objectParticle(word: string): string {
  return hasFinalConsonant(word) ? '을' : '를';
}

/** 으로/로. ㄹ 받침은 '로'를 받는다. */
export function instrumentParticle(word: string): string {
  const final = finalConsonant(word);

  if (final === undefined || final === 0 || final === RIEUL) {
    return '로';
  }

  return '으로';
}

/** "결제 내역이", "견적서가". 이름과 조사를 붙여 돌려준다. */
export function withSubject(word: string): string {
  return `${word}${subjectParticle(word)}`;
}

export function withTopic(word: string): string {
  return `${word}${topicParticle(word)}`;
}

export function withObject(word: string): string {
  return `${word}${objectParticle(word)}`;
}

export function withInstrument(word: string): string {
  return `${word}${instrumentParticle(word)}`;
}
