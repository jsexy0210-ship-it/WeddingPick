import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { listLoungeReviews } from '@/api/client';
import { LoungeScreen } from '@/features/community/lounge-screen';

/**
 * 리얼후기 글쓰기 — 바닥 목록을 **한 번만** 읽는다(2026-09-26 대표 제보 「리얼후기 → 글쓰기
 * 클릭 시 바닥페이지가 두 번 로드된다」).
 *
 * 예전에는 헤더 「글쓰기」가 같은 후기 화면을 `?write=review`로 새로 push하고, 업체 선택 · 닫기마다
 * `router.replace`로 화면을 갈아끼웠다 — 바닥 목록이 한 장 더 마운트되고 다시 읽혔다(웹 빌드 실측:
 * 글쓰기 뒤 리얼후기 화면 2장, 업체 선택 뒤 목록 조회 1 → 2). 시트는 이제 같은 화면의 상태로
 * 열고 닫으므로 라우터를 부르지 않고, 목록 조회는 진입 1회 + 작성 완료 뒤 1회뿐이다.
 */
const mockNavigation = { setParams: jest.fn() };
let mockParams: Record<string, string | undefined> = {};

jest.mock('@/api/client', () => ({
  getWeddingFeed: jest.fn(),
  listExpos: jest.fn(),
  listLoungeReviews: jest.fn(),
  setReviewHelpful: jest.fn(),
}));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), setParams: jest.fn() },
    useNavigation: () => mockNavigation,
    Redirect: 'Redirect',
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  };
});
jest.mock('@/features/auth/use-session', () => ({
  useSession: () => ({ state: { status: 'signedIn' }, refresh: jest.fn() }),
}));
jest.mock('@/features/wedding/screen-kit', () => ({ NavBar: 'NavBar' }));
jest.mock('@/features/loading/delayed-loader', () => ({ DelayedLoader: 'DelayedLoader', DelayedLoadingView: 'Loading' }));
/* 두 시트는 여기서 무엇을 부르는지만 본다 — 폼 자체는 각자의 시험이 있다. */
jest.mock('@/app/(tabs)/search/[vendorId]/write-review', () => ({ ReviewWriteSheet: 'ReviewWriteSheet' }));
jest.mock('@/app/(tabs)/community/review/write', () => ({ LoungeReviewVendorSheet: 'LoungeReviewVendorSheet' }));

const { router: mockRouter } = jest.requireMock<{
  router: { push: jest.Mock; replace: jest.Mock; setParams: jest.Mock };
}>('expo-router');

const PAGE = { reviews: [], nextCursor: null, caveat: '' } as unknown as Awaited<ReturnType<typeof listLoungeReviews>>;

let tree: ReactTestRenderer;

async function mount() {
  await act(async () => {
    tree = create(<LoungeScreen kind="review" />);
  });
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
}

type WithProps<P> = { props: P };
const navBar = () =>
  tree.root.findByType('NavBar' as never) as unknown as WithProps<{ right?: { label: string; onPress: () => void } }>;
const vendorSheets = () =>
  tree.root.findAllByType('LoungeReviewVendorSheet' as never) as unknown as WithProps<{
    onClose: () => void;
    onChoose: (vendorId: string) => void;
  }>[];
const writeSheets = () =>
  tree.root.findAllByType('ReviewWriteSheet' as never) as unknown as WithProps<{
    vendorId: string;
    closeOnBrowserBack?: boolean;
    onClose: () => void;
    onSubmitted?: () => void;
  }>[];

function expectNoRouteChange() {
  expect(mockRouter.push).not.toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalled();
}

beforeEach(() => {
  mockParams = {};
  jest.mocked(listLoungeReviews).mockResolvedValue(PAGE);
});

afterEach(async () => {
  jest.clearAllMocks();
  if (tree) await act(async () => tree.unmount());
});

describe('리얼후기 글쓰기 — 같은 화면 위의 오버레이', () => {
  it('글쓰기 → 업체 선택 → 닫기: 라우트를 바꾸지 않고 목록은 진입 때 한 번만 읽는다', async () => {
    await mount();
    await flush();
    expect(listLoungeReviews).toHaveBeenCalledTimes(1);

    await act(async () => navBar().props.right?.onPress());
    expect(vendorSheets()).toHaveLength(1);

    await act(async () => vendorSheets()[0].props.onChoose('vendor-7'));
    expect(vendorSheets()).toHaveLength(0);
    expect(writeSheets()).toHaveLength(1);
    expect(writeSheets()[0].props.vendorId).toBe('vendor-7');
    /* 웹 뒤로가기는 시트만 닫는다. */
    expect(writeSheets()[0].props.closeOnBrowserBack).toBe(true);

    await act(async () => writeSheets()[0].props.onClose());
    await flush();
    expect(writeSheets()).toHaveLength(0);

    expectNoRouteChange();
    expect(listLoungeReviews).toHaveBeenCalledTimes(1);
  });

  it('업체 선택 시트를 닫아도 목록은 다시 읽지 않는다', async () => {
    await mount();
    await flush();

    await act(async () => navBar().props.right?.onPress());
    await act(async () => vendorSheets()[0].props.onClose());
    await flush();

    expect(vendorSheets()).toHaveLength(0);
    expectNoRouteChange();
    expect(listLoungeReviews).toHaveBeenCalledTimes(1);
  });

  it('작성 완료 뒤에는 목록을 딱 한 번 새로 읽는다', async () => {
    await mount();
    await flush();

    await act(async () => navBar().props.right?.onPress());
    await act(async () => vendorSheets()[0].props.onChoose('vendor-7'));
    await act(async () => writeSheets()[0].props.onSubmitted?.());
    await flush();

    expect(writeSheets()).toHaveLength(0);
    expectNoRouteChange();
    expect(listLoungeReviews).toHaveBeenCalledTimes(2);
  });

  it('저장된 딥링크 ?write=review&vendorId= — 주소의 인자를 먼저 지우고, 지워진 뒤 작성 시트를 연다', async () => {
    mockParams = { write: 'review', vendorId: 'vendor-9' };
    /* 내비게이터가 인자를 지우면 화면은 인자 없이 다시 그려진다. */
    mockNavigation.setParams.mockImplementation(() => {
      mockParams = {};
    });
    await mount();
    await flush();

    expect(mockNavigation.setParams).toHaveBeenCalledWith({ write: undefined, vendorId: undefined });

    await act(async () => tree.update(<LoungeScreen kind="review" />));

    expect(writeSheets()).toHaveLength(1);
    expect(writeSheets()[0].props.vendorId).toBe('vendor-9');
    expectNoRouteChange();
    expect(listLoungeReviews).toHaveBeenCalledTimes(1);

    /* 닫은 뒤 다시 그려져도(인자가 지워졌으니) 다시 열리지 않는다. */
    await act(async () => writeSheets()[0].props.onClose());
    await act(async () => tree.update(<LoungeScreen kind="review" />));
    expect(writeSheets()).toHaveLength(0);
  });

  it('저장된 딥링크 ?write=review 로 들어오면 업체 선택 시트부터 연다', async () => {
    mockParams = { write: 'review', from: 'my' };
    mockNavigation.setParams.mockImplementation(() => {
      mockParams = { from: 'my' };
    });
    await mount();
    await flush();
    await act(async () => tree.update(<LoungeScreen kind="review" />));

    expect(vendorSheets()).toHaveLength(1);
    expect(writeSheets()).toHaveLength(0);
    expect(listLoungeReviews).toHaveBeenCalledTimes(1);
  });

  it('인자 지우기가 계속 흘려지면 다시 부르다가 2초 뒤에는 시트를 그대로 연다', async () => {
    jest.useFakeTimers();
    try {
      mockParams = { write: 'review', vendorId: 'vendor-9' };
      await mount();
      await act(async () => {
        jest.advanceTimersByTime(1_000);
      });
      expect(mockNavigation.setParams.mock.calls.length).toBeGreaterThan(5);
      expect(writeSheets()).toHaveLength(0);

      await act(async () => {
        jest.advanceTimersByTime(1_200);
      });
      expect(writeSheets()).toHaveLength(1);
      const calls = mockNavigation.setParams.mock.calls.length;
      await act(async () => {
        jest.advanceTimersByTime(1_000);
      });
      expect(mockNavigation.setParams.mock.calls.length).toBe(calls);
    } finally {
      jest.useRealTimers();
    }
  });
});
