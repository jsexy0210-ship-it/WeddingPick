import { VERIFICATION_LEVELS, type VerificationLevel } from '@weddingpick/domain';

/**
 * 등급의 의미와 시장가격 반영 여부는 @weddingpick/domain에 있다. 여기에는 표시 규칙만 둔다.
 *
 * 색상은 UI 전체에서 고정한다 — 서비스정책서 2번이 등급별 아이콘·색상 고정을 요구한다.
 */
export const VERIFICATION_LEVEL_ACCENT: Record<VerificationLevel, string> = {
  L0: '#8B8D98',
  L1: '#208AEF',
  L2: '#2A9D5C',
  L3: '#12786A',
  L4: '#7A4DD1',
};

export { VERIFICATION_LEVELS };
export type { VerificationLevel };
