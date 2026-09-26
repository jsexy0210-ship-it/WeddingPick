import { router } from 'expo-router';

import { goDepthBack, withBackOrigin } from './depth-back';

/**
 * SPEC §14.5의 "Depth 기본, History는 명시된 예외만" 계약을 잰다. 계층 목적지 자체는
 * `depth-back.test.ts`(`depthBackTarget`)가 표로 잡는다.
 */
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    dismissTo: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(),
  },
}));

describe('goDepthBack — Depth 기본, 명시된 화면만 History Back', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('MY 상세는 기록이 있어도 논리 부모인 MY 홈으로 간다', () => {
    jest.mocked(router.canGoBack).mockReturnValue(true);

    goDepthBack('/my/profile');

    expect(router.back).not.toHaveBeenCalled();
    expect(router.dismissTo).toHaveBeenCalledWith('/my');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('일반 상세도 기록을 추측하지 않고 계층 부모로 간다', () => {
    jest.mocked(router.canGoBack).mockReturnValue(true);

    goDepthBack('/search/v-101');

    expect(router.back).not.toHaveBeenCalled();
    expect(router.dismissTo).toHaveBeenCalledWith('/search');
  });

  it.each([
    '/feed/f-1',
    '/community/feed/f-1',
  ])('%s는 기록이 있을 때만 명시적인 History Back이다', (pathname) => {
    jest.mocked(router.canGoBack).mockReturnValue(true);

    goDepthBack(pathname);

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('History 예외도 직접 진입이면 계층 fallback으로 간다', () => {
    jest.mocked(router.canGoBack).mockReturnValue(false);

    goDepthBack('/community/feed/f-1');

    expect(router.back).not.toHaveBeenCalled();
    expect(router.dismissTo).toHaveBeenCalledWith('/community/feed');
  });

  it('기록이 없고 부모도 스택에 없으면(딥링크) dismissTo 실패 뒤 replace로 갈아끼운다', () => {
    jest.mocked(router.canGoBack).mockReturnValue(false);
    jest.mocked(router.dismissTo).mockImplementation(() => {
      throw new Error('nothing to dismiss to');
    });

    goDepthBack('/search/v-101/images');

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/search/v-101');
  });
});

/*
 * 2026-09-26 웹 빌드 실측 — 출처가 다른 탭이면 `dismissTo`(POP_TO)를 탭이 받지 못해 헤더 Back이
 * 제자리였다. 다른 탭 스택으로 가는 Back은 navigate, 같은 스택은 그대로 dismissTo다.
 */
describe('goDepthBack — 다른 탭 스택으로 가는 Back', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['/wedding/partner?from=my', '/my'],
    ['/wedding/partner?from=notifications', '/my/notifications'],
    ['/search/v-101?from=reviews', '/my/reviews'],
    ['/search/v-101?from=community.my', '/community/review?from=my'],
    ['/feed/f-1', '/'],
  ])('%s → navigate(%s)', (pathname, target) => {
    jest.mocked(router.canGoBack).mockReturnValue(false);

    goDepthBack(pathname);

    expect(router.navigate).toHaveBeenCalledWith(target);
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it.each([
    ['/my/reviews', '/my'],
    ['/wedding/join?from=partner.my', '/wedding/partner?from=my'],
    ['/wedding/partner', '/wedding'],
  ])('같은 스택 %s → dismissTo(%s)', (pathname, target) => {
    jest.mocked(router.canGoBack).mockReturnValue(true);

    goDepthBack(pathname);

    expect(router.dismissTo).toHaveBeenCalledWith(target);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});

describe('withBackOrigin', () => {
  it('usePathname에서 빠진 단일 from만 안전하게 다시 붙인다', () => {
    expect(withBackOrigin('/community', 'my')).toBe('/community?from=my');
    expect(withBackOrigin('/community', ['my', 'pick'])).toBe('/community?from=my');
    expect(withBackOrigin('/community')).toBe('/community');
  });
});
