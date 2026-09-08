import type {
  CandidateListResponse,
  CurrentUser,
  VendorSummary,
} from '@weddingpick/api-contract';

import {
  boardCells,
  boardMoreLabel,
  boardNote,
  boardValue,
  categoryStatuses,
  conditionChips,
  currentCategory,
  dateChipLabel,
  hasEnoughInfo,
  heroCopy,
  HOME_CATEGORIES,
  HOME_TOTAL,
  homeCta,
  homeTier,
  homeView,
  nextStep,
  type CategoryStatus,
} from './state';

/* 시안 네 장(0개 · 3/12 · 3/12 정보 부족 · 9/12)을 되살리는 최소한의 자료만 만든다. */

const ME = {
  userId: 'u1',
  weddingId: 'w1',
  displayName: '재또',
  weddingDate: '2027-05-12',
  region: '강남',
  preparedCategories: [],
  budgetBracket: 'over_30m',
  styleTags: ['URBAN', 'ROMANTIC'],
  setupComplete: true,
  spouseLinked: false,
  partnerDisplayName: null,
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

function vendor(stage: 'collecting' | 'normal', id = Math.random().toString(36)): VendorSummary {
  return {
    id,
    name: '강남 A 웨딩홀',
    category: 'hall',
    region: '강남',
    sourceNote: null,
    comparableQuoteCount: 0,
    guidePrice: null,
    styleTags: [],
    paidPrice:
      stage === 'collecting'
        ? { stage, count: 2, caption: '아직 정보가 적어요 · 2건' }
        : { stage, count: 8, caption: '실 제보 8건 · 최근 12개월', low: 1_520_000, high: 1_840_000 },
  } as unknown as VendorSummary;
}

const PRICED = [vendor('normal', 'a'), vendor('normal', 'b'), vendor('normal', 'c')];
const THIN = [vendor('collecting', 'a'), vendor('collecting', 'b'), vendor('collecting', 'c')];

/** 홈 순서의 앞 n개를 정한 상태로. */
function decidedFirst(n: number): CandidateListResponse['groups'] {
  return HOME_CATEGORIES.slice(0, n).map((category) => group(category, 'decided', 1, `${category}-v0`));
}

describe('홈 순서', () => {
  it('12업종이고 웨딩홀부터 시작한다', () => {
    // 시안 1의 격자는 웨딩홀 · 스튜디오 · 드레스 · 메이크업이다.
    expect(HOME_TOTAL).toBe(12);
    expect(HOME_CATEGORIES.slice(0, 4)).toEqual(['hall', 'studio', 'dress', 'makeup']);
    expect(HOME_CATEGORIES).toContain('wedding_info_company');
  });
});

describe('1층 · 진행 구간', () => {
  it('0개 · 1~8개 · 9개 이상', () => {
    expect(homeTier(0)).toBe('start');
    expect(homeTier(1)).toBe('going');
    expect(homeTier(8)).toBe('going');
    expect(homeTier(9)).toBe('finishing');
    expect(homeTier(12)).toBe('finishing');
  });

  it('준비 현황에서 체크한 업종도 정한 것으로 센다', () => {
    // 앱 밖에서 정한 업종은 후보 목록에 없거나 업체가 없다 — 그래도 정한 것이다.
    const statuses = categoryStatuses({
      candidates: candidates([group('studio', 'picking', 2)], 'studio'),
      preparedCategories: ['hall', 'dress'],
    });

    expect(statuses.filter((row) => row.state === 'decided').map((row) => row.category)).toEqual([
      'hall',
      'dress',
    ]);
    expect(statuses.find((row) => row.category === 'hall')?.decidedName).toBeNull();
  });

  it('앱에서 정했으면 업체 이름이 남는다', () => {
    const statuses = categoryStatuses({
      candidates: candidates([group('hall', 'decided', 2, 'hall-v1')], null),
      preparedCategories: [],
    });

    expect(statuses[0]?.decidedName).toBe('hall 1');
  });

  it('후보 목록이 없어도 12칸은 다 있다', () => {
    expect(categoryStatuses({ candidates: null, preparedCategories: [] })).toHaveLength(12);
  });
});

describe('현재 업종', () => {
  it('서버가 지목한 업종을 따른다', () => {
    const statuses = categoryStatuses({
      candidates: candidates([group('dress', 'picking', 2)], 'dress'),
      preparedCategories: [],
    });

    expect(currentCategory(statuses, 'dress')).toBe('dress');
  });

  it('지목이 없거나 이미 정한 것이면 안 정한 첫째다', () => {
    const statuses = categoryStatuses({
      candidates: candidates([], null),
      preparedCategories: ['hall'],
    });

    expect(currentCategory(statuses, null)).toBe('studio');
    expect(currentCategory(statuses, 'hall')).toBe('studio');
  });

  it('다 정했으면 없는 다음을 지어내지 않는다', () => {
    const statuses = categoryStatuses({
      candidates: candidates([], null),
      preparedCategories: [...HOME_CATEGORIES],
    });

    expect(currentCategory(statuses, null)).toBeNull();
  });
});

describe('히어로', () => {
  it('0개 — 웨딩홀부터 정해볼까요?', () => {
    expect(heroCopy({ tier: 'start', currentLabel: '웨딩홀', decided: 0 })).toEqual({
      line1: '웨딩홀부터',
      line2: '정해볼까요?',
    });
  });

  it('1~8개 — 이번 주엔 메이크업 차례예요', () => {
    expect(heroCopy({ tier: 'going', currentLabel: '메이크업', decided: 3 })).toEqual({
      line1: '이번 주엔',
      line2: '메이크업 차례예요',
    });
  });

  it('9개 이상 — 남은 수를 우리말로', () => {
    expect(heroCopy({ tier: 'finishing', currentLabel: '청첩장', decided: 9 })).toEqual({
      line1: '세 개만',
      line2: '더 정하면 끝나요',
    });
    expect(heroCopy({ tier: 'finishing', currentLabel: '예물', decided: 10 }).line1).toBe('두 개만');
    expect(heroCopy({ tier: 'finishing', currentLabel: '허니문', decided: 11 }).line1).toBe('하나만');
  });

  it('12/12 — 다 정했어요', () => {
    expect(heroCopy({ tier: 'finishing', currentLabel: null, decided: 12 }).line1).toBe('다 정했어요');
  });
});

describe('준비 현황 4칸', () => {
  const status = (
    category: CategoryStatus['category'],
    state: CategoryStatus['state'],
    pickCount = 0
  ): CategoryStatus => ({
    category,
    label: category,
    state,
    pickCount,
    decidedName: null,
  });

  it('값은 상태다 — 완료 · N곳 · 먼저 · 시작 전. 빈 칸이 없다', () => {
    expect(boardValue(status('hall', 'decided'), false)).toBe('완료');
    expect(boardValue(status('hall', 'picking', 3), true)).toBe('3곳');
    expect(boardValue(status('hall', 'before'), true)).toBe('먼저');
    expect(boardValue(status('hall', 'before'), false)).toBe('시작 전');
  });

  it('0개 — 순서상 첫 4개, 첫 칸만 코랄', () => {
    const statuses = categoryStatuses({ candidates: null, preparedCategories: [] });
    const cells = boardCells({ tier: 'start', statuses, current: 'hall' });

    expect(cells.map((cell) => cell.value)).toEqual(['먼저', '시작 전', '시작 전', '시작 전']);
    expect(cells.map((cell) => cell.tone)).toEqual(['now', 'none', 'none', 'none']);
  });

  it('1~8개 — 끝낸 것과 지금 것을 섞어 4칸', () => {
    // 시안 2: 웨딩홀 완료 · 스튜디오 완료 · 드레스 완료 · 메이크업 3곳.
    const statuses = categoryStatuses({
      candidates: candidates([...decidedFirst(3), group('makeup', 'picking', 3)], 'makeup'),
      preparedCategories: [],
    });
    const cells = boardCells({ tier: 'going', statuses, current: 'makeup' });

    expect(cells.map((cell) => `${cell.category} ${cell.value}`)).toEqual([
      'hall 완료',
      'studio 완료',
      'dress 완료',
      'makeup 3곳',
    ]);
    expect(cells.map((cell) => cell.tone)).toEqual(['done', 'done', 'done', 'now']);
  });

  it('1~8개 — 끝낸 것이 하나면 그다음 올 업종으로 채운다', () => {
    const statuses = categoryStatuses({
      candidates: candidates(decidedFirst(1), 'studio'),
      preparedCategories: [],
    });
    const cells = boardCells({ tier: 'going', statuses, current: 'studio' });

    expect(cells.map((cell) => cell.category)).toEqual(['hall', 'studio', 'dress', 'makeup']);
    expect(cells.map((cell) => cell.value)).toEqual(['완료', '먼저', '시작 전', '시작 전']);
  });

  it('1~8개 — 끝낸 것이 많으면 지금 것에 가까운 셋만', () => {
    // 웨딩홀 ~ 본식스냅 여섯을 정했고 지금은 부케. 격자에는 메이크업부터 온다.
    const statuses = categoryStatuses({
      candidates: candidates(decidedFirst(6), 'bouquet'),
      preparedCategories: [],
    });
    const cells = boardCells({ tier: 'going', statuses, current: 'bouquet' });

    expect(cells.map((cell) => cell.category)).toEqual(['makeup', 'hair', 'snap', 'bouquet']);
    expect(cells.map((cell) => cell.tone)).toEqual(['done', 'done', 'done', 'now']);
  });

  it('9개 이상 — 남은 것 먼저, 완료로 채운다', () => {
    // 시안 3: 청첩장 2곳 · 예물 시작 전 · 허니문 시작 전 · 본식스냅 완료.
    const done = HOME_CATEGORIES.filter((c) => !['invitation', 'goods', 'honeymoon'].includes(c));
    const statuses = categoryStatuses({
      candidates: candidates([group('invitation', 'picking', 2)], 'invitation'),
      preparedCategories: done,
    });
    const cells = boardCells({ tier: 'finishing', statuses, current: 'invitation' });

    expect(cells.map((cell) => `${cell.category} ${cell.value}`)).toEqual([
      'invitation 2곳',
      'goods 시작 전',
      'honeymoon 시작 전',
      'wedding_info_company 완료',
    ]);
    expect(cells[0]?.tone).toBe('now');
    expect(cells[3]?.tone).toBe('done');
  });

  it('12/12 — 네 칸 다 완료', () => {
    const statuses = categoryStatuses({
      candidates: null,
      preparedCategories: [...HOME_CATEGORIES],
    });
    const cells = boardCells({ tier: 'finishing', statuses, current: null });

    expect(cells).toHaveLength(4);
    expect(cells.every((cell) => cell.value === '완료')).toBe(true);
  });

  it('완료 개수는 격자가 아니라 헤더에 적는다', () => {
    expect(boardMoreLabel('start', 0)).toBe('전체 보기');
    expect(boardMoreLabel('going', 3)).toBe('전체 보기');
    expect(boardMoreLabel('finishing', 9)).toBe('완료 9개 · 전체 보기');
  });

  it('격자 아래 한 줄은 시작 전 · 웨딩홀일 때만', () => {
    expect(boardNote('start', 'hall')).toBe('웨딩홀이 정해지면 날짜와 예산이 잡혀요');
    expect(boardNote('going', 'makeup')).toBeNull();
  });
});

describe('2층 · 정보량', () => {
  it('실 제보 3건 이상이면 비교하기 · 코랄', () => {
    expect(hasEnoughInfo(PRICED)).toBe(true);
    expect(homeCta(PRICED)).toEqual({ kind: 'compare', label: '3곳 비교하기', ids: ['a', 'b', 'c'] });
  });

  it('3건 미만이면 Pick 인증하기 · 아웃라인', () => {
    expect(hasEnoughInfo(THIN)).toBe(false);
    expect(homeCta(THIN)).toEqual({ kind: 'proof', label: 'Pick 인증하기' });
  });

  it('견줄 곳이 하나뿐이면 비교를 권하지 않는다', () => {
    expect(hasEnoughInfo([vendor('normal')])).toBe(false);
    expect(hasEnoughInfo([])).toBe(false);
  });

  it('정보량은 골격을 바꾸지 않는다', () => {
    // 시안 2와 2b — 같은 진행 상황이면 히어로 · 격자 · 다음 준비가 같다.
    const cands = candidates([...decidedFirst(3), group('makeup', 'picking', 3)], 'makeup');
    const rich = homeView({ me: ME, candidates: cands, recommended: PRICED, daysLeft: 60 });
    const thin = homeView({ me: ME, candidates: cands, recommended: THIN, daysLeft: 60 });

    expect(thin.hero).toEqual(rich.hero);
    expect(thin.cells).toEqual(rich.cells);
    expect(thin.next).toEqual(rich.next);
    expect(rich.cta.kind).toBe('compare');
    expect(thin.cta.kind).toBe('proof');
  });
});

describe('조건 칩', () => {
  it('지역 · 예산 · 스타일 · 날짜(흐리게) 순', () => {
    expect(conditionChips(ME)).toEqual([
      { kind: 'region', label: '강남', dim: false },
      { kind: 'budget', label: '3,000만원 이상', dim: false },
      { kind: 'style', label: '도시적인', dim: false },
      { kind: 'style', label: '로맨틱한', dim: false },
      { kind: 'date', label: '5월 12일', dim: true },
    ]);
  });

  it('없는 조건은 칩을 만들지 않는다', () => {
    const bare = { ...ME, region: null, budgetBracket: 'unknown', styleTags: [], weddingDate: null };

    expect(conditionChips(bare as unknown as CurrentUser)).toEqual([]);
    expect(conditionChips(null)).toEqual([]);
  });

  it('날짜 칩은 «5월 12일»', () => {
    expect(dateChipLabel('2027-05-12')).toBe('5월 12일');
    expect(dateChipLabel('2027-11-03')).toBe('11월 3일');
  });
});

describe('다음 준비', () => {
  it('0개 — 그다음 업종을 대기로', () => {
    const statuses = categoryStatuses({ candidates: null, preparedCategories: [] });

    expect(nextStep({ tier: 'start', statuses, current: 'hall', daysLeft: 142 })).toEqual({
      title: '그다음은',
      name: '스튜디오 정하기',
      meta: '웨딩홀이 정해지면 알려드려요',
      aside: '대기',
      target: { kind: 'pick', category: 'studio' },
    });
  });

  it('1~8개 — 다음 업종과 D-day', () => {
    const statuses = categoryStatuses({
      candidates: candidates([...decidedFirst(3), group('makeup', 'picking', 3)], 'makeup'),
      preparedCategories: [],
    });
    const step = nextStep({ tier: 'going', statuses, current: 'makeup', daysLeft: 60 });

    expect(step?.title).toBe('다음 준비');
    expect(step?.name).toBe('헤어변형 정하기');
    expect(step?.aside).toBe('D-60');
    expect(step?.target).toEqual({ kind: 'pick', category: 'hair' });
  });

  it('예식일이 없으면 D-day 대신 미정', () => {
    const statuses = categoryStatuses({ candidates: candidates(decidedFirst(1), null), preparedCategories: [] });

    expect(nextStep({ tier: 'going', statuses, current: 'studio', daysLeft: null })?.aside).toBe(
      '예식일 미정'
    );
  });

  it('9개 이상 — Pick 인증으로 바꾼다', () => {
    const statuses = categoryStatuses({
      candidates: null,
      preparedCategories: HOME_CATEGORIES.slice(0, 9),
    });

    expect(nextStep({ tier: 'finishing', statuses, current: 'goods', daysLeft: 20 })).toEqual({
      title: '정리하면 좋은 것',
      name: 'Pick 인증 9건 남았어요',
      meta: '금액이 확인되면 다음 커플에게 도움이 돼요',
      aside: '인증',
      target: { kind: 'capture' },
    });
  });
});

describe('홈 종합', () => {
  it('프로필도 후보도 없으면 시작 전 구간으로 뜬다', () => {
    // me가 null인 건 오류뿐이고, 그때도 화면은 뜬다.
    const view = homeView({ me: null, candidates: null, recommended: [], daysLeft: null });

    expect(view.tier).toBe('start');
    expect(view.current).toBe('hall');
    expect(view.hero.line1).toBe('웨딩홀부터');
    expect(view.progressText).toBe('0 / 12');
    expect(view.cells).toHaveLength(4);
    expect(view.boardNote).toBe('웨딩홀이 정해지면 날짜와 예산이 잡혀요');
    expect(view.cta.kind).toBe('proof');
  });

  it('시안 3 · 9/12', () => {
    const view = homeView({
      me: { ...ME, preparedCategories: HOME_CATEGORIES.slice(0, 9) } as unknown as CurrentUser,
      candidates: candidates([group('goods', 'picking', 2)], 'goods'),
      recommended: PRICED,
      daysLeft: 20,
    });

    expect(view.tier).toBe('finishing');
    expect(view.progress).toBeCloseTo(0.75);
    expect(view.progressText).toBe('9 / 12');
    expect(view.boardMore).toBe('완료 9개 · 전체 보기');
    expect(view.next?.target).toEqual({ kind: 'capture' });
  });
});
