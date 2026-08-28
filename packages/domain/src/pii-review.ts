import { withSubject } from './korean';

/**
 * 개인정보 탐지 재검토.
 *
 * 서비스정책서 4번: "개인정보 탐지 자동화 초기 정확도가 100%가 아니므로, 오픈
 * 초기엔 사람 재검토 1단계 유지."
 *
 * 무엇을 지키려는 것인가. 문서를 읽는 쪽은 개인정보의 **값**을 옮기지 않고 종류만
 * 적도록 되어 있다. 그런데 그건 지시일 뿐 보장이 아니다. 특히 계약조건은 원문
 * 그대로 옮기라고 되어 있어(터미네이션 조항에 이름이나 연락처가 섞여 있으면 그대로
 * 따라 들어온다), 새어 들어올 자리가 분명히 있다.
 *
 * 그래서 사람이 한 번 본다. 본 뒤에야 그 문서의 값이 **남들이 보는 면**으로 갈 수
 * 있다 — 시장 대표가격, 업체 페이지, 비교표. 본인이 자기 계약서를 자기 화면에서
 * 보는 것은 유출이 아니므로 그건 막지 않는다.
 */

/** 문서에서 나올 수 있는 개인정보 종류. DB·추출 스키마와 같은 목록이다. */
export const PERSONAL_INFO_KINDS = [
  'name',
  'phone',
  'address',
  'resident_number',
  'signature',
  'email',
  'account',
] as const;

export type PersonalInfoKind = (typeof PERSONAL_INFO_KINDS)[number];

export const PERSONAL_INFO_LABEL: Record<PersonalInfoKind, string> = {
  name: '이름',
  phone: '연락처',
  address: '주소',
  resident_number: '주민번호',
  signature: '서명',
  email: '이메일',
  account: '계좌',
};

export function personalInfoLabel(kind: string): string {
  return PERSONAL_INFO_LABEL[kind as PersonalInfoKind] ?? kind;
}

/**
 * 구조화 데이터에서 개인정보가 새어 들어올 수 있는 자리.
 *
 * 금액·날짜·인원수는 숫자라 새어 들어올 자리가 아니다. 사람이 봐야 하는 것은
 * 문서에서 **글자를 그대로 옮겨온** 필드다.
 */
export const REVIEWABLE_FIELDS = [
  'vendorNameRaw',
  'plannerName',
  'productName',
  'hallName',
  'contractTerms',
] as const;

export type ReviewableField = (typeof REVIEWABLE_FIELDS)[number];

export const REVIEWABLE_FIELD_LABEL: Record<ReviewableField, string> = {
  vendorNameRaw: '업체명',
  plannerName: '플래너 이름',
  productName: '상품명',
  hallName: '홀 이름',
  contractTerms: '계약조건 원문',
};

/**
 * 눈에 띄는 개인정보 꼴.
 *
 * 사람을 대신하는 것이 아니라 **거들 뿐이다.** 여기 걸리지 않았다고 깨끗한 것이
 * 아니고(이름은 형태로 잡을 수 없다), 걸렸다고 반드시 개인정보인 것도 아니다
 * (계좌번호처럼 보이는 상품 코드가 있다). 검토 화면에서 "여기 좀 보라"고
 * 가리키는 용도다.
 *
 * 값을 옮겨 담지 않는다 — 어떤 종류가 어느 필드에서 보이는지만 돌려준다.
 */
export type PiiHint = { field: ReviewableField; kind: PersonalInfoKind };

const PATTERNS: { kind: PersonalInfoKind; pattern: RegExp }[] = [
  // 010-1234-5678, 02-123-4567, +82 10 1234 5678
  { kind: 'phone', pattern: /(?:\+?82[-\s]?)?0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}/ },
  // 900101-1234567
  { kind: 'resident_number', pattern: /\d{6}[-\s]?[1-4]\d{6}/ },
  { kind: 'email', pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/ },
  // 은행 계좌로 읽히는 숫자 묶음. 금액과 헷갈리지 않게 구분자를 요구한다.
  { kind: 'account', pattern: /\d{2,6}-\d{2,6}-\d{2,8}/ },
];

export function findPiiHints(fields: Partial<Record<ReviewableField, string>>): PiiHint[] {
  const hints: PiiHint[] = [];

  for (const field of REVIEWABLE_FIELDS) {
    const text = fields[field];

    if (!text) continue;

    for (const { kind, pattern } of PATTERNS) {
      if (pattern.test(text)) hints.push({ field, kind });
    }
  }

  return hints;
}

/** 재검토 상태. */
export const PII_REVIEW_STATUSES = ['pending', 'clean', 'redacted'] as const;

export type PiiReviewStatus = (typeof PII_REVIEW_STATUSES)[number];

export const PII_REVIEW_STATUS_LABEL: Record<PiiReviewStatus, string> = {
  pending: '검토 전',
  clean: '개인정보 없음 확인',
  redacted: '지우고 확인',
};

/** 사람이 봤는가. 봤어야 남들이 보는 면으로 갈 수 있다. */
export function isReviewed(status: PiiReviewStatus): boolean {
  return status !== 'pending';
}

/**
 * 이 문서의 값을 남들이 보는 면(시장 대표가격 등)에 넣어도 되는가.
 *
 * 등급만으로 판단하던 것에 재검토를 더한다. 등급은 "이 금액이 진짜인가"를 보고,
 * 재검토는 "이 안에 남의 개인정보가 섞여 있지 않은가"를 본다. 서로 다른 질문이라
 * 둘 다 통과해야 한다.
 */
export type ShareCheck = { ok: true } | { ok: false; reason: string };

export function canShare(input: {
  piiReview: PiiReviewStatus;
  affectsMarketPrice: boolean;
}): ShareCheck {
  if (!input.affectsMarketPrice) {
    return { ok: false, reason: '계약인증 이상이 아닙니다.' };
  }

  if (!isReviewed(input.piiReview)) {
    return { ok: false, reason: '개인정보 재검토를 아직 받지 않았습니다.' };
  }

  return { ok: true };
}

/** 검토자에게 보여줄 한 줄. */
export function reviewSummary(input: {
  detectedKinds: readonly string[];
  hintCount: number;
}): string {
  const detected =
    input.detectedKinds.length === 0
      ? '탐지된 개인정보 없음'
      : `탐지: ${input.detectedKinds.map(personalInfoLabel).join(', ')}`;

  if (input.hintCount === 0) return detected;

  // '1곳가'가 되지 않도록 조사는 앞말을 보고 고른다.
  return `${detected} · 구조화 데이터에서 ${withSubject(`${input.hintCount}곳`)} 눈에 띔`;
}
