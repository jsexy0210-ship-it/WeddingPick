import type { CandidateListResponse } from '@weddingpick/api-contract';

import { completedPickGroups, decidedFirst } from './completed-groups';

const HALL_ID = '11111111-1111-4111-8111-111111111111';

function page(input: Partial<CandidateListResponse>): CandidateListResponse {
  return {
    groups: [],
    total: 0,
    limit: 30,
    progress: { decided: 0, total: 11, label: '0/11 완료' },
    nextCategory: null,
    manualDecisions: [],
    ...input,
  };
}

function hallGroup(decidedVendorId: string | null): CandidateListResponse['groups'][number] {
  return {
    category: 'hall',
    categoryLabel: '웨딩홀',
    candidates: [],
    comparable: false,
    state: decidedVendorId ? 'decided' : 'picking',
    stateLabel: decidedVendorId ? '결정 완료' : '후보 Pick 중',
    decidedVendorId,
  };
}

const manual = (category: 'studio' | 'dress' | 'makeup' | 'hair' | 'snap', name: string) => ({
  category,
  categoryLabel: category,
  name,
  decidedAt: '2026-09-26T00:00:00.000Z',
  decidedByPartner: false,
});

describe('completedPickGroups — 묶음 업종이 모두 실제 결정으로 채워졌을 때만 끝난 묶음(2026-09-26 대표 결정)', () => {
  it('업체로 정한 웨딩홀은 끝난 묶음이다', () => {
    expect([...completedPickGroups(page({ groups: [hallGroup(HALL_ID)] }))]).toEqual(['start']);
  });

  it('결정을 취소하면(decidedVendorId null) 곧바로 끝난 묶음이 아니다', () => {
    expect(completedPickGroups(page({ groups: [hallGroup(null)] })).size).toBe(0);
  });

  it('온보딩 준비 현황만으로는 끝나지 않는다 — 판정이 준비 현황을 받지도 않는다(홈 «계약 완료»와 갈린다)', () => {
    expect(completedPickGroups(page({})).size).toBe(0);
    expect(completedPickGroups(null).size).toBe(0);
  });

  it('스드메는 네 업종 모두 결정(업체 · 직접 입력 섞여도)돼야 끝난다', () => {
    const three = page({ manualDecisions: [manual('studio', 'A'), manual('dress', 'B'), manual('makeup', 'C')] });

    expect(completedPickGroups(three).has('sdm')).toBe(false);
    expect(
      completedPickGroups({ ...three, manualDecisions: [...three.manualDecisions, manual('hair', 'D')] }).has('sdm')
    ).toBe(true);
  });
});

describe('decidedFirst', () => {
  it('결정한 곳을 맨 위로, 나머지는 받은 순서 그대로', () => {
    const rows = [
      { id: 'a', isDecided: false },
      { id: 'b', isDecided: false },
      { id: 'c', isDecided: true },
    ];

    expect(decidedFirst(rows).map((row) => row.id)).toEqual(['c', 'a', 'b']);
  });
});
