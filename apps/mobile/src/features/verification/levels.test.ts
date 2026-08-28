import { VERIFICATION_LEVELS } from '@weddingpick/domain';

import { VERIFICATION_LEVEL_ACCENT } from '@weddingpick/ui';

describe('검증 등급 표시', () => {
  it('등급마다 서로 다른 색을 쓴다', () => {
    const accents = VERIFICATION_LEVELS.map((level) => VERIFICATION_LEVEL_ACCENT[level]);

    expect(new Set(accents).size).toBe(VERIFICATION_LEVELS.length);
  });

  it('모든 등급에 색이 정해져 있다', () => {
    // 서비스정책서 2번: 등급별 아이콘·색상은 고정한다.
    for (const level of VERIFICATION_LEVELS) {
      expect(VERIFICATION_LEVEL_ACCENT[level]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
