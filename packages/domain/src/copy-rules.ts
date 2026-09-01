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
  /*
   * 최종통합정책 v2.0 J장: 사용자 노출 문구에서 `표본` 대신 `데이터`를 쓴다.
   *
   * 통계 용어로는 정확한 말이지만, 화면에서 읽는 사람에게는 그렇지 않다 —
   * "표본이 모자랍니다"는 우리가 무엇을 못 하는지가 아니라 우리가 무슨 말을
   * 하는지를 모르게 만든다. 주석과 변수명은 검사 대상이 아니라 그대로 둔다.
   */
  '표본',
  '진짜 가격',
  '적정가',
  '적정 가격',
  '적정한 가격',
  '정확한 가격',
  '바가지',
  '비싼 편',
  '싼 편',

  /*
   * 통합정책 v3.1 §11이 더한 것들.
   *
   * 앞의 넷은 **우리가 계산하지 않는 값의 이름**이다. 기준금액은 중앙값이지
   * 평균이 아니고, 대표가격은 우리가 정한 값처럼 들린다. 이름을 잘못 붙이면
   * 읽는 사람은 그 이름이 뜻하는 계산을 했다고 믿는다.
   *
   * `저렴`·`비쌈`은 판정이다 — 우리는 데이터 차이를 설명하고 계약의 좋고
   * 나쁨은 판정하지 않는다(정책 보강 13).
   */
  '평균가',
  '대표가격',
  '최저가',
  '저렴',
  '비쌈',

  /*
   * 값매김. 웨딩픽은 데이터를 보여주고 **사용자가 판단한다.**
   *
   * `예산을 아끼고 싶을 때 맞아요` 같은 말은 데이터가 아니라 우리의 권유다.
   * 같은 자리에 적을 수 있는 사실이 있다 — `확인된 금액 범위가 세 후보 중 가장
   * 낮아요`. 앞은 우리가 대신 골라준 것이고 뒤는 사용자가 고를 재료다.
   *
   * `낮은 편`·`높은 편`은 남긴다. 그건 값매김이 아니라 분포에서의 자리다.
   */
  '아끼고 싶을 때',
  '가성비',
  '합리적인 가격',
  '추천드려요',
  '추천합니다',
  '이 업체를 고르세요',
] as const;

/** 그 자리에 대신 쓰는 말. */
export const PREFERRED_PHRASES = [
  '데이터',
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
  '확인된 정보',
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

/**
 * 애매모호 표현 금지. 정책 원칙(2026-08-31).
 *
 * **인간 언어의 편리한 도피처를 닫는다.** `거의 완성`은 46%일 수도 91%일 수도
 * 있고, 적은 사람은 둘 다 아니라고 말하지 않았다. 읽는 사람은 자기 형편에 맞는
 * 쪽으로 읽고, 나중에 어긋나면 아무도 틀린 말을 하지 않았다는 결론이 난다.
 *
 * UI·정책서·기획서·관리자·AI 생성 콘텐츠에 모두 적용한다.
 */
export const VAGUE_PHRASES = [
  '거의',
  '아마도',
  '아마',
  '대략',
  '어느 정도',
  '가능성이 높',
  '것으로 보임',
  '것으로 보인다',
] as const;

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
