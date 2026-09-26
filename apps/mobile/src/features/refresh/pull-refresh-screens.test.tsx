import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { listMyReports, refreshReads } from '@/api/client';
import { showResultToast } from '@/features/navigation/result-toast';
import MyReportsScreen from '@/app/(tabs)/my/reports';
import ExpenseListRedirect from '@/app/(tabs)/wedding/[id]/expenses/list';

/**
 * 화면에 실제로 붙었는가 — 두 화면을 그려 스크롤의 `refreshControl`을 당긴다.
 *
 *   MY › Pick 인증내역   SubScreen 껍데기(목록 화면 공통)
 *
 * 웨딩노트 › 지출내역 풀팝업은 2026-09-26 예산현황 목록으로 통합돼 지웠다 — 그 주소는 예산 탭으로
 * 돌려보내고, 당겨서 새로 고침은 웨딩노트 한 스크롤(`wedding/index.tsx`)이 맡는다(붙은 자리 시험).
 *
 * 당기면 캐시를 건너뛰는 창(`refreshReads`) 안에서 그 화면의 읽기가 다시 돌고, 실패해도 보이던
 * 내용은 오류 화면으로 바뀌지 않고 한 줄 토스트만 뜬다.
 */
jest.mock('@/api/client', () => ({
  listMyReports: jest.fn(),
  refreshReads: jest.fn(),
}));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn() },
    Redirect: ({ href }: { href: string }) =>
      jest.requireActual<typeof import('react')>('react').createElement('Redirect', { href }),
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

  it('웨딩노트 › 지출내역: 풀팝업은 지웠고 저장된 주소는 예산 탭으로 돌려보낸다', async () => {
    await mount(<ExpenseListRedirect />);
    const redirect = tree.root.findByType('Redirect' as never) as unknown as { props: { href: string } };
    expect(redirect.props.href).toBe('/wedding?tab=budget');
  });
});
