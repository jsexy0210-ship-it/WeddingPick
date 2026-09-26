import type { CandidateListResponse } from '@weddingpick/api-contract';
import { AccessibilityInfo } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { getCurrentUser, getPickRecommendations, listCandidates, removeDecision } from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';

import PickScreen from '../../app/(tabs)/pick/index';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useLocalSearchParams: () => ({}),
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
      stateLabel: '결정 완료',
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

/**
 * Pick 담은 곳 — 온보딩에서 정한 곳이 «결정»으로 선다(2026-09-26 대표 지시 「결정으로 넣는다」 ·
 * 「직접입력하는 방법 고안하라」).
 */
describe('Pick — 온보딩에서 정한 곳', () => {
  let tree: ReactTestRenderer;

  beforeEach(async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    mockPush.mockReset();
    jest.mocked(getCurrentUser).mockResolvedValue({ weddingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } as never);
    jest.mocked(listCandidates).mockResolvedValue(PAGE);
    jest.mocked(getPickRecommendations).mockResolvedValue({ groups: [] } as never);
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

  it('목록에서 고른 업체는 결정 카드로 서고 상담 예약으로 이어진다', () => {
    expect(texts()).toContain('강남 A 웨딩홀');
    expect(pressables('강남 A 웨딩홀 결정 취소')).not.toHaveLength(0);

    const consult = pressables('강남 A 웨딩홀 상담 예약');

    expect(consult).not.toHaveLength(0);

    act(() => {
      consult[0]!.props.onPress();
    });

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/search/[vendorId]/consult', params: { vendorId: HALL_ID, from: 'pick' } });
  });

  it('직접 입력한 곳은 스드메 묶음의 결정 카드로 서고, 업체 상세 · 상담 예약은 없다', () => {
    expect(texts()).toEqual(expect.arrayContaining(['청담 스튜디오', '직접 입력한 곳', '스튜디오']));
    // 스드메 묶음이 «1개»를 센다.
    expect(texts().filter((one) => one === '1개 · 최신순')).toHaveLength(2);
    expect(pressables('청담 스튜디오 상담 예약')).toHaveLength(0);
    expect(pressables('청담 스튜디오 빼기')).toHaveLength(0);
    expect(pressables('청담 스튜디오 결정 취소')).toHaveLength(1);
  });

  it('직접 입력한 결정도 결정 취소로 지운다', async () => {
    act(() => {
      pressables('청담 스튜디오 결정 취소')[0]!.props.onPress();
    });

    const [, , buttons] = jest.mocked(confirmAlert).mock.calls.at(-1)!;
    const confirm = (buttons as { text: string; onPress?: () => void }[]).find((one) => one.text === '결정 취소')!;

    await act(async () => {
      confirm.onPress!();
      await Promise.resolve();
    });

    expect(removeDecision).toHaveBeenCalledWith('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'studio');
  });
});
