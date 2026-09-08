import type {
  CandidateListResponse,
  CurrentUser,
  VendorSummary,
} from '@weddingpick/api-contract';

import {
  boardMark,
  boardTone,
  boardValue,
  comparableCount,
  homeView,
  nextUpCategory,
} from './state';

/* 시안 여섯 장을 되살리는 최소한의 자료만 만든다. */

const ME = {
  userId: 'u1',
  weddingId: 'w1',
  displayName: '지수',
  weddingDate: '2027-05-16',
  setupComplete: true,
  spouseLinked: true,
  hasPaymentProof: false,
  hasPick: false,
} as unknown as CurrentUser;

function group(
  category: string,
  state: 'before' | 'picking' | 'decided',
  pickCount: number,
  decidedVendorId: string | null = null
): CandidateListResponse['groups'][number] {
  return {
    category,
    categoryLabel: category,
    candidates: Array.from({ length: pickCount }, (_, index) => ({
      vendorId: `${category}-v${index}`,
      vendorName: `${category} ${index}`,
    })),
    comparable: pickCount >= 2,
    state,
    stateLabel: state,
    decidedVendorId,
  } as unknown as CandidateListResponse['groups'][number];
}

function candidates(
  groups: CandidateListResponse['groups'],
  nextCategory: string | null
): CandidateListResponse {
  const decided = groups.filter((row) => row.state === 'decided').length;

  return {
    groups,
    total: groups.reduce((sum, row) => sum + row.candidates.length, 0),
    limit: 20,
    progress: { decided, total: groups.length, label: `${decided}/${groups.length} 완료` },
    nextCategory,
  } as unknown as CandidateListResponse;
}

function vendor(stage: 'collecting' | 'general'): VendorSummary {
  return {
    id: Math.random().toString(36),
    name: '모먼트 스튜디오',
    category: 'sdm',
    region: '서울',
    sourceNote: null,
    comparableQuoteCount: 0,
    paidPrice:
      stage === 'collecting'
        ? { stage, count: 2, caption: '실 제보 2건 · 수집 중' }
        : { stage, count: 8, caption: '실 제보 8건 · 최근 12개월', low: 1_520_000, high: 1_840_000 },
  } as unknown as VendorSummary;
}

const PRICED = [vendor('general'), vendor('general'), vendor('general')];
const THIN = [vendor('collecting'), vendor('collecting'), vendor('collecting')];

describe('홈 상태 — 시안 여섯 장', () => {
  it('프로필을 못 불러와도 화면이 멈추지 않고 취향 상태로 보여준다', () => {
    // 비회원 진입은 삭제됐다 — me가 null인 건 오류뿐이고, 그때도 화면은 뜬다.
    const view = homeView({ me: null, candidates: null, recommended: PRICED, tasteChosen: false });

    expect(view.state).toBe('taste');
    expect(view.board).toBe('folded');
    expect(view.focus).toBeNull();
  });

  it('시안 1 · 취향도 후보도 없으면 현황판을 접는다', () => {
    // 격자를 펼치면 빈 칸 네 개만 남는다.
    const view = homeView({
      me: ME,
      candidates: candidates([group('hall', 'before', 0)], 'hall'),
      recommended: PRICED,
      tasteChosen: false,
    });

    expect(view.state).toBe('taste');
    expect(view.board).toBe('folded');
  });

  it('시안 2 · 취향을 골랐으면 후보가 없어도 격자를 펼친다', () => {
    const view = homeView({
      me: ME,
      candidates: candidates([group('hall', 'before', 0)], 'hall'),
      recommended: PRICED,
      tasteChosen: true,
    });

    expect(view.state).toBe('empty');
    expect(view.board).toBe('grid');
    expect(view.focus).toBe('hall');
  });

  it('시안 3 · 추천 세 곳이 모두 수집 중이면 비교를 권하지 않는다', () => {
    const view = homeView({
      me: ME,
      candidates: candidates([group('hall', 'picking', 3)], 'hall'),
      recommended: THIN,
      tasteChosen: true,
    });

    expect(view.state).toBe('picking');
    expect(view.comparable).toBe(false);
  });

  it('시안 4 · 후보가 모였고 아직 결정 전이면 비교가 주 행동이다', () => {
    const view = homeView({
      me: ME,
      candidates: candidates([group('hall', 'picking', 3)], 'hall'),
      recommended: PRICED,
      tasteChosen: true,
    });

    expect(view.state).toBe('picking');
    expect(view.comparable).toBe(true);
    expect(view.showsDecided).toBe(false);
  });

  it('시안 5 · 하나라도 정했으면 정한 곳을 한 줄로 내려 보인다', () => {
    const view = homeView({
      me: ME,
      candidates: candidates(
        [group('hall', 'decided', 2, 'hall-v0'), group('sdm', 'picking', 3)],
        'sdm'
      ),
      recommended: PRICED,
      tasteChosen: true,
    });

    expect(view.state).toBe('decided');
    expect(view.showsDecided).toBe(true);
    // 결정이 찍히면 오늘의 Pick이 다음 업종으로 넘어간다.
    expect(view.focus).toBe('sdm');
  });

  it('금액이 하나뿐이면 비교로 치지 않는다', () => {
    // 한 곳만 금액이 있고 둘이 수집 중이면 그 표는 비교가 아니라 금액 하나다.
    const mixed = [vendor('general'), vendor('collecting'), vendor('collecting')];

    expect(comparableCount(mixed)).toBe(1);
    expect(
      homeView({
        me: ME,
        candidates: candidates([group('hall', 'picking', 3)], 'hall'),
        recommended: mixed,
        tasteChosen: true,
      }).comparable
    ).toBe(false);
  });

  it('후보 목록을 못 받아도 홈은 뜬다', () => {
    // 하나가 실패해도 나머지는 보여준다. 지목할 업종이 없으면 null로 둔다.
    const view = homeView({ me: ME, candidates: null, recommended: [], tasteChosen: true });

    expect(view.state).toBe('empty');
    expect(view.focus).toBeNull();
    expect(view.comparable).toBe(false);
  });
});

describe('현황판 한 칸', () => {
  it('정한 곳은 초록, 지목받은 곳은 코랄, 나머지는 물러난다', () => {
    expect(boardTone({ state: 'decided', isFocus: true })).toBe('done');
    expect(boardTone({ state: 'picking', isFocus: true })).toBe('now');
    expect(boardTone({ state: 'picking', isFocus: false })).toBe('going');
    expect(boardTone({ state: 'before', isFocus: false })).toBe('none');
  });

  it('지목받았는데 담은 것이 없으면 «좁히는 중»이라고 하지 않는다', () => {
    // 담은 것이 없는데 좁히는 중이라고 적으면 거짓이다.
    expect(boardMark({ tone: 'now', pickCount: 0 })).toBe('먼저 정할 차례');
    expect(boardMark({ tone: 'now', pickCount: 3 })).toBe('좁히는 중');
  });

  it('값 줄은 0을 숫자로 적지 않는다', () => {
    expect(boardValue({ pickCount: 0, decidedName: null })).toBe('아직 없어요');
    expect(boardValue({ pickCount: 3, decidedName: null })).toBe('후보 3곳');
    expect(boardValue({ pickCount: 3, decidedName: '더채플 강남' })).toBe('더채플 강남');
  });
});

describe('다음 준비', () => {
  it('오늘의 Pick이 지목한 업종은 빼고 고른다', () => {
    // 같은 업종을 두 번 적으면 같은 말을 두 번 하는 것이다.
    const groups = [group('hall', 'picking', 2), group('sdm', 'before', 0)];

    expect(nextUpCategory(groups, 'hall')?.category).toBe('sdm');
  });

  it('정한 것은 다음 준비가 아니다', () => {
    const groups = [group('hall', 'decided', 1, 'hall-v0'), group('sdm', 'picking', 2)];

    expect(nextUpCategory(groups, 'sdm')).toBeNull();
  });

  it('남은 것이 없으면 없는 다음을 지어내지 않는다', () => {
    expect(nextUpCategory([group('hall', 'decided', 1, 'hall-v0')], null)).toBeNull();
  });
});
