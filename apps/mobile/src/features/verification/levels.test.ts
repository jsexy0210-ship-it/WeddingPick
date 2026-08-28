import {
  VERIFICATION_LEVELS,
  VERIFICATION_LEVEL_INFO,
} from '@/features/verification/levels';

describe('검증 등급', () => {
  // 서비스정책서 2번: 시장 대표가격은 L2 이상 데이터만 반영한다.
  it('L2 미만은 시장 가격에 반영하지 않는다', () => {
    expect(VERIFICATION_LEVEL_INFO.L0.affectsMarketPrice).toBe(false);
    expect(VERIFICATION_LEVEL_INFO.L1.affectsMarketPrice).toBe(false);
  });

  it('L2부터 시장 가격에 반영한다', () => {
    expect(VERIFICATION_LEVEL_INFO.L2.affectsMarketPrice).toBe(true);
    expect(VERIFICATION_LEVEL_INFO.L3.affectsMarketPrice).toBe(true);
    expect(VERIFICATION_LEVEL_INFO.L4.affectsMarketPrice).toBe(true);
  });

  it('등급마다 서로 다른 색을 쓴다', () => {
    const accents = VERIFICATION_LEVELS.map((level) => VERIFICATION_LEVEL_INFO[level].accent);

    expect(new Set(accents).size).toBe(VERIFICATION_LEVELS.length);
  });
});
