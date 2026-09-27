import type { CandidateListResponse } from '@weddingpick/api-contract';
import { PREPARATION_CATEGORIES } from '@weddingpick/domain';
import { AccessibilityInfo } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { getCurrentUser, getPickRecommendations, listCandidates, removeDecision } from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';

import PickScreen from '../../app/(tabs)/pick/index';

const mockPush = jest.fn();
const mockParams: { group?: string } = {};

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useLocalSearchParams: () => mockParams,
  /* 화면에 올 때마다 읽는다 — 시험에서는 그리고 나서 한 번 부른다. */
  useFocusEffect: (callback: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(() => callback(), [callback]);
  },
}));
jest.mock('@/api/client', () => ({
  addCandidate: jest.fn(),
  decideCategory: jest.fn(),
  getCurrentUser: jest.fn(),
  getPickRecommendations: jest.fn(),
  listCandidates: jest.fn(),
  removeCandidate: jest.fn(),
  removeDecision: jest.fn(),
}));
jest.mock('@/components/confirm-alert', () => ({ confirmAlert: jest.fn() }));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const HALL_ID = '11111111-1111-4111-8111-111111111111';

/** 온보딩 3/5에서 웨딩홀은 목록에서 골랐고(결정), 스드메는 직접 입력했다. */
const PAGE: CandidateListResponse = {
  groups: [
    {
      category: 'hall',
      categoryLabel: '웨딩홀',
      candidates: [
        {
          id: 'c1111111-1111-4111-8111-111111111111',
          vendorId: HALL_ID,
          vendorName: '강남 A 웨딩홀',
          category: 'hall',
          region: '서울',
          imageUrl: null,
          note: null,
          addedAt: '2026-09-26T00:00:00.000Z',
          addedByPartner: false,
          rating: null,
        },
      ],
      comparable: false,
      state: 'decided',
      stateLabel: '결정완료',
      decidedVendorId: HALL_ID,
    },
  ],
  total: 1,
  limit: 30,
  progress: { decided: 5, total: 11, label: '5/11 완료' },
  nextCategory: 'snap',
  manualDecisions: [
    {
      category: 'studio',
      categoryLabel: '스튜디오',
      name: '청담 스튜디오',
      decidedAt: '2026-09-26T00:00:10.000Z',
      decidedByPartner: false,
    },
  ],
};

/** «내 조건에 맞는 곳» 카드 한 장 — 화면이 읽는 칸만. */
function rec(id: string, name: string, category: string) {
  return { id, name, category, imageUrl: null, paidPrice: { stage: 'collecting', count: 0, caption: '아직 정보가 적어요' }, guidePrice: null };
}

/**
 * Pick 담은 곳 — 온보딩에서 정한 곳이 «결정»으로 선다(2026-09-26 대표 지시 「결정으로 넣는다」 ·
 * 「직접입력하는 방법 고안하라」).
 */
describe('Pick — 온보딩에서 정한 곳', () => {
  let tree: ReactTestRenderer;

  beforeEach(async () => {
    delete mockParams.group;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    mockPush.mockReset();
    jest.mocked(getCurrentUser).mockResolvedValue({ weddingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } as never);
    jest.mocked(listCandidates).mockResolvedValue(PAGE);
    jest.mocked(getPickRecommendations).mockResolvedValue({
      groups: [
        { key: 'start', vendors: [rec('r1', '강남 B 웨딩홀', 'hall')] },
        { key: 'sdm', vendors: [rec('r2', '블루밍 스튜디오', 'studio')] },
        { key: 'ceremony', vendors: [] },
        { key: 'goods', vendors: [] },
      ],
    } as never);
    jest.mocked(removeDecision).mockResolvedValue(undefined as never);

    await act(async () => {
      tree = create(
        <SafeAreaProvider initialMetrics={METRICS}>
          <PickScreen />
        </SafeAreaProvider>
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
  });

  afterEach(() => {
    act(() => tree.unmount());
    delete mockParams.group;
  });

  function texts(): string[] {
    return tree.root
      /* 글자를 그리는 바닥 요소만 센다 — 감싼 컴포넌트까지 세면 같은 글자가 여러 번 잡힌다. */
      .findAll((node) => typeof node.type === 'string' && typeof node.props.children === 'string')
      .map((node) => node.props.children as string);
  }

  function pressables(label: string): ReactTestInstance[] {
    return tree.root.findAll(
      (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function'
    );
  }

  function showCompleted() {
    act(() => {
      pressables('완료')[0]!.props.onPress();
    });
  }

  it('목록에서 고른 업체는 결정 카드로 서고 상담예약으로 이어진다', () => {
    expect(texts()).not.toContain('강남 A 웨딩홀');
    showCompleted();
    expect(texts()).toContain('강남 A 웨딩홀');
    expect(pressables('강남 A 웨딩홀 결정취소')).not.toHaveLength(0);

    const consult = pressables('강남 A 웨딩홀 상담예약');

    expect(consult).not.toHaveLength(0);

    act(() => {
      consult[0]!.props.onPress();
    });

    /* 상담예약(WP-PICK-009)은 Pick 스택 별칭 안에서 민다(stack-alias.ts). */
    expect(mockPush).toHaveBeenCalledWith(`/pick/vendor/${HALL_ID}/consult?from=pick`);
  });

  it('결정 수 요약 없이 담은 업체와 추천을 구분해 보여준다', () => {
    expect(texts()).not.toContain('2개 결정 · 9개 남음 · 다음 본식스냅');
    expect(texts().filter((one) => one === '이런 곳은 어떠세요?')).toHaveLength(1);
    expect(texts()).toContain('블루밍 스튜디오');
  });

  it('홈에서 이미 결정한 묶음을 열면 완료 탭으로 바로 이동한다', async () => {
    mockParams.group = 'start';
    await act(async () => {
      tree.unmount();
      tree = create(<SafeAreaProvider initialMetrics={METRICS}><PickScreen /></SafeAreaProvider>);
    });
    await act(async () => { await Promise.resolve(); });
    expect(texts()).toContain('강남 A 웨딩홀');
    expect(pressables('완료')[0]!.props.accessibilityState).toEqual({ selected: true });
  });

  it('홈에서 들어온 묶음을 먼저 보여주고 다른 Pick도 이어서 보여준다', async () => {
    const hall = PAGE.groups[0]!;
    jest.mocked(listCandidates).mockResolvedValue({
      ...PAGE,
      groups: [
        { ...hall, state: 'picking', stateLabel: '후보 Pick 중', decidedVendorId: null },
        {
          ...hall, category: 'studio', categoryLabel: '스튜디오', state: 'picking', stateLabel: '후보 Pick 중', decidedVendorId: null,
          candidates: [{ ...hall.candidates[0]!, id: 'c2222222-2222-4222-8222-222222222222', vendorId: '22222222-2222-4222-8222-222222222222', vendorName: '블루밍 스튜디오', category: 'studio' }],
        },
      ],
      manualDecisions: [],
    });
    mockParams.group = 'sdm';
    await act(async () => {
      tree.unmount();
      tree = create(<SafeAreaProvider initialMetrics={METRICS}><PickScreen /></SafeAreaProvider>);
    });
    await act(async () => { await Promise.resolve(); });
    expect(texts().indexOf('스드메')).toBeLessThan(texts().indexOf('웨딩홀'));
    expect(texts()).toContain('강남 A 웨딩홀');
  });

  it('모든 업종을 정했으면 완료를 안내하고 검색 빈 상태를 내지 않는다', async () => {
    jest.mocked(listCandidates).mockResolvedValue({
      ...PAGE,
      groups: [],
      total: 0,
      manualDecisions: PREPARATION_CATEGORIES.map((category) => ({
        category,
        categoryLabel: category,
        name: `${category} 업체`,
        decidedAt: '2026-09-26T00:00:00.000Z',
        decidedByPartner: false,
      })),
      progress: { decided: 11, total: 11, label: '11/11 완료' },
      nextCategory: null,
    });
    jest.mocked(getPickRecommendations).mockResolvedValue({ groups: [] } as never);

    await act(async () => {
      tree.unmount();
      tree = create(
        <SafeAreaProvider initialMetrics={METRICS}>
          <PickScreen />
        </SafeAreaProvider>
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(texts()).not.toContain('정할 업종을 모두 마쳤어요');
    expect(texts()).not.toContain('아직 담은 곳이 없어요');
    expect(texts()).not.toContain('업체 검색하기');
    act(() => {
      pressables('진행 중')[0]!.props.onPress();
    });
    expect(texts()).toContain('진행 중인 곳이 없어요');
  });

  it('직접 입력한 곳은 스드메 묶음의 결정 카드로 서고, 업체 상세 · 상담예약은 없다', () => {
    showCompleted();
    expect(texts()).toEqual(expect.arrayContaining(['청담 스튜디오', '직접 입력한 곳', '스튜디오']));
    expect(texts()).toContain('1개 결정');
    expect(pressables('청담 스튜디오 상담예약')).toHaveLength(0);
    expect(pressables('청담 스튜디오 빼기')).toHaveLength(0);
    expect(pressables('청담 스튜디오 결정취소')).toHaveLength(1);
  });

  it('결정이 끝난 웨딩홀 묶음은 «결정완료»로 서고 완료 탭에는 추천을 내밀지 않는다', () => {
    showCompleted();
    expect(texts().filter((one) => one === '결정완료')).toHaveLength(1);
    expect(tree.root.findAll((node) => node.props.accessibilityLabel === '웨딩홀 결정완료')).not.toHaveLength(0);
    // 끝난 웨딩홀의 추천은 없고, 아직 스튜디오만 정한 스드메의 추천은 그대로다.
    expect(texts()).not.toContain('강남 B 웨딩홀');
    expect(texts()).not.toContain('블루밍 스튜디오');
    expect(texts()).not.toContain('이런 곳은 어떠세요?');
  });

  it('카테고리 칩 없이 진행 중 목록과 완료 묶음을 구분한다', () => {
    expect(tree.root.findAll((node) => node.props.accessibilityRole === 'radio')).toHaveLength(0);
    expect(texts()).toContain('이런 곳은 어떠세요?');
    showCompleted();
    expect(tree.root.findAll((node) => node.props.accessibilityLabel === '웨딩홀 결정완료')).not.toHaveLength(0);
    expect(texts()).toContain('스드메');
  });

  it('업체 결정을 취소하면 그 자리에서 «결정완료»가 풀리고 추천이 다시 선다', async () => {
    showCompleted();
    act(() => {
      tree.root
        .findAll((node) => node.props.accessibilityLabel === '강남 A 웨딩홀 결정취소' && typeof node.props.onPress === 'function')[0]!
        .props.onPress();
    });

    const [, , buttons] = jest.mocked(confirmAlert).mock.calls.at(-1)!;
    const confirm = (buttons as { text: string; onPress?: () => void }[]).find((one) => one.text === '결정취소')!;

    // 다시 읽기(load)도 결정이 풀린 목록을 돌려준다.
    jest.mocked(listCandidates).mockResolvedValue({
      ...PAGE,
      groups: [{ ...PAGE.groups[0]!, state: 'picking', stateLabel: '후보 Pick 중', decidedVendorId: null }],
    });
    await act(async () => {
      confirm.onPress!();
      await Promise.resolve();
    });

    expect(removeDecision).toHaveBeenCalledWith('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'hall');
    expect(texts()).not.toContain('결정완료');
    expect(tree.root.findAll((node) => node.props.accessibilityLabel === '웨딩홀 결정완료')).toHaveLength(0);
    act(() => {
      pressables('진행 중')[0]!.props.onPress();
    });
    expect(texts()).toContain('강남 B 웨딩홀');
  });

  it('직접 입력한 결정도 결정취소로 지운다', async () => {
    showCompleted();
    act(() => {
      pressables('청담 스튜디오 결정취소')[0]!.props.onPress();
    });

    const [, , buttons] = jest.mocked(confirmAlert).mock.calls.at(-1)!;
    const confirm = (buttons as { text: string; onPress?: () => void }[]).find((one) => one.text === '결정취소')!;

    await act(async () => {
      confirm.onPress!();
      await Promise.resolve();
    });

    expect(removeDecision).toHaveBeenCalledWith('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'studio');
  });
});

/**
 * 끝난 묶음에 결정 말고도 담아 둔 후보가 있으면 결정 카드가 맨 위에 서고 나머지는 «더보기» 뒤로
 * 접힌다.
 */
describe('Pick — 결정이 끝난 묶음의 후보', () => {
  let tree: ReactTestRenderer;
  const cand = (n: string, vendorName: string, addedAt: string) => ({
    id: `c${n.repeat(7)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`,
    vendorId: `${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`,
    vendorName,
    category: 'hall' as const,
    region: '서울',
    imageUrl: null,
    note: null,
    addedAt,
    addedByPartner: false,
    rating: null,
  });
  const decided = cand('1', '더채플 청담', '2026-08-01T00:00:00.000Z');
  const older = cand('2', '루이비스스퀘어', '2026-09-01T00:00:00.000Z');
  const newer = cand('3', '강남 B 웨딩홀', '2026-09-05T00:00:00.000Z');

  beforeEach(async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.mocked(getCurrentUser).mockResolvedValue({
      weddingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      preparedCategories: ['hall'],
    } as never);
    jest.mocked(listCandidates).mockResolvedValue({
      ...PAGE,
      groups: [{ ...PAGE.groups[0]!, candidates: [newer, older, decided], decidedVendorId: decided.vendorId }],
      total: 3,
      manualDecisions: [],
    });
    jest.mocked(getPickRecommendations).mockResolvedValue({ groups: [] } as never);

    await act(async () => {
      tree = create(
        <SafeAreaProvider initialMetrics={METRICS}>
          <PickScreen />
        </SafeAreaProvider>
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
  });

  afterEach(() => {
    act(() => tree.unmount());
  });

  function names(): string[] {
    const want = new Set(['더채플 청담', '루이비스스퀘어', '강남 B 웨딩홀']);
    return tree.root
      .findAll((node) => typeof node.type === 'string' && typeof node.props.children === 'string')
      .map((node) => node.props.children as string)
      .filter((text) => want.has(text));
  }

  it('완료에는 결정 카드만, 진행 중에는 나머지 후보가 최신순으로 선다', () => {
    expect(names()).toEqual(['강남 B 웨딩홀', '루이비스스퀘어']);

    const completedTab = tree.root.findAll(
      (node) => node.props.accessibilityLabel === '완료' && typeof node.props.onPress === 'function'
    );
    act(() => {
      completedTab[0]!.props.onPress();
    });

    expect(names()).toEqual(['더채플 청담']);
  });

  it('두 곳을 고르면 비교 바가 열리고 닫기로 선택을 비운다', () => {
    const action = (label: string) => tree.root.findAll(
      (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function'
    )[0]!;
    expect(action('비교 닫기')).toBeUndefined();
    expect(action('강남 B 웨딩홀 비교에 담기').props.accessibilityRole).toBe('button');
    expect(action('강남 B 웨딩홀 비교에 담기').props.accessibilityState.selected).toBe(false);
    act(() => action('강남 B 웨딩홀 비교에 담기').props.onPress());
    expect(action('강남 B 웨딩홀 비교에서 빼기').props.accessibilityState.selected).toBe(true);
    expect(action('비교 닫기')).toBeUndefined();
    act(() => action('루이비스스퀘어 비교에 담기').props.onPress());
    expect(action('비교 닫기')).toBeDefined();
    expect(action('비교하기')).toBeDefined();
    expect(tree.root.findAll((node) => node.props.children === '금액과 조건을 나란히 볼 수 있어요')).toHaveLength(0);
    act(() => action('비교 닫기').props.onPress());
    expect(action('비교 닫기')).toBeUndefined();
    expect(action('강남 B 웨딩홀 비교에 담기')).toBeDefined();
  });
});

/** 온보딩 준비 현황(체크)만 있고 실제 결정이 없는 묶음은 끝난 묶음이 아니다(2026-09-26 대표 결정). */
describe('Pick — 준비 현황만 있는 묶음', () => {
  let tree: ReactTestRenderer;

  beforeEach(async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.mocked(getCurrentUser).mockResolvedValue({
      weddingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      preparedCategories: ['hall', 'studio', 'dress', 'makeup', 'hair'],
    } as never);
    jest.mocked(listCandidates).mockResolvedValue({
      ...PAGE,
      groups: [{ ...PAGE.groups[0]!, state: 'picking', stateLabel: '후보 Pick 중', decidedVendorId: null }],
      manualDecisions: [],
    });
    jest.mocked(getPickRecommendations).mockResolvedValue({ groups: [] } as never);

    await act(async () => {
      tree = create(
        <SafeAreaProvider initialMetrics={METRICS}>
          <PickScreen />
        </SafeAreaProvider>
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
  });

  afterEach(() => {
    act(() => tree.unmount());
  });

  it('«결정완료» 표시가 어디에도 없다', () => {
    expect(
      tree.root.findAll(
        (node) => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.endsWith('결정완료')
      )
    ).toHaveLength(0);
  });
});
