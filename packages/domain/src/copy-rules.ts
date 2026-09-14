/**
 * 화면 문구 규칙.
 *
 * 디자인 핸드오프 카피 규칙 — **우리는 가격의 적정 여부를 판정하지 않는다.**
 * 판정처럼 들리는 말을 쓰면 하지 않는 일을 한다고 말하는 것이 되고, 그건 규칙을
 * 어긴 것보다 나쁘다. 사람들은 문구를 믿고 결정한다.
 *
 * 규칙을 코드에 두는 이유는 문서에만 적어두면 지켜지지 않기 때문이다. 실제로
 * "찍으면, 진짜 가격이 보인다"가 네 곳에 박혀 있었다.
 *
 * **낱말 목록은 코드가 갖지 않는다.** `spec/glossary.json`이 원본이고 이 파일은 그것을
 * 읽어 검사만 한다(CLAUDE.md — 문구는 spec에서만 가져온다).
 */

import glossary from '../../../spec/glossary.json';

/**
 * 금지어 하나.
 *
 * `allow`는 그 낱말을 품고도 그대로 두는 **문구**다. 낱말 단위가 아니라 문장 단위여야
 * 한다 — 「중앙값」을 통째로 풀어주면 「중앙값 168만원」까지 통과하지만, 「실 제보의
 * 중앙값이에요」만 풀어주면 그 한 문장만 지나간다. 이미 승인된 카피만 들어간다.
 *
 * `pending`은 아직 강제하지 않는 항목과 그 이유다. 조용히 빠지는 것을 막으려고
 * 이름을 붙여 둔다 — 테스트가 이 목록을 그대로 확인한다.
 */
type GlossaryEntry = {
  term: string;
  kind?: string;
  allow?: readonly string[];
  pending?: string;
};

const BANNED_ENTRIES: readonly GlossaryEntry[] = glossary.banned;

/** 얼버무림 금지 표시. 판정 금지와 다른 규칙이라 glossary가 항목마다 갈라 둔다. */
const VAGUE = 'vague';

/** 아직 강제하지 않는 항목. 이유는 glossary의 `pending`에 있다. */
export const PENDING_PHRASES: readonly string[] = BANNED_ENTRIES.filter(
  (entry) => entry.pending !== undefined
).map((entry) => entry.term);

/**
 * 화면에 쓰지 않는 말.
 *
 * **목록은 `spec/glossary.json`에 있다.** 여기 옮겨 적지 않는다 — 두 곳에 적으면
 * 한 곳만 고치는 날이 오고, 실제로 그랬다. v3.18과 v3.22가 정한 금지어(`확인된 제보` ·
 * `오늘의 Pick` · `네이버페이 포인트` …)가 이 배열에 한 번도 들어오지 않아, 규칙은
 * 문서에 있는데 게이트는 통과시키고 있었다.
 *
 * `pending`이 달린 항목은 아직 강제하지 않는다. 이유는 그 항목에 적혀 있다.
 * `kind: 'vague'`는 아래 `VAGUE_PHRASES`가 가져간다 — 다른 규칙이라 따로 센다.
 */
export const BANNED_PHRASES: readonly string[] = BANNED_ENTRIES.filter(
  (entry) => entry.pending === undefined && entry.kind !== VAGUE
).map((entry) => entry.term);

/** 그 자리에 대신 쓰는 말. */
export const PREFERRED_PHRASES = [
  '실 제보',
  '가격 차이',
  /*
   * v3.13 §O-1이 사용자 앱에서 `결제`를 막으면서 이 셋도 함께 못 쓰게 됐다. 권장어
   * 자리에 남겨두면 다음 사람이 그대로 갖다 쓴다 — 대신 Pick 언어를 둔다.
   */
  'Pick 가격',
  'Pick 가격대',
  'Pick 인증',
  /** v3.1 §11. 통계는 그대로 중앙값이고 화면에 적는 이름만 바꾼다. */
  '기준금액',
  /** v3.18. 금액은 `제보 금액`, 행동은 `Pick 인증`, 상위 개념은 `실 제보`다. */
  '제보 금액',
] as const;

export type CopyViolation = { phrase: string; index: number };

/**
 * 금지어를 품고 있지만 그대로 두는 말.
 *
 * `공공데이터`는 우리가 고른 낱말이 아니라 **출처의 이름이다**(공공누리·공공데이터포털).
 * `공공정보`로 바꿔 적으면 어느 자료를 쓴 것인지 잘못 적는 셈이고, 출처 표시는
 * 정확해야 하는 자리다(8번). 규칙은 우리가 쓰는 말에만 건다.
 *
 * 이제 이 목록도 glossary가 갖는다 — 각 항목의 `allow`다. `공공데이터`는 `데이터`의,
 * `공정거래위원회`는 `거래`의 allow로 옮겼다.
 */
export const EXEMPT_PHRASES: readonly string[] = BANNED_ENTRIES.flatMap(
  (entry) => entry.allow ?? []
);

/**
 * 라틴 낱말은 낱말 경계까지 봐야 한다.
 *
 * `AI`를 그냥 찾으면 `FAILURE_MESSAGE` · `CLAIM_METHODS` 같은 식별자가 전부 걸린다.
 * 실제로 43건이 걸렸고 그중 화면 문구는 **0건**이었다. 한글 금지어는 이 문제가 없어
 * 라틴 문자·숫자로만 된 낱말에만 경계를 건다.
 */
function isLatinWord(phrase: string): boolean {
  return /^[A-Za-z0-9]+$/.test(phrase);
}

function indexOfPhrase(text: string, phrase: string): number {
  if (!isLatinWord(phrase)) return text.indexOf(phrase);

  return text.search(new RegExp(`(?<![A-Za-z0-9_])${phrase}(?![A-Za-z0-9_])`));
}

/** 예외를 같은 길이의 자리표시자로 덮는다. 덮으면 위치(index)가 흐트러지지 않는다. */
function maskExempt(text: string): string {
  return EXEMPT_PHRASES.reduce(
    (masked, phrase) => masked.split(phrase).join('\u0000'.repeat(phrase.length)),
    text
  );
}

/**
 * 화면에 나갈 문구인가.
 *
 * **주석과 문서는 검사 대상이 아니다.** 규칙 자체를 설명하려면 금지어를 적어야
 * 하고, 그걸 막으면 왜 금지했는지 적을 수 없게 된다.
 */
export function findBannedPhrases(text: string): CopyViolation[] {
  const scanned = maskExempt(text);

  return BANNED_PHRASES.flatMap((phrase) => {
    const index = indexOfPhrase(scanned, phrase);

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

/**
 * 애매모호 표현 금지. 정책 원칙(2026-08-31).
 *
 * **인간 언어의 편리한 도피처를 닫는다.** `거의 완성`은 46%일 수도 91%일 수도
 * 있고, 적은 사람은 둘 다 아니라고 말하지 않았다. 읽는 사람은 자기 형편에 맞는
 * 쪽으로 읽고, 나중에 어긋나면 아무도 틀린 말을 하지 않았다는 결론이 난다.
 *
 * UI·정책서·기획서·관리자·AI 생성 콘텐츠에 모두 적용한다.
 */
export const VAGUE_PHRASES: readonly string[] = BANNED_ENTRIES.filter(
  (entry) => entry.pending === undefined && entry.kind === VAGUE
).map((entry) => entry.term);

/**
 * 그 자리에 대신 쓰는 말.
 *
 * 모르는 것을 아는 척하라는 뜻이 아니다 — **모른다는 것도 상태로 적으라는
 * 뜻이다.** `아마 적용 가능`이 아니라 `현재 검증 전`이다.
 */
export const STATE_WORDS = [
  '확정',
  '미확정',
  '검증 전',
  '확인 필요',
  '조건부',
  '측정값',
  '추정값',
] as const;

export function findVaguePhrases(text: string): CopyViolation[] {
  return VAGUE_PHRASES.flatMap((phrase) => {
    const index = text.indexOf(phrase);

    return index >= 0 ? [{ phrase, index }] : [];
  });
}

export function isVague(text: string): boolean {
  return findVaguePhrases(text).length > 0;
}
