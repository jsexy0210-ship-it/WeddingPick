import React from 'react';
import { ScrollView } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { getExpenses, listMyReports, refreshReads } from '@/api/client';
import { showResultToast } from '@/features/navigation/result-toast';
import MyReportsScreen from '@/app/(tabs)/my/reports';
import ExpenseListScreen from '@/app/(tabs)/wedding/[id]/expenses/list';

/**
 * 화면에 실제로 붙었는가 — 두 화면을 그려 스크롤의 `refreshControl`을 당긴다.
 *
 *   MY › Pick 인증내역   SubScreen 껍데기(목록 화면 공통)
 *   웨딩노트 › 지출내역   ScrollView를 직접 쓰는 화면
 *
 * 당기면 캐시를 건너뛰는 창(`refreshReads`) 안에서 그 화면의 읽기가 다시 돌고, 실패해도 보이던
 * 내용은 오류 화면으로 바뀌지 않고 한 줄 토스트만 뜬다.
 */
jest.mock('@/api/client', () => ({
  listMyReports: jest.fn(),
  getExpenses: jest.fn(),
  refreshReads: jest.fn(),
}));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn() },
    useLocalSearchParams: () => ({ id: 'wedding-1' }),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  };
});
jest.mock('@/features/navigation/result-toast', () => ({ showResultToast: jest.fn() }));
jest.mock('@/features/navigation/depth-back', () => ({ useDepthBack: () => jest.fn() }));
jest.mock('@/features/loading/delayed-loader', () => ({ DelayedLoadingView: 'Loading' }));
jest.mock('@/features/settings/my-kit', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  return {
    SubScreen: ({ children, refreshControl }: { children: React.ReactNode; refreshControl?: React.ReactElement }) =>
      createElement('SubScreen', { refreshControl }, children),
    Badge: 'Badge',
    EmptyBox: 'EmptyBox',
    Hero: 'Hero',
    Section: 'Section',
    SubScreenStatus: 'SubScreenStatus',
  };
});
jest.mock('@/features/wedding/screen-kit', () => ({ NavBar: 'NavBar', Screen: 'Screen' }));

type Pullable = { props: { refreshControl?: React.ReactElement<{ onRefresh?: () => void; refreshing?: boolean }> } };

let tree: ReactTestRenderer;

async function mount(element: React.ReactElement) {
  await act(async () => {
    tree = create(element);
  });
}

async function pull(target: Pullable) {
  const control = target.props.refreshControl;
  expect(control).toBeDefined();
  await act(async () => {
    control?.props.onRefresh?.();
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
}

beforeEach(() => {
  jest.mocked(refreshReads).mockImplementation(async (run) => {
    await run();
  });
});

afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});

const EMPTY_REPORTS = { reports: [] } as unknown as Awaited<ReturnType<typeof listMyReports>>;
const PAGE = {
  expenses: [
    { id: 'e1', label: '웨딩홀 계약금', amount: 1_000_000, status: 'paid', source: 'manual', sourceLabel: '직접 입력', spentOn: null },
  ],
} as unknown as Awaited<ReturnType<typeof getExpenses>>;

describe('당겨서 새로 고침 — 화면 연결', () => {
  it('MY › Pick 인증내역: 당기면 캐시를 건너뛰는 창에서 다시 읽는다', async () => {
    jest.mocked(listMyReports).mockResolvedValue(EMPTY_REPORTS);
    await mount(<MyReportsScreen />);
    expect(listMyReports).toHaveBeenCalledTimes(1);

    await pull(tree.root.findByType('SubScreen' as never) as unknown as Pullable);

    expect(refreshReads).toHaveBeenCalledTimes(1);
    expect(listMyReports).toHaveBeenCalledTimes(2);
  });

  it('MY › Pick 인증내역: 새로 고침이 실패해도 목록은 남고 토스트만 뜬다', async () => {
    jest.mocked(listMyReports).mockResolvedValueOnce(EMPTY_REPORTS).mockRejectedValueOnce(new Error('끊김'));
    await mount(<MyReportsScreen />);

    await pull(tree.root.findByType('SubScreen' as never) as unknown as Pullable);

    expect(tree.root.findAllByType('SubScreen' as never)).toHaveLength(1);
    expect(showResultToast).toHaveBeenCalledWith('정보를 불러오지 못했어요');
  });

  it('웨딩노트 › 지출내역: 스크롤에 붙어 있고 당기면 다시 읽는다 · 실패해도 줄이 남는다', async () => {
    jest.mocked(listMyReports).mockResolvedValue(EMPTY_REPORTS);
    jest.mocked(getExpenses).mockResolvedValueOnce(PAGE).mockRejectedValueOnce(new Error('끊김'));
    await mount(<ExpenseListScreen />);
    expect(getExpenses).toHaveBeenCalledWith('wedding-1');

    const scroll = tree.root.findByType(ScrollView) as unknown as Pullable;
    await pull(scroll);

    expect(refreshReads).toHaveBeenCalledTimes(1);
    expect(getExpenses).toHaveBeenCalledTimes(2);
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(1);
    expect(tree.root.findAll((node) => node.props.accessibilityLabel === '웨딩홀 계약금 100만원')).not.toHaveLength(0);
    expect(showResultToast).toHaveBeenCalledWith('정보를 불러오지 못했어요');
  });
});
