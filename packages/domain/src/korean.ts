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

/**
 * 숫자를 천단위 쉼표로 적는다.
 *
 * 2026-09-15 대표 지시 — 「항상 모든 숫자는 천단위 [,] 처리한다」. 사용자 화면과
 * 관리자 화면 전부다.
 *
 * **로케일을 못 박는 것이 이 함수가 있는 이유다.** `toLocaleString()`을 로케일 없이
 * 부르면 기기 설정을 따라가고, 독일어 기기에서는 `1234`가 `1.234`가 된다 — 천을
 * 나타내는 쉼표가 소수점이 되어 **1,234가 1.234로 읽힌다.** 아무 오류도 나지 않고
 * 우리 화면에서는 재현되지 않으므로, 쓰는 자리마다 로케일을 적기를 기대하지 않고
 * 함수 하나로 막는다.
 *
 * 숫자가 아닌 값(NaN · Infinity)은 그대로 문자열로 돌려준다 — 「NaN」이 화면에
 * 보이는 것이 조용히 0으로 바뀌는 것보다 낫다.
 */
export function comma(value: number): string {
  if (!Number.isFinite(value)) return String(value);

  return value.toLocaleString('ko-KR');
}
