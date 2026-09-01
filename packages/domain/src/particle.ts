/**
 * 조사 고르기 — `을/를`, `이/가`, `은/는`, `와/과`, `으로/로`.
 *
 * 화면에 업체 이름을 넣으면 바로 조사가 따라온다. 그때 `을(를)`이라고 적는 것은
 * 카피 규칙이 막는 **코드처럼 보이는 문자열**이다 — 괄호는 사람이 말할 때 쓰지
 * 않는 기호고, 사람 이름이 들어간 문장에서 그 괄호가 제일 먼저 눈에 띈다.
 *
 * 받침 판정은 발음으로 한다. 글자 모양이 아니라 읽는 소리가 조사를 정한다 —
 * `W홀`은 한글이 아니지만 `더블유`로 읽으니 받침이 없다.
 */

/** 숫자를 한국어로 읽었을 때 받침이 있는가. 영·일·삼·육·칠·팔에 있다. */
const DIGITS_WITH_FINAL = new Set(['0', '1', '3', '6', '7', '8']);

/**
 * 알파벳을 이름으로 읽었을 때 받침이 있는가.
 *
 * 엘·엠·엔·알 넷뿐이다. 나머지는 에이·비·씨처럼 모음으로 끝난다.
 */
const LETTERS_WITH_FINAL = new Set(['l', 'm', 'n', 'r']);

const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
/** 한글 한 글자는 초성×21×28 + 중성×28 + 종성으로 배열돼 있다. */
const FINAL_COUNT = 28;

/**
 * 마지막 글자에 받침이 있는가.
 *
 * 판정할 수 없는 글자(기호·공백만 남은 경우)는 **받침 없음**으로 본다. 둘 중
 * 하나는 골라야 하고, `를`·`가`·`는` 쪽이 어느 이름 뒤에 붙어도 덜 어색하다.
 */
export function hasFinalConsonant(word: string): boolean {
  const trimmed = word.trim();
  const last = [...trimmed].at(-1);

  if (last === undefined) return false;

  const code = last.codePointAt(0)!;

  if (code >= HANGUL_FIRST && code <= HANGUL_LAST) {
    return (code - HANGUL_FIRST) % FINAL_COUNT !== 0;
  }

  if (DIGITS_WITH_FINAL.has(last)) return true;
  if (/[0-9]/.test(last)) return false;

  return LETTERS_WITH_FINAL.has(last.toLowerCase());
}

/**
 * 조사 짝. 앞이 받침 있을 때, 뒤가 없을 때 쓴다.
 *
 * `으로/로`는 예외가 하나 있다. `ㄹ` 받침은 `로`를 쓴다 — `서울로`지 `서울으로`가
 * 아니다. 그 예외를 `particle`이 안다.
 */
export const PARTICLES = {
  을를: ['을', '를'],
  이가: ['이', '가'],
  은는: ['은', '는'],
  와과: ['과', '와'],
  으로로: ['으로', '로'],
} as const satisfies Record<string, readonly [string, string]>;

export type ParticlePair = keyof typeof PARTICLES;

/** 마지막 글자의 종성 번호. 한글이 아니면 null. `ㄹ`은 8이다. */
function finalIndex(word: string): number | null {
  const last = [...word.trim()].at(-1);

  if (last === undefined) return null;

  const code = last.codePointAt(0)!;

  if (code < HANGUL_FIRST || code > HANGUL_LAST) return null;

  return (code - HANGUL_FIRST) % FINAL_COUNT;
}

/** ㄹ 종성 번호. */
const FINAL_RIEUL = 8;

/** 이 말 뒤에 붙일 조사. */
export function particle(word: string, pair: ParticlePair): string {
  const [withFinal, withoutFinal] = PARTICLES[pair];

  if (!hasFinalConsonant(word)) return withoutFinal;

  // ㄹ 받침은 `로`를 쓴다. `서울로`지 `서울으로`가 아니다.
  if (pair === '으로로' && finalIndex(word) === FINAL_RIEUL) return withoutFinal;

  return withFinal;
}

/** 말과 조사를 붙여서. `withParticle('청담', '을를')`은 `청담을`이다. */
export function withParticle(word: string, pair: ParticlePair): string {
  return `${word}${particle(word, pair)}`;
}
