import { withSubject } from './korean';
import { PRICING_POLICY } from './policy';
import type { VerificationLevel } from './verification';

/**
 * 결제인증 제보.
 *
 * 사업계획서 v3 6번. 계약서 원본 업로드가 P1에서 빠진 자리를 결제내역이 메운다 —
 * 결제문자·카드영수증에는 계약 조건이 없어 비밀유지 조항이 걸리지 않는다.
 *
 * **이것은 심사가 아니라 등록이다.** 인증 심사(verification.ts)와 다르다: 사람이
 * 보지 않고, 문서 등급을 올리지 않으며, 시장 대표가격에도 들어가지 않는다. 하는
 * 일은 둘이다 — 이 사람이 그 업체에 돈을 냈다는 표시, 그리고 실제 결제 분포를 볼
 * 자격(Level 3 Unlock).
 */

export const PAYMENT_METHODS = ['card', 'transfer', 'cash', 'unknown'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  card: '카드',
  transfer: '계좌이체',
  cash: '현금',
  unknown: '확인 안 됨',
};

/**
 * 이미지에 있었던 식별정보의 종류. **값이 아니라 종류다.**
 *
 * 화면데이터구조 스펙 8.2 — 카드번호와 승인번호는 구조화 추출 뒤 값을 저장하지
 * 않는다. 8.4 — 가족카드 명의자 같은 남의 이름은 애초에 추출 대상이 아니다.
 *
 * 목록을 여기 두는 것은 스키마의 enum과 짝이 맞아야 하기 때문이다. 스키마 쪽이
 * enum인 것이 요점이다 — 문자열 배열이었다면 언젠가 누가 카드번호를 넣는다.
 */
export const MASKED_IDENTIFIER_KINDS = [
  'card_number',
  'approval_number',
  'person_name',
  'phone',
  'account_number',
] as const;

export type MaskedIdentifierKind = (typeof MASKED_IDENTIFIER_KINDS)[number];

export const MASKED_IDENTIFIER_LABEL: Record<MaskedIdentifierKind, string> = {
  card_number: '카드번호',
  approval_number: '승인번호',
  person_name: '이름',
  phone: '전화번호',
  account_number: '계좌번호',
};

/**
 * 원본 이미지를 얼마나 들고 있는가. **화면데이터구조 스펙 8.3이 정한 값이다.**
 *
 * 0018이 정한 30일과 다른 이유는 두 값이 다른 것을 재기 때문이다. 30일은 사람이
 * 심사할 시간이고 — 심사자가 원본을 다시 볼 수 있어야 한다 — 24시간은 카드번호가
 * 찍힌 이미지를 들고 있지 않겠다는 값이다. 결제인증에는 심사가 없으니 길게 잡을
 * 이유가 없다.
 */
export const PAYMENT_PROOF_RETENTION_HOURS = 24;

/** 촬영 화면과 동의 화면이 그대로 보여주는 말. 스펙 8.3이 문구까지 정해뒀다. */
export const PAYMENT_PROOF_RETENTION_NOTICE =
  '촬영한 이미지는 정보를 읽어내는 데만 사용되고, 분석이 끝나면 24시간 내 자동 삭제됩니다. 서버에는 금액·날짜 같은 정리된 정보만 남습니다.';

/**
 * 동의받을 때 무엇을 말해야 하는가.
 *
 * 스펙 8.1 — 포괄 동의("결제 정보를 수집합니다")는 동의가 아니다. 무엇을 가져가고
 * 무엇을 버리는지 적지 않으면, 동의한 사람도 자기가 무엇에 동의했는지 모른다.
 */
export const PAYMENT_PROOF_CONSENT_POINTS = [
  '읽어가는 것: 가맹점 이름, 금액, 낸 날짜와 시각, 지불 수단',
  '이미지에 카드번호 일부나 승인번호가 함께 찍힐 수 있습니다',
  '그 번호들은 있었다는 것만 남기고 값은 저장하지 않습니다',
  '쓰는 곳: Pick 인증 표시와 Pick 가격대 (가격대는 여럿을 묶은 중앙값으로만 보입니다)',
  PAYMENT_PROOF_RETENTION_NOTICE,
] as const;

/**
 * 지금 받고 있는 동의문의 판.
 *
 * **문구가 바뀌면 이 값도 올린다.** 안내가 바뀌면 이전 동의는 다른 것에 대한
 * 동의이고, 판을 남기지 않으면 "이 사람이 무엇에 동의했는지"에 답할 수 없다.
 */
export const PAYMENT_CONSENT_VERSION = '2026-08-29';

/** 철회하면 하는 말. 이미 낸 자료가 어떻게 되는지 함께 말한다. */
export const PAYMENT_CONSENT_REVOKED_NOTICE =
  '동의를 철회했어요. 앞으로는 Pick 인증을 할 수 없고, 이미 올린 자료는 내 제보내역에서 지울 수 있어요';

export type PaymentProofDraft = {
  merchantName: string;
  paidAmount: number;
  /** ISO 8601 */
  paidAt: string;
};

export type PaymentProofCheck = { ok: true } | { ok: false; reason: string };

/** 너무 작거나 큰 값은 읽기 실패다. 가격 제보와 같은 범위를 쓴다. */
export const MIN_PAYMENT_AMOUNT = 10_000;
export const MAX_PAYMENT_AMOUNT = 500_000_000;

export function canRegisterPaymentProof(
  draft: PaymentProofDraft,
  now: Date = new Date()
): PaymentProofCheck {
  if (draft.merchantName.trim().length === 0) {
    return { ok: false, reason: '가맹점 이름을 읽지 못했습니다. 다시 찍어주세요.' };
  }

  if (!Number.isInteger(draft.paidAmount) || draft.paidAmount < MIN_PAYMENT_AMOUNT) {
    return { ok: false, reason: '금액을 읽지 못했습니다. 다시 찍어주세요.' };
  }

  if (draft.paidAmount > MAX_PAYMENT_AMOUNT) {
    return { ok: false, reason: '금액이 너무 큽니다. 잘못 읽은 것 같습니다.' };
  }

  const paidAt = new Date(draft.paidAt);

  if (Number.isNaN(paidAt.getTime())) {
    return { ok: false, reason: '낸 날짜를 읽지 못했어요. 다시 찍어주세요.' };
  }

  // 앞으로의 결제는 없다. 날짜를 잘못 읽은 것이다.
  if (paidAt.getTime() > now.getTime()) {
    return { ok: false, reason: '낸 날짜가 오늘보다 뒤예요. 잘못 읽은 것 같아요.' };
  }

  return { ok: true };
}

/**
 * 결제인증이 문서 등급을 올리는가. **올리지 않는다.**
 *
 * 함수로 두는 이유는 이 질문이 나중에 반드시 다시 나오기 때문이다. "결제내역도
 * 증빙인데 왜 등급이 안 오르지?" — 사람이 보지 않았기 때문이다. 서비스정책서 7번의
 * 자동승인 금지는 등록 경로가 생겼다고 느슨해지지 않는다.
 */
export function raisesVerificationLevel(): false {
  return false;
}

/**
 * 결제인증과 계약 중앙값을 한 숫자로 합칠 수 있는가. **없다.**
 *
 * 서비스정책서 2번은 시장 대표가격의 근거를 L2 이상으로 못박았다. 결제인증에는
 * 그 근거가 없다. 수기 제보와 같은 이유로 자리를 따로 둔다 — 다만 결제인증은
 * 이미지라도 있으니 수기 제보와도 다른 자리다. 셋이다.
 */
export function canMergeWithMarketPrice(): false {
  return false;
}

/** 확인된 정보 분포에 늘 붙는 말. 내부에서는 결제인증이라 부르는 그것이다. */
export const PAYMENT_PROOF_CAVEAT =
  'Pick 가격은 이용자가 올린 자료에서 읽은 금액이에요. 계약 전체 금액이 아니라 그때 낸 금액이며, 사람이 확인한 계약 중앙값과는 다른 값이에요.';

/**
 * 결제인증만으로 후기를 어디까지 확인해 줄 수 있는가.
 *
 * 결제인증이 있으면 그 사람이 그 업체에 돈을 낸 것은 사실이다 — 후기의 "실제로
 * 이용했다"에는 그것으로 충분하다. 심사를 통과한 계약 문서보다는 약한 확인이라
 * 배지를 나눠 붙인다.
 */
export function reviewVerificationFromPaymentProof(): 'payment' {
  return 'payment';
}

/** 결제인증은 등급을 올리지 않으므로, 어떤 등급도 이 경로로 나오지 않는다. */
export const PAYMENT_PROOF_LEVEL: VerificationLevel | null = null;

