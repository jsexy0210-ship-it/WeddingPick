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
