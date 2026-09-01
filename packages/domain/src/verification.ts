import { withSubject } from './korean';

/**
 * 데이터 검증 등급. 사업계획서 26번, 서비스정책서 2번.
 * 배열 순서가 곧 등급 순서다.
 */
export const VERIFICATION_LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;

export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

export type VerificationLevelRule = {
  label: string;
  /** 이 등급을 받는 조건 */
  condition: string;
  /** 시장 대표가격 산정에 반영되는지 */
  affectsMarketPrice: boolean;
  /** 반영될 때의 가중치. 상위 등급일수록 크다. */
  weight: number;
};

/**
 * 확인 단계 다섯.
 *
 * `label`은 **사용자 화면에 나가는 배지**다. v3.12가 사용자 UI에서 `견적`·
 * `계약서`를 막아서, 무엇을 확인했는지를 자료 이름이 아니라 **어디까지 확인됐는지**로
 * 적는다. `condition`은 그 단계에 무엇이 필요한지를 운영자가 읽는 자리라
 * 정확한 자료 이름을 그대로 쓴다.
 *
 * 배지는 띄어쓰지 않는다(카피 규칙).
 */
export const VERIFICATION_LEVEL_RULES: Record<VerificationLevel, VerificationLevelRule> = {
  L0: { label: '미확인', condition: '사용자 입력만 존재', affectsMarketPrice: false, weight: 0 },
  L1: { label: '자료확인', condition: '올린 자료 확인', affectsMarketPrice: false, weight: 0 },
  L2: { label: 'Pick확인', condition: '실제 계약 자료 확인', affectsMarketPrice: true, weight: 1 },
  L3: { label: '이용확인', condition: '실제 이용 확인', affectsMarketPrice: true, weight: 2 },
  L4: {
    label: '최종금액확인',
    condition: '최종 지출 자료 확인',
    affectsMarketPrice: true,
    weight: 3,
  },
};

export function levelRank(level: VerificationLevel): number {
  return VERIFICATION_LEVELS.indexOf(level);
}

export function isAtLeast(level: VerificationLevel, minimum: VerificationLevel): boolean {
  return levelRank(level) >= levelRank(minimum);
}

/** 시장 대표가격 계산에 넣어도 되는 데이터인지. 서비스정책서 2번. */
export function affectsMarketPrice(level: VerificationLevel): boolean {
  return VERIFICATION_LEVEL_RULES[level].affectsMarketPrice;
}

/** 인증 신청에 낼 수 있는 증빙 종류. DB의 verification_evidence_kind와 같은 목록이다. */
export const VERIFICATION_EVIDENCE_KINDS = [
  'quote_document',
  'contract_document',
  'payment_receipt',
  'usage_proof',
] as const;

export type VerificationEvidenceKind = (typeof VERIFICATION_EVIDENCE_KINDS)[number];

/**
 * 어떤 서류를 첨부하는가.
 *
 * **여기만 실제 서류 이름을 쓴다.** v3.12가 사용자 UI에서 `견적서`·`계약서`를
 * 막았지만, 이 화면은 사용자가 **손에 든 종이를 골라야 하는 자리**다. 여기서
 * `Pick 인증 자료`라고만 적으면 무엇을 첨부하라는 것인지 알 수 없고, 잘못된
 * 서류가 올라와 확인이 반려된다.
 *
 * 줄마다 `pick-language:` 표시를 달아 검사에서 뺀다 — 파일째 빼면 이 파일의
 * 다른 문구가 조용히 옛말로 돌아간다.
 */
export const VERIFICATION_EVIDENCE_RULES: Record<
  VerificationEvidenceKind,
  { label: string; description: string }
> = {
  quote_document: {
    label: '견적서', // pick-language: 손에 든 서류 이름
    description: '업체에서 받은 견적서 원본', // pick-language: 손에 든 서류 이름
  },
  contract_document: {
    label: '계약서', // pick-language: 손에 든 서류 이름
    description: '도장이나 서명이 들어간 가계약서·계약서', // pick-language: 손에 든 서류 이름
  },
  payment_receipt: {
    label: 'Pick 인증 자료',
    description: '계약금·잔금을 실제로 낸 것을 보여주는 영수증이나 이체 내역',
  },
  usage_proof: {
    label: '이용 확인 자료',
    description: '예식을 실제로 치렀다는 것을 보여주는 자료',
  },
};

/** 신청할 수 있는 등급. L0은 아무것도 확인하지 않은 상태라 신청 대상이 아니다. */
export type RequestableLevel = Exclude<VerificationLevel, 'L0'>;

/**
 * 목표 등급마다 반드시 있어야 하는 증빙.
 *
 * 계약인증(L2)에 견적서를 내는 식으로는 통과할 수 없다. 여기서 걸러두지 않으면
 * 시장가격에 반영되는 L2 자료가 견적서만으로 올라온다 (서비스정책서 2번).
 */
export const REQUIRED_EVIDENCE_KIND: Record<RequestableLevel, VerificationEvidenceKind> = {
  L1: 'quote_document',
  L2: 'contract_document',
  L3: 'usage_proof',
  L4: 'payment_receipt',
};

/** 목표 등급에 맞는 증빙이 들어 있는지. 서버와 앱이 같은 규칙을 본다. */
export function hasRequiredEvidence(
  targetLevel: RequestableLevel,
  kinds: readonly VerificationEvidenceKind[]
): boolean {
  return kinds.includes(REQUIRED_EVIDENCE_KIND[targetLevel]);
}

/** 지금 등급에서 신청할 수 있는 다음 등급들. 이미 받은 등급은 다시 신청하지 않는다. */
export function requestableLevels(current: VerificationLevel): RequestableLevel[] {
  return VERIFICATION_LEVELS.filter(
    (level): level is RequestableLevel => level !== 'L0' && levelRank(level) > levelRank(current)
  );
}

/** 신청의 처리 상태. DB의 verification_status와 같은 목록이다. */
export const VERIFICATION_STATUSES = ['received', 'in_review', 'approved', 'rejected'] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/**
 * 사용자에게 나가는 말. 표시 정책(`report-state.ts`)을 따른다.
 *
 * `승인`·`반려`는 심사자의 말이지 사용자의 말이 아니다. 같은 일을 다른 흐름에서
 * `확인 완료`라고 적고 여기서만 `승인`이라고 적으면, 읽는 사람은 둘이 다른
 * 일인 줄 안다.
 */
export const VERIFICATION_STATUS_LABEL: Record<VerificationStatus, string> = {
  received: '확인 중',
  in_review: '확인 중',
  approved: '확인 완료',
  rejected: '반영되지 않았어요',
};

/**
 * 심사자가 승인하기 전에 통과해야 하는 것들.
 *
 * 신청 접수(A-13)에서 이미 한 번 거른다. 그런데 접수와 승인 사이에는 시간이 있고,
 * 그 사이에 증빙이 지워지거나 문서 등급이 다른 경로로 오를 수 있다. 승인은
 * 시장 대표가격에 자료를 넣는 행위라(서비스정책서 2번) 그때 다시 본다.
 *
 * 결과를 boolean이 아니라 사유로 돌려주는 이유는, 심사자가 "안 된다"만 보고
 * 왜인지 몰라 그냥 승인해버리는 일을 막기 위해서다.
 */
export type ApprovalCheck = { ok: true } | { ok: false; reason: string };

export function canApprove(input: {
  targetLevel: RequestableLevel;
  currentLevel: VerificationLevel;
  evidenceKinds: readonly VerificationEvidenceKind[];
  reviewerId: string;
  requesterId: string;
}): ApprovalCheck {
  // 서비스정책서 7번. 자기 증빙을 자기가 확인하는 것은 확인이 아니다.
  if (input.reviewerId === input.requesterId) {
    return { ok: false, reason: '신청한 본인은 심사할 수 없습니다.' };
  }

  if (isAtLeast(input.currentLevel, input.targetLevel)) {
    return {
      ok: false,
      reason: `이 문서는 이미 ${VERIFICATION_LEVEL_RULES[input.currentLevel].label}입니다.`,
    };
  }

  if (!hasRequiredEvidence(input.targetLevel, input.evidenceKinds)) {
    const required = VERIFICATION_EVIDENCE_RULES[REQUIRED_EVIDENCE_KIND[input.targetLevel]].label;

    // '결제 내역가'가 되지 않도록 조사는 앞말을 보고 고른다.
    return {
      ok: false,
      reason:
        `${VERIFICATION_LEVEL_RULES[input.targetLevel].label}에는 ` +
        `${withSubject(required)} 있어야 합니다. 낸 증빙에 없습니다.`,
    };
  }

  return { ok: true };
}

/** 심사 이력에 남는 일들. DB의 verification_event_kind와 같은 목록이다. */
export const VERIFICATION_EVENT_KINDS = [
  'received',
  'review_started',
  'approved',
  'rejected',
] as const;

export type VerificationEventKind = (typeof VERIFICATION_EVENT_KINDS)[number];

/** 이력을 사람이 읽는 말로. 심사자에게도 enum 값을 그대로 보이지 않는다. */
export const VERIFICATION_EVENT_LABEL: Record<VerificationEventKind, string> = {
  received: '접수',
  review_started: '심사 시작',
  approved: '승인',
  rejected: '반려',
};
