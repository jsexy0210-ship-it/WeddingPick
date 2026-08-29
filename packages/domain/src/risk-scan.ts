/**
 * 자유 글에 섞인 위험정보 찾기. 최종통합정책 v2.0 K-3, 원문 24번.
 *
 * 원문 24번이 **즉시 임시숨김할 수 있는 것**을 정했다: 전화번호, 계좌번호,
 * 주민등록번호, 상세 개인정보, 명백한 불법 콘텐츠. 그중 **숫자로 된 것은 규칙으로
 * 잡힌다** — 모델을 부를 일이 아니다(A-3: 규칙 먼저).
 *
 * 반대로 **이름은 여기서 잡지 않는다.** 0020이 적어둔 그대로다 — 한국어 성은
 * 형태로 잡히지 않아, 기계로 거르려 하면 멀쩡한 글이 걸리거나 진짜가 빠져나간다.
 * 이름은 신고와 사람의 몫으로 남긴다.
 *
 * **찾은 값을 돌려주지 않는다. 종류만 돌려준다.** 추출규칙 10번과 같은 규칙이고,
 * 여기서 값을 돌려주면 그 값이 로그와 알림을 타고 번진다.
 */

export const RISK_KINDS = [
  'resident_registration_number',
  'phone_number',
  'account_number',
  'card_number',
  'email',
] as const;

export type RiskKind = (typeof RISK_KINDS)[number];

export const RISK_KIND_LABEL: Record<RiskKind, string> = {
  resident_registration_number: '주민등록번호',
  phone_number: '전화번호',
  account_number: '계좌번호',
  card_number: '카드번호',
  email: '이메일 주소',
};

/** 날짜는 계좌번호가 아니다. `2026-08-29`가 자릿수만으로는 계좌처럼 보인다. */
const LOOKS_LIKE_DATE = /^(19|20)\d{2}[-.](0?[1-9]|1[0-2])[-.](0?[1-9]|[12]\d|3[01])$/;

/** 숫자만 남겼을 때 몇 자 이상이어야 계좌로 볼 것인가. 국내 계좌는 10~14자다. */
const ACCOUNT_MIN_DIGITS = 10;

const PATTERNS: { kind: RiskKind; regex: RegExp; accept?: (match: string) => boolean }[] = [
  {
    kind: 'resident_registration_number',
    // 뒷자리 첫 숫자는 1~4(1900·2000년대 내·외국인)다. 이 제약이 오탐을 크게 줄인다.
    regex: /\b\d{6}\s?[-–]\s?[1-4]\d{6}\b/g,
  },
  {
    kind: 'card_number',
    regex: /\b\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}\b/g,
  },
  {
    kind: 'phone_number',
    // 휴대전화. 0으로 시작하는 것만 본다 — 금액이나 날짜가 걸리지 않게.
    regex: /\b01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}\b/g,
  },
  {
    kind: 'phone_number',
    // 지역번호·대표번호. 02는 국번이 짧다.
    regex: /\b0(2|[3-6][1-5]|70|50\d)[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g,
  },
  {
    kind: 'account_number',
    // 은행 이름이 앞에 붙으면 자릿수가 조금 모자라도 계좌다. 전화보다 먼저 본다.
    regex: /(국민|신한|우리|하나|기업|농협|카카오뱅크|케이뱅크|토스뱅크|새마을|우체국)\s*(은행)?\s*\d[\d-]{8,}/g,
  },
  {
    kind: 'account_number',
    regex: /\b\d{2,6}[-–]\d{2,6}[-–]\d{2,8}\b/g,
    /*
     * 날짜를 계좌로 읽지 않는다. "2026-08-29에 계약했어요"는 흔한 문장이고,
     * 이걸 계좌로 잡으면 멀쩡한 후기가 숨겨진다.
     */
    accept: (match) =>
      !LOOKS_LIKE_DATE.test(match) && match.replace(/\D/g, '').length >= ACCOUNT_MIN_DIGITS,
  },
  {
    kind: 'email',
    regex: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,
  },
];

/**
 * 무엇이 들어 있는가. **종류만 돌려준다.**
 *
 * 빈 배열이면 위험정보를 못 찾았다는 뜻이지, 없다는 뜻이 아니다 — 이름처럼 규칙이
 * 잡지 못하는 것이 있다. 그래서 이 함수가 통과시킨 글도 신고를 받는다.
 *
 * **잡은 자리는 지우고 다음으로 넘긴다.** 결제문자 파서에서 배운 것이다 — 안 그러면
 * `010-1234-5678`이 전화번호이면서 동시에 계좌번호로 잡히고, 화면은
 * "전화번호 · 계좌번호로 보이는 내용이 있어요"라고 틀린 말을 하게 된다. 가리는
 * 판단은 어차피 같지만, 사람에게 하는 말은 맞아야 한다.
 *
 * 순서가 곧 우선순위다: 형태가 뚜렷한 것(주민번호·카드·전화)이 먼저 가져가고,
 * 넓게 잡히는 계좌번호가 마지막에 남은 것을 본다.
 */
export function scanForRisk(text: string): RiskKind[] {
  const found = new Set<RiskKind>();
  let rest = text;

  for (const pattern of PATTERNS) {
    // 전역 정규식은 lastIndex를 들고 다닌다. 매번 새로 만들어 상태를 남기지 않는다.
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);

    rest = rest.replace(regex, (match) => {
      if (pattern.accept && !pattern.accept(match)) return match;

      found.add(pattern.kind);

      // 숫자가 남지 않게 지운다. 길이를 맞출 이유는 없다 — 자리만 비우면 된다.
      return ' ';
    });
  }

  return RISK_KINDS.filter((kind) => found.has(kind));
}

/**
 * 이 글을 바로 가려야 하는가. 원문 24번의 "명백한 위험정보".
 *
 * **부정적인 후기라는 이유만으로는 가리지 않는다**(원문 24번). 여기서 참이 되는
 * 유일한 길은 위 다섯 가지가 글에 실제로 들어 있는 경우다.
 */
export function shouldHideImmediately(text: string): boolean {
  return scanForRisk(text).length > 0;
}

/**
 * 쓰는 사람에게 하는 말. **값을 되읽어주지 않는다.**
 *
 * "01012345678이 들어 있어요"라고 적으면, 지우라고 말하면서 한 번 더 적는 셈이 된다.
 */
export function riskNotice(kinds: readonly RiskKind[]): string {
  const names = kinds.map((kind) => RISK_KIND_LABEL[kind]).join(' · ');

  return `${names}로 보이는 내용이 있어요. 지우고 다시 올려주세요`;
}

/** 이미 올라간 글을 가렸을 때 쓰는 이유 코드. 결정 기록이 이걸 센다. */
export const RISK_REASON_CODE = 'risk_info_detected';
