import type { VerificationLevel } from './verification';
import type { SourceType } from './vendor';

/**
 * 문서 종류. 사업계획서 2번이 말하는 가격 단계와 같은 순서다.
 *
 * 공식가격 → 최초견적 → 가계약 → 변경견적 → 본계약 → 추가금 → 최종지출
 *
 * 최초 견적과 최종 지출이 어긋나는 것이 이 서비스가 다루는 문제이므로, 이 단계를
 * 뭉뚱그리지 않는다.
 */
export const DOCUMENT_TYPES = [
  'official_price',
  'quote',
  'pre_contract',
  'revised_quote',
  'contract',
  'additional_charge',
  'final_payment',
  /** AI 문서분류 전이거나 분류에 실패한 상태 */
  'unknown',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * 화면에 쓰는 이름. 코드를 그대로 보여주지 않는다.
 *
 * v3.13 §O-10이 사용자 UI에서 `견적`을 막았다. 이 표는 **어느 단계의 금액인지**를
 * 적는 자리라, 자료 이름 대신 그 단계의 이름을 쓴다 — 사용자가 알고 싶은 것은
 * 그 숫자가 처음 받은 값인지 바뀐 값인지지, 종이 이름이 아니다.
 */
export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  official_price: '공식가격',
  quote: '첫 안내금액',
  pre_contract: '가계약',
  revised_quote: '변경금액',
  contract: '계약',
  additional_charge: '추가금',
  final_payment: '최종지출',
  unknown: '분류 전',
};

/** 견적서에 적힌 항목이 값에 포함되는지, 별도인지, 나중에 붙을 수 있는지. */
export type LineItemKind = 'included' | 'excluded' | 'additional_candidate';

export type QuoteLineItem = {
  id: string;
  kind: LineItemKind;
  label: string;
  amount: number | null;
  note?: string;
};

export type ContractTermCategory = 'cancellation' | 'refund' | 'penalty' | 'schedule' | 'other';

export type ContractTerm = {
  id: string;
  category: ContractTermCategory;
  text: string;
  /** 사용자가 특히 확인해야 할 조건으로 표시할지 */
  flagged: boolean;
};

/**
 * AI가 뽑아낸 값 하나와 그 신뢰도.
 *
 * 신뢰도가 낮은 항목은 숨기지 않고 "확인 필요"로 드러낸다(서비스정책서 1번). 핵심 필드는
 * 사용자 확인을 거치기 전에는 비교·저장에 쓰지 않는다.
 */
export type ExtractionField<T = string | number> = {
  path: string;
  value: T;
  /** 0~1 */
  confidence: number;
  confirmedByUser: boolean;
  correctedValue?: T;
};

/** 사용자 확인 없이는 비교·저장에 반영하지 않는 필드들. 서비스정책서 1번. */
export const FIELDS_REQUIRING_CONFIRMATION = ['totalAmount', 'contractDate', 'refundTerms'] as const;

/**
 * 이 아래로는 "확인 필요"로 드러낸다. 서비스정책서 1번.
 *
 * 핵심 필드(위)는 신뢰도와 무관하게 확인을 거친다. 이건 다른 이야기다 —
 * 핵심이 아닌 항목이라도 **흐릿하게 읽은 값을 아무 표시 없이 보여주면 안 된다**.
 * 실제 계약서 사진으로 시험해 보면 접힌 자리·손글씨·역광 때문에 예식일이나 홀
 * 이름을 확신 못 하는 일이 흔하다. 그 값이 맞는 것처럼 나가면 사용자는 틀린
 * 것을 그대로 믿는다.
 *
 * **잠정값이다.** 서비스정책서의 "개인정보 탐지 정확도 목표치 및 수동 검토 전환
 * 기준"이 정해지면 그와 함께 맞춰야 한다. 0.7은 실제 문서 몇 건을 읽어보고
 * 고른 값이지 측정해서 나온 값이 아니다.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

/** 이 항목을 "확인 필요"로 드러내야 하는가. */
export function needsAttention(field: {
  requiresConfirmation: boolean;
  confirmedByUser: boolean;
  confidence: number;
}): boolean {
  if (field.confirmedByUser) return false;

  return field.requiresConfirmation || field.confidence < LOW_CONFIDENCE_THRESHOLD;
}

/**
 * 분석이 끝난 문서 하나. 명세 3.2의 Quote.
 *
 * rawDocumentId는 원본이 자동삭제되면 끊긴다 — 원본은 핵심 자산이 아니고 구조화된
 * 데이터가 핵심이다(사업계획서 28번).
 */
export type Quote = {
  id: string;
  weddingId: string;
  rawDocumentId: string | null;
  docType: DocumentType;
  vendorId: string | null;
  plannerId: string | null;
  productName: string | null;
  totalAmount: number | null;
  discountAmount: number | null;
  /** ISO 8601 날짜 */
  contractDate: string | null;
  verificationLevel: VerificationLevel;
  source: SourceType;
  lineItems: QuoteLineItem[];
  terms: ContractTerm[];
  createdAt: string;
  /** 사용자 확인 단계를 통과한 시각. 통과 전에는 비교에 쓰지 않는다. */
  confirmedAt: string | null;
};

/** 사용자 확인이 필요한 핵심 필드가 아직 남아 있는지. */
export function needsUserConfirmation(fields: ExtractionField[]): boolean {
  return fields.some(
    (field) =>
      (FIELDS_REQUIRING_CONFIRMATION as readonly string[]).includes(field.path) &&
      !field.confirmedByUser
  );
}

/** 비교·통계에 넣어도 되는 문서인지. 확인 안 된 문서는 어떤 계산에도 들어가지 않는다. */
export function isConfirmed(quote: Quote): boolean {
  return quote.confirmedAt !== null;
}

/* ── 견적서 동의(경로 A) ─────────────────────────────────────────────────
 *
 * 결제 증빙(`payment-proof.ts`)에는 동의 화면도 서버 기록도 있는데 **견적서
 * 경로에는 둘 다 없었다**(Release Audit 1차 P0-5, 2026-09-09). 견적서 원본도
 * 결제 증빙과 똑같이 외부 서비스로 나가고, 안에는 이름 · 예식일 · 업체명 ·
 * 금액이 적혀 있다. 한쪽만 묻고 있었던 것은 정책이 아니라 누락이다.
 *
 * 결제 증빙 쪽과 같은 모양으로 맞춘다 — 항목을 하나씩 체크하고, 동의를 서버에
 * 남기고, 그 기록이 없으면 업로드 자체가 통과하지 않는다.
 */

/** 견적서 원본을 며칠 안에 지우는가. 결제 증빙과 달리 검증이 끝난 날부터 센다(0022). */
export const DOCUMENT_RETENTION_NOTICE =
  '올린 원본은 금액을 읽어내는 데만 쓰고, 정리가 끝나면 지워요. 서버에는 업체와 금액 같은 정리된 정보만 남아요.';

/**
 * 견적서를 올리기 전에 무엇을 말해야 하는가.
 *
 * 포괄 동의는 동의가 아니다. **국외로 나간다는 사실을 빼지 않는다** — 문서를
 * 읽는 일은 국내에서 끝나지 않고, 그걸 적지 않으면 동의받은 내용과 실제로 하는
 * 일이 갈라진다(개인정보 보호법 제28조의8).
 */
export const DOCUMENT_CONSENT_POINTS = [
  '읽어가는 것: 업체 이름, 항목별 금액, 합계',
  '문서에 이름 · 예식일 · 연락처가 함께 적혀 있을 수 있어요',
  '문서를 읽어내는 일은 국외의 외부 서비스가 맡아요',
  '쓰는 곳: 내 견적 정리와 Pick 가격대 (가격대는 여럿을 묶은 중앙값으로만 보여요)', // pick-language: 받는 서류 이름
  DOCUMENT_RETENTION_NOTICE,
] as const;

/**
 * 지금 받고 있는 동의문의 판.
 *
 * **문구가 바뀌면 이 값도 올린다.** 안내가 바뀌면 이전 동의는 다른 것에 대한
 * 동의이고, 판을 남기지 않으면 "이 사람이 무엇에 동의했는지"에 답할 수 없다.
 */
export const DOCUMENT_CONSENT_VERSION = '2026-09-09';

/** 철회하면 하는 말. 이미 낸 자료가 어떻게 되는지 함께 말한다. */
export const DOCUMENT_CONSENT_REVOKED_NOTICE =
  '동의를 철회했어요. 앞으로는 견적서를 올릴 수 없고, 이미 올린 자료는 내 제보내역에서 지울 수 있어요'; // pick-language: 받는 서류 이름
