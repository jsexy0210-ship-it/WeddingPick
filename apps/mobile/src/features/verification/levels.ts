/**
 * 데이터 검증 등급 L0~L4. 서비스정책서 2번.
 * 등급별 색상은 UI 전체에서 고정한다 — 화면마다 다르게 쓰지 않는다.
 */
export const VERIFICATION_LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;

export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

type LevelInfo = {
  label: string;
  /** 이 등급을 받는 조건 */
  condition: string;
  /** 시장 대표가격(중앙값) 산정에 반영되는지 */
  affectsMarketPrice: boolean;
  accent: string;
};

export const VERIFICATION_LEVEL_INFO: Record<VerificationLevel, LevelInfo> = {
  L0: {
    label: '미인증',
    condition: '사용자 입력만 존재',
    affectsMarketPrice: false,
    accent: '#8B8D98',
  },
  L1: {
    label: '견적인증',
    condition: '실제 견적자료 확인',
    affectsMarketPrice: false,
    accent: '#208AEF',
  },
  L2: {
    label: '계약인증',
    condition: '실제 계약자료 확인',
    affectsMarketPrice: true,
    accent: '#2A9D5C',
  },
  L3: {
    label: '이용인증',
    condition: '실제 이용 확인',
    affectsMarketPrice: true,
    accent: '#12786A',
  },
  L4: {
    label: '최종금액 인증',
    condition: '최종 결제자료 확인',
    affectsMarketPrice: true,
    accent: '#7A4DD1',
  },
};
