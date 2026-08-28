import {
  VERIFICATION_EVIDENCE_KINDS,
  VERIFICATION_EVIDENCE_RULES,
  VERIFICATION_LEVELS,
  affectsMarketPrice,
  hasRequiredEvidence,
  isAtLeast,
  levelRank,
  requestableLevels,
} from './verification';

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

describe('인증 증빙', () => {
  it('목표 등급에 맞는 증빙이 없으면 통과하지 않는다', () => {
    // 계약인증에 견적서만 내는 것을 막는다. 여기가 뚫리면 시장가격이 견적으로 채워진다.
    expect(hasRequiredEvidence('L2', ['quote_document'])).toBe(false);
    expect(hasRequiredEvidence('L2', ['quote_document', 'contract_document'])).toBe(true);
  });

  it('등급마다 요구하는 증빙이 다르다', () => {
    expect(hasRequiredEvidence('L1', ['quote_document'])).toBe(true);
    expect(hasRequiredEvidence('L3', ['contract_document'])).toBe(false);
    expect(hasRequiredEvidence('L4', ['payment_receipt'])).toBe(true);
  });

  it('이미 받은 등급은 다시 신청하지 않는다', () => {
    expect(requestableLevels('L0')).toEqual(['L1', 'L2', 'L3', 'L4']);
    expect(requestableLevels('L2')).toEqual(['L3', 'L4']);
    expect(requestableLevels('L4')).toEqual([]);
  });

  it('증빙 종류마다 사람이 읽을 이름이 있다', () => {
    for (const kind of VERIFICATION_EVIDENCE_KINDS) {
      expect(VERIFICATION_EVIDENCE_RULES[kind].label).toBeTruthy();
      expect(VERIFICATION_EVIDENCE_RULES[kind].description).toBeTruthy();
    }
  });
});
