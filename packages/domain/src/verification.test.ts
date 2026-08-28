import { VERIFICATION_LEVELS, affectsMarketPrice, isAtLeast, levelRank } from './verification';

describe('검증 등급', () => {
  it('L2부터 시장 가격에 반영한다', () => {
    // 서비스정책서 2번.
    expect(VERIFICATION_LEVELS.filter(affectsMarketPrice)).toEqual(['L2', 'L3', 'L4']);
  });

  it('등급 순서는 배열 순서를 따른다', () => {
    expect(levelRank('L0')).toBeLessThan(levelRank('L4'));
    expect(isAtLeast('L3', 'L2')).toBe(true);
    expect(isAtLeast('L1', 'L2')).toBe(false);
    expect(isAtLeast('L2', 'L2')).toBe(true);
  });
});
