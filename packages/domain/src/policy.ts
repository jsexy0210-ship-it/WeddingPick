import type { VerificationLevel } from './verification';

/**
 * 아직 확정되지 않은 운영 기준. 정해지면 이 파일만 고친다.
 *
 * 서비스정책서 "미확정 항목"과 docs/05 7번에 열려 있는 값들이다. 코드 여기저기에
 * 흩어지면 나중에 어디를 고쳐야 할지 알 수 없으므로 한곳에 모아둔다.
 */
export const PRICING_POLICY = {
  /**
   * 시장 대표가격 계산에 들어가는 최소 검증 등급.
   * 서비스정책서 2번이 L2(계약인증)부터 반영이라고 정하고 있다 — 확정된 값.
   */
  minimumVerificationLevel: 'L2' satisfies VerificationLevel as VerificationLevel,

  /**
   * 중앙값을 노출하기 위한 최소 표본 수. **잠정값**.
   *
   * 사업계획서 9번은 "데이터 부족 시 시장가격을 생성하지 않는다"고만 하고 숫자를 정하지
   * 않았다. 상품 동일성 판단 기준이 정해져야 실제 표본 크기를 가늠할 수 있다.
   */
  minimumSampleCount: 5,

  /**
   * 가격 판단 4단계의 경계. **잠정값** — docs/05 5번의 사분위 제안.
   *
   * 내 견적이 표본 분포의 어디에 있는지로 판단한다.
   * p25 미만이면 '낮은 편', p75 이하면 '비슷한 수준', p90 이하면 '다소 높은 편', 그 위는 '높은 편'.
   */
  judgementQuantiles: { low: 0.25, similar: 0.75, somewhatHigh: 0.9 },
} as const;
