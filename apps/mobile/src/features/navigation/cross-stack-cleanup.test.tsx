import { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';

import { useDepthBack } from './depth-back';

/**
 * 다른 탭으로 돌아가는 Back(연결관리 → MY · 업체 상세 → MY 후기)은 `navigate`로 옮긴 뒤 **떠난
 * 스택을 접는다.** 접지 않으면 웨딩노트 탭을 다시 눌렀을 때 방금 나온 연결관리가 그대로 떠
 * 있었다(2026-09-26 웹 빌드 실측).
 */

let mockPathname = '/wedding/partner';
let mockFrom: string | undefined = 'my';
let mockState: { type: string; key: string; routes: unknown[]; routeNames: string[] } | null = null;
/** 부모(탭 내비게이터) 상태 — 지금 켜진 탭. */
let mockTabs: { index: number; routes: { name: string }[] } | null = null;
const mockListeners: Record<string, (() => void)[]> = {};
const mockDispatch = jest.fn();
const mockSetOptions = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), dismissTo: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  usePathname: () => mockPathname,
  useLocalSearchParams: () => ({ from: mockFrom }),
  useNavigation: () => ({
    setOptions: mockSetOptions,
    dispatch: mockDispatch,
    getState: () => mockState,
    getParent: () => ({ getState: () => mockTabs }),
    addListener: (event: string, listener: () => void) => {
      (mockListeners[event] ??= []).push(listener);
      return () => {
        mockListeners[event] = (mockListeners[event] ?? []).filter((item) => item !== listener);
      };
    },
  }),
}));

const handle: { back: () => void } = { back: () => undefined };
let tree: ReactTestRenderer | null = null;

function Probe() {
  const depthBack = useDepthBack();
  useEffect(() => {
    handle.back = depthBack;
  }, [depthBack]);
  return null;
}

const back = () => handle.back();

function blur() {
  for (const listener of mockListeners.blur ?? []) listener();
}

async function mount() {
  await act(async () => {
    tree = create(<Probe />);
  });
}

afterEach(async () => {
  if (tree) await act(async () => tree?.unmount());
  tree = null;
  for (const key of Object.keys(mockListeners)) delete mockListeners[key];
  mockTabs = null;
  jest.clearAllMocks();
});

const TABS = ['index', 'search', 'pick', 'wedding', 'my', 'community', '(home)'].map((name) => ({ name }));
const focusTab = (name: string) => {
  mockTabs = { index: TABS.findIndex((tab) => tab.name === name), routes: TABS };
};

describe('다른 탭으로 돌아간 뒤 떠난 스택 정리', () => {
  it('연결관리(웨딩노트 스택 [index, partner]) → MY: navigate 뒤 blur에서 스택을 뿌리로 접는다', async () => {
    mockPathname = '/wedding/partner';
    mockFrom = 'my';
    mockState = { type: 'stack', key: 'wedding-stack', routes: [{}, {}], routeNames: ['index', 'partner'] };
    await mount();

    back();
    expect(router.navigate).toHaveBeenCalledWith('/my');
    expect(router.dismissTo).not.toHaveBeenCalled();
    /* 옮겨 가기 전에는 접지 않는다 — 접히는 모습이 보이지 않게. */
    expect(mockDispatch).not.toHaveBeenCalled();

    blur();
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'POP_TO_TOP', target: 'wedding-stack' });

    /* 한 번만 — 다음 blur(다른 이유)에는 건드리지 않는다. */
    blur();
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it('스택이 그 화면 하나뿐이면(딥링크) 탭 첫 화면으로 갈아끼운다', async () => {
    mockPathname = '/search/v-1';
    mockFrom = 'reviews';
    mockState = { type: 'stack', key: 'search-stack', routes: [{}], routeNames: ['index', '[vendorId]/index'] };
    await mount();

    back();
    expect(router.navigate).toHaveBeenCalledWith('/my/reviews');
    blur();
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'REPLACE', payload: { name: 'index' }, target: 'search-stack' });
  });

  it('같은 스택 Back(초대 수락 → 연결관리)은 정리하지 않는다', async () => {
    mockPathname = '/wedding/join';
    mockFrom = 'partner.my';
    mockState = { type: 'stack', key: 'wedding-stack', routes: [{}, {}, {}], routeNames: ['index', 'partner', 'join'] };
    await mount();

    back();
    expect(router.dismissTo).toHaveBeenCalledWith('/wedding/partner?from=my');
    blur();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('Back을 누르지 않은 blur(연결관리 → 초대 수락을 연 경우)는 정리하지 않는다', async () => {
    mockPathname = '/wedding/partner';
    mockFrom = 'my';
    mockState = { type: 'stack', key: 'wedding-stack', routes: [{}, {}], routeNames: ['index', 'partner'] };
    await mount();

    blur();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('다른 탭 스택으로 돌아가는 화면은 iOS 스와이프를 끈다', async () => {
    mockPathname = '/wedding/partner';
    mockFrom = 'my';
    mockState = { type: 'stack', key: 'wedding-stack', routes: [{}, {}], routeNames: ['index', 'partner'] };
    await mount();
    expect(mockSetOptions).toHaveBeenCalledWith({ gestureEnabled: false });
  });

  it('출처가 없으면 스와이프를 건드리지 않는다', async () => {
    mockPathname = '/wedding/partner';
    mockFrom = undefined;
    mockState = { type: 'stack', key: 'wedding-stack', routes: [{}, {}], routeNames: ['index', 'partner'] };
    await mount();
    expect(mockSetOptions).not.toHaveBeenCalled();
  });

  /*
   * 웹 브라우저 Back은 `backTo`를 거치지 않는다 — 출처 탭으로 옮겨 가며 blur되면 같은 정리를 한다
   * (2026-09-26 웹 빌드 실측: Pick → 업체 상세 → 브라우저 Back → 검색 탭 = 그 업체 상세).
   */
  it('업체 상세(from=pick/sdm)가 출처 탭(Pick)으로 옮겨 가며 blur되면(브라우저 Back) 검색 스택을 접는다', async () => {
    mockPathname = '/search/v-1';
    mockFrom = 'pick/sdm';
    mockState = { type: 'stack', key: 'search-stack', routes: [{}, {}], routeNames: ['index', '[vendorId]/index'] };
    await mount();

    focusTab('pick');
    blur();
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'POP_TO_TOP', target: 'search-stack' });
  });

  it('출처가 아닌 탭(홈)으로 옮겨 간 것은 탭 상태 그대로 둔다', async () => {
    mockPathname = '/search/v-1';
    mockFrom = 'pick';
    mockState = { type: 'stack', key: 'search-stack', routes: [{}, {}], routeNames: ['index', '[vendorId]/index'] };
    await mount();

    focusTab('index');
    blur();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('같은 스택 위에 화면을 올려 blur된 것(업체 상세 → 사진)은 접지 않는다', async () => {
    mockPathname = '/search/v-1';
    mockFrom = 'pick';
    mockState = { type: 'stack', key: 'search-stack', routes: [{}, {}, {}], routeNames: ['index', '[vendorId]/index', '[vendorId]/images'] };
    await mount();

    focusTab('search');
    blur();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('출처가 없으면(검색에서 연 업체 상세) 어느 탭으로 가도 접지 않는다', async () => {
    mockPathname = '/search/v-1';
    mockFrom = undefined;
    mockState = { type: 'stack', key: 'search-stack', routes: [{}, {}], routeNames: ['index', '[vendorId]/index'] };
    await mount();

    focusTab('pick');
    blur();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('리얼후기(from=my) → MY 탭으로 옮겨 가며 blur되면 라운지 스택을 접는다', async () => {
    mockPathname = '/community/review';
    mockFrom = 'my';
    mockState = { type: 'stack', key: 'community-stack', routes: [{}, {}], routeNames: ['index', 'review/index'] };
    await mount();

    focusTab('my');
    blur();
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'POP_TO_TOP', target: 'community-stack' });
  });
});
