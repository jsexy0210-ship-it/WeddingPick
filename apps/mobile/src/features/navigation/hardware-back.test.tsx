import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BackHandler, Platform } from 'react-native';
import { router } from 'expo-router';

import { EXIT_CONFIRM_MESSAGE, EXIT_CONFIRM_MS, useHardwareBackPolicy } from './hardware-back';
import { withBackOrigin } from './depth-back';

/**
 * 안드로이드 하드웨어 Back — 실제로 'hardwareBackPress' 리스너를 불러 본다(기기 · 에뮬레이터 없음).
 *
 *   MY 하위          → MY 부모
 *   Root 탭 넷       → 홈
 *   홈               → 첫 번째는 안내만, 2초 안의 두 번째만 앱 종료
 *   출처가 있는 화면  → 헤더 Back과 같은 출처(연결관리 → MY · 리얼후기 → 업체 상세 → 리얼후기)
 */
/** 앱 전체 내비게이션 상태 — 시험마다 필요한 것만 채운다(없으면 스택을 모르는 것으로 본다). */
let mockRootState: unknown;

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), dismiss: jest.fn(), dismissTo: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useNavigation: () => ({ setOptions: jest.fn(), addListener: () => () => undefined }),
  useNavigationContainerRef: () => ({ getRootState: () => mockRootState }),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/',
}));

type Listener = () => boolean | null | undefined;

let listeners: Listener[] = [];
let tree: ReactTestRenderer | null = null;
const hints: string[] = [];
const onHint = (message: string) => {
  hints.push(message);
};

function Probe({ path }: { path: string }) {
  useHardwareBackPolicy(path, onHint);
  return null;
}

async function mount(path: string) {
  await act(async () => {
    tree = create(<Probe path={path} />);
  });
}

/** 등록된 가장 최근 리스너부터 부른다 — RN BackHandler와 같은 순서. */
function press(): boolean {
  const listener = listeners[listeners.length - 1];
  if (!listener) throw new Error('hardwareBackPress 리스너가 없다');
  return Boolean(listener());
}

/** 같은 스택이면 dismissTo(없으면 replace), 다른 탭 스택이면 navigate — 어느 쪽이든 도착한 곳. */
function landedOn(): string | undefined {
  return (
    (jest.mocked(router.dismissTo).mock.calls[0]?.[0] as string | undefined) ??
    (jest.mocked(router.navigate).mock.calls[0]?.[0] as string | undefined) ??
    (jest.mocked(router.replace).mock.calls[0]?.[0] as string | undefined)
  );
}

beforeEach(() => {
  listeners = [];
  hints.length = 0;
  mockRootState = undefined;
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    listeners.push(handler as Listener);
    return {
      remove: () => {
        listeners = listeners.filter((item) => item !== handler);
      },
    };
  });
  jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => undefined);
  jest.mocked(router.canGoBack).mockReturnValue(true);
});

afterEach(async () => {
  if (tree) await act(async () => tree?.unmount());
  tree = null;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('안드로이드 하드웨어 Back', () => {
  it.each([
    ['/my/profile', '/my'],
    ['/my/reviews', '/my'],
    ['/my/notifications', '/my'],
    ['/my/contact/inq-1', '/my/contact'],
  ])('MY 하위 %s → %s', async (path, parent) => {
    await mount(path);
    expect(press()).toBe(true);
    /* 같은 MY 스택 — 그 화면까지 접는다. */
    expect(router.dismissTo).toHaveBeenCalledWith(parent);
    expect(landedOn()).toBe(parent);
    expect(router.back).not.toHaveBeenCalled();
    expect(BackHandler.exitApp).not.toHaveBeenCalled();
  });

  it.each(['/search', '/pick', '/wedding', '/my'])('Root 탭 %s → 홈', async (path) => {
    await mount(path);
    expect(press()).toBe(true);
    /* 홈은 다른 탭이다 — POP_TO는 탭이 받지 못해 제자리였다. navigate로 옮긴다. */
    expect(router.navigate).toHaveBeenCalledWith('/');
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(landedOn()).toBe('/');
    expect(hints).toEqual([]);
    expect(BackHandler.exitApp).not.toHaveBeenCalled();
  });

  it('홈에서 한 번만 누르면 안내만 띄우고 앱을 끝내지 않는다', async () => {
    await mount('/');
    expect(press()).toBe(true);
    expect(hints).toEqual([EXIT_CONFIRM_MESSAGE]);
    expect(EXIT_CONFIRM_MESSAGE).toBe('뒤로가기를 한 번 더 누르면 앱이 종료돼요');
    expect(BackHandler.exitApp).not.toHaveBeenCalled();
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('홈에서 2초 안에 두 번 누르면 앱을 끝낸다', async () => {
    jest.useFakeTimers({ now: new Date(2026, 8, 26, 12, 0, 0) });
    await mount('/');
    press();
    jest.advanceTimersByTime(EXIT_CONFIRM_MS - 1);
    expect(press()).toBe(true);
    expect(BackHandler.exitApp).toHaveBeenCalledTimes(1);
    expect(hints).toHaveLength(1);
  });

  it('홈에서 2초가 지난 뒤 다시 누르면 안내를 한 번 더 띄운다', async () => {
    jest.useFakeTimers({ now: new Date(2026, 8, 26, 12, 0, 0) });
    await mount('/');
    press();
    jest.advanceTimersByTime(EXIT_CONFIRM_MS + 1);
    press();
    expect(BackHandler.exitApp).not.toHaveBeenCalled();
    expect(hints).toEqual([EXIT_CONFIRM_MESSAGE, EXIT_CONFIRM_MESSAGE]);
  });

  it.each([
    [withBackOrigin('/wedding/partner', 'my'), '/my'],
    [withBackOrigin('/wedding/partner', 'notifications'), '/my/notifications'],
    [withBackOrigin('/search/v-101', 'community.my'), '/community/review?from=my'],
    [withBackOrigin('/search/v-101', 'reviews'), '/my/reviews'],
    [withBackOrigin('/search/v-101/write-review', 'reviews'), '/my/reviews'],
    /* Pick → «내 조건에 맞는 곳» → 업체 상세(2026-09-26 대표 감사 — 검색으로 갔다). */
    [withBackOrigin('/search/v-101', 'pick'), '/pick'],
    [withBackOrigin('/search/v-101', 'pick/sdm'), '/pick?group=sdm'],
  ])('출처가 있는 %s → %s (헤더 Back과 같은 곳)', async (path, origin) => {
    await mount(path);
    expect(press()).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(origin);
    expect(landedOn()).toBe(origin);
  });

  /*
   * 출처 스택 별칭(`stack-alias.ts`) — 들어온 탭의 스택 안에 섰으니 탭을 건너지 않고 그 스택에서 접는다
   * (navigate가 아니라 dismissTo). 헤더 Back과 같은 목적지다.
   */
  it.each([
    [withBackOrigin('/pick/vendor/v-101', 'pick/sdm'), '/pick?group=sdm'],
    [withBackOrigin('/pick/vendor/v-101/consult', 'pick'), '/pick'],
    ['/pick/compare?ids=v-1,v-2', '/pick'],
    [withBackOrigin('/community/vendor/v-101', 'community.my'), '/community/review?from=my'],
    ['/community/expo/e-1', '/community/expo'],
    [withBackOrigin('/my/vendor/v-101', 'reviews'), '/my/reviews'],
    ['/wedding/wedding-settings', '/wedding'],
    ['/search/contact', '/search'],
  ])('별칭 %s → %s (같은 스택에서 접는다)', async (path, parent) => {
    await mount(path);
    expect(press()).toBe(true);
    expect(router.dismissTo).toHaveBeenCalledWith(parent);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('홈 스택 별칭 /notifications → 홈(탭 전환 · 피드 상세와 같은 길)', async () => {
    await mount('/notifications');
    expect(press()).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith('/');
  });

  it('Pick → 업체 상세(from=pick/sdm) → 사진 → Back은 업체 상세를 꺼낸다 — 출처가 지워지지 않는다', async () => {
    /* 탭 → 검색 스택 [검색 · 업체 상세(from=pick/sdm) · 사진]. */
    mockRootState = {
      type: 'stack',
      index: 0,
      routes: [{
        name: '(tabs)',
        state: {
          type: 'tab',
          index: 1,
          routes: [
            { name: '(home)' },
            {
              name: 'search',
              state: {
                type: 'stack',
                index: 2,
                routes: [
                  { name: 'index' },
                  { name: '[vendorId]/index', params: { vendorId: 'v-101', from: 'pick/sdm' } },
                  { name: '[vendorId]/images', params: { vendorId: 'v-101' } },
                ],
              },
            },
          ],
        },
      }],
    };
    await mount('/search/v-101/images');
    expect(press()).toBe(true);
    /* dismissTo(POP_TO)는 업체 상세의 params를 `{ vendorId }`로 갈아끼워 from=pick/sdm을 지운다. */
    expect(router.dismiss).toHaveBeenCalledWith(1);
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('출처가 없는 업체 상세는 검색으로(운영 확인 경로 회귀 방지)', async () => {
    await mount('/search/v-101');
    press();
    expect(landedOn()).toBe('/search');
  });

  it('피드 상세처럼 History 예외는 기본 처리에 맡긴다', async () => {
    await mount('/community/feed/f-1');
    expect(press()).toBe(false);
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('안드로이드가 아니면 리스너를 걸지 않는다', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await mount('/');
    expect(listeners).toHaveLength(0);
  });

  it('화면이 바뀌면 이전 리스너를 떼고 두 번 누르기 기록을 지운다', async () => {
    jest.useFakeTimers({ now: new Date(2026, 8, 26, 12, 0, 0) });
    await mount('/');
    press();
    await act(async () => tree?.update(<Probe path="/search" />));
    expect(listeners).toHaveLength(1);
    await act(async () => tree?.update(<Probe path="/" />));
    press();
    expect(BackHandler.exitApp).not.toHaveBeenCalled();
    expect(hints).toHaveLength(2);
  });
});
