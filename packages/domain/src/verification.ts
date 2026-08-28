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

export const VERIFICATION_LEVEL_RULES: Record<VerificationLevel, VerificationLevelRule> = {
  L0: { label: '미인증', condition: '사용자 입력만 존재', affectsMarketPrice: false, weight: 0 },
  L1: { label: '견적인증', condition: '실제 견적자료 확인', affectsMarketPrice: false, weight: 0 },
  L2: { label: '계약인증', condition: '실제 계약자료 확인', affectsMarketPrice: true, weight: 1 },
  L3: { label: '이용인증', condition: '실제 이용 확인', affectsMarketPrice: true, weight: 2 },
  L4: {
    label: '최종금액 인증',
    condition: '최종 결제자료 확인',
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

export const VERIFICATION_EVIDENCE_RULES: Record<
  VerificationEvidenceKind,
  { label: string; description: string }
> = {
  quote_document: {
    label: '견적서',
    description: '업체에서 받은 견적서 원본',
  },
  contract_document: {
    label: '계약서',
    description: '도장이나 서명이 들어간 가계약서·계약서',
  },
  payment_receipt: {
    label: '결제 내역',
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
