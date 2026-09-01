/**
 * Pick 인증 — 사용자 앱이 쓰는 말. 통합정책 v3.13 §O.
 *
 * v3.11이 사용자 앱 일반 UI에서 `결제`와 그 파생 표현을 전면 금지했고,
 * v3.13이 그 조항을 §O-1로 옮겨 담았다.
 * `결제`·`결제정보`·`결제금액`·`결제가`·`실제 결제`·`실제 결제 데이터`·
 * `결제 데이터`·`결제인증` 전부다.
 *
 * **단순 치환이 아니다.** 정책이 그것도 못박았다 — 화면마다 무엇을 말하는
 * 자리인지가 다르다.
 *
 *   - 무엇을 확인하는 **절차**인가 → `Pick 인증`
 *   - 그 절차로 확인한 **금액 하나**인가 → `Pick 가격`
 *   - 그 절차로 확인한 **금액의 폭**인가 → `Pick 가격대`
 *   - 사용자가 **올리는 자료**인가 → `Pick 인증 자료`
 *
 * 안에서는 그대로 `payment_proof`다. DB·API·관리자·개발문서는 정확한 기술용어를
 * 쓴다(§O-1 내부 영역). 바꾸는 것은 화면에 나가는 말이다.
 *
 * 예외도 정책이 정했다: 약관, 개인정보처리방침, FAQ, 고객지원, 분쟁·법적 고지처럼
 * **사실관계를 정확히 설명해야 하는 자리**에서는 `결제`를 쓸 수 있다. 그 자리에서
 * `Pick 인증`이라고만 적으면 무엇에 동의하는지 알 수 없게 된다.
 */

export const PICK_VERIFICATION = {
  /** 절차 이름. 배지·버튼·상태에 이 말이 나간다. */
  name: 'Pick 인증',
  /** 그 절차로 확인한 금액 하나. */
  price: 'Pick 가격',
  /** 확인된 금액의 폭. */
  priceRange: 'Pick 가격대',
  /** 사용자가 올리는 것. */
  material: 'Pick 인증 자료',
  /** 올리는 행동. */
  submit: 'Pick 인증하기',
  /** 확인이 끝난 상태. 배지라 띄어쓰지 않는다. */
  verifiedBadge: 'Pick확인',
} as const;

/**
 * 사용자 앱 일반 UI에서 쓸 수 없는 말.
 *
 * 파생까지 막는다 — `결제`를 막고 `결제금액`을 두면 금지의 뜻이 사라진다.
 * 긴 것부터 적어두어 검사 결과가 가장 긴 위반을 먼저 짚는다.
 */
export const FORBIDDEN_PAYMENT_WORDS = [
  '실제 결제 데이터',
  '실제 결제',
  '결제 데이터',
  '결제내역',
  '결제인증',
  '결제정보',
  '결제금액',
  '결제 금액',
  '결제가',
  '결제문자',
  '결제 구간',
  '결제 사례',
  '결제 분포',
  '결제완료',
  '결제예정',
  '결제',
] as const;

/**
 * 이 글이 사용자 앱 일반 UI에 나가도 되는가.
 *
 * 예외 영역의 글은 이 함수에 넣지 않는다 — 넣으면 약관이 `결제`라는 말을 못
 * 쓰게 되고, 그때 약관은 무엇에 동의하는지 말할 수 없는 문서가 된다.
 */
export function findPaymentWords(text: string): string[] {
  const found: string[] = [];
  let rest = text;

  for (const word of FORBIDDEN_PAYMENT_WORDS) {
    if (rest.includes(word)) {
      found.push(word);
      /* 긴 말을 찾았으면 그 자리를 지운다. `결제금액`을 `결제`로 두 번 세지 않는다. */
      rest = rest.split(word).join('');
    }
  }

  return found;
}

export function usesPaymentWord(text: string): boolean {
  return findPaymentWords(text).length > 0;
}
