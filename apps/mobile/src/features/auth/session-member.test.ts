import type { CurrentUser } from '@weddingpick/api-contract';

import { retainSessionMember } from './session-member';

const MEMBER: CurrentUser = {
  userId: '00000000-0000-4000-8000-000000000001',
  weddingId: '00000000-0000-4000-8000-000000000002',
  displayName: '민지',
  weddingDate: '2027-05-16',
  region: '서울',
  preparedCategories: [],
  budgetBracket: '10m_20m',
  budgetAmount: 50000000,
  setupComplete: true,
  styleTags: ['URBAN', 'ROMANTIC'],
  spouseLinked: false,
  partnerDisplayName: null,
  hasPaymentProof: false,
  hasPick: true,
  hasCompared: false,
  tier: 'mate',
  tierLabel: '메이트',
};

describe('retainSessionMember', () => {
  it('같은 회원 응답이면 기존 객체 참조를 유지한다', () => {
    expect(retainSessionMember(MEMBER, { ...MEMBER })).toBe(MEMBER);
  });

  it('화면에 영향을 주는 회원 값이 달라지면 새 응답을 전달한다', () => {
    const changed = { ...MEMBER, region: '부산' };
    expect(retainSessionMember(MEMBER, changed)).toBe(changed);
  });
});
