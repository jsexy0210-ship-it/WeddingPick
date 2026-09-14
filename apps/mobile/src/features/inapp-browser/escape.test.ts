import { Platform } from 'react-native';

const mockHasKakaoReturn = jest.fn(() => false);
jest.mock('@/features/auth/providers', () => ({ hasKakaoReturn: () => mockHasKakaoReturn() }));

import { escapeInAppBrowser } from './escape';

const KAKAO_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-S908N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36 KAKAOTALK 10.4.3';
const INSTAGRAM_ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-S908N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36 Instagram 302.0.0.23.113 Android';
const INSTAGRAM_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 302.0.0.23.113';
const CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36';

const originalOS = Platform.OS;
const replaceState = jest.fn();

/**
 * 테스트는 네이티브(node) 환경에서 돈다 — `window`는 있지만(react-native jest
 * 설정이 전역에 잇는다) 브라우저가 주는 `location`·`history`·`sessionStorage`는
 * 없다. 웹에서만 도는 코드라서 그 자리들을 직접 놓아준다.
 */
const store = new Map<string, string>();
const sessionStorageStub = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
};

function define(name: string, value: unknown): void {
  Object.defineProperty(window, name, { value, configurable: true, writable: true });
}

/** jsdom이 아니라 대역이다 — 주소를 「옮기면」 `href`에 그 값이 남는다. */
function setLocation(href: string): void {
  const parsed = new URL(href);

  define('location', {
    href,
    origin: parsed.origin,
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash,
  });
}

function setUserAgent(userAgent: string): void {
  define('navigator', { userAgent });
}

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  replaceState.mockClear();
  mockHasKakaoReturn.mockReturnValue(false);
  store.clear();
  define('history', { replaceState });
  define('sessionStorage', sessionStorageStub);
  setLocation('https://weddingpick-app-web.onrender.com/login');
  setUserAgent(CHROME_UA);
});

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
});

/**
 * 아무 일도 하지 않아야 하는 자리들. 여기서 창을 옮기면 멀쩡히 쓰던 사람이
 * 화면을 잃는다.
 */
describe('건드리지 않는 자리', () => {
  it('네이티브에서는 아무 일도 하지 않는다', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    setUserAgent(KAKAO_UA);

    expect(escapeInAppBrowser()).toEqual({ kind: 'none' });
    expect(window.location.href).toBe('https://weddingpick-app-web.onrender.com/login');
  });

  it('일반 브라우저는 그냥 둔다', () => {
    expect(escapeInAppBrowser()).toEqual({ kind: 'none' });
    expect(window.location.href).toBe('https://weddingpick-app-web.onrender.com/login');
  });

  it('관리자 콘솔에서는 하지 않는다 — PC에서 쓰는 화면이다', () => {
    setLocation('https://weddingpick-app-web.onrender.com/admin/vendors');
    setUserAgent(KAKAO_UA);

    expect(escapeInAppBrowser()).toEqual({ kind: 'none' });
    expect(window.location.href).toBe('https://weddingpick-app-web.onrender.com/admin/vendors');
  });

  it('네이티브 쉘의 웹뷰(wp_token)에서는 하지 않는다', () => {
    setLocation('https://weddingpick-app-web.onrender.com/?wp_token=abc');
    setUserAgent(KAKAO_UA);

    expect(escapeInAppBrowser()).toEqual({ kind: 'none' });
    expect(window.location.href).toBe('https://weddingpick-app-web.onrender.com/?wp_token=abc');
  });

  /**
   * 코드를 세션으로 바꾸려면 떠나기 전에 적어둔 PKCE verifier가 필요하고, 그것은
   * 이 브라우저의 저장소에 있다. 여기서 넘기면 코드만 건너가고 로그인이 깨진다.
   */
  it('카카오에서 돌아온 직후에는 하지 않는다', () => {
    setLocation('https://weddingpick-app-web.onrender.com/setup?code=xyz');
    setUserAgent(KAKAO_UA);
    mockHasKakaoReturn.mockReturnValue(true);

    expect(escapeInAppBrowser()).toEqual({ kind: 'none' });
    expect(window.location.href).toBe('https://weddingpick-app-web.onrender.com/setup?code=xyz');
  });
});

const kakaoHref = (url: string) =>
  `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;

describe('바깥 브라우저로 넘기기', () => {
  it('카카오톡 인앱은 openExternal 스킴으로 넘기고 돌아올 표식을 붙인다', () => {
    setUserAgent(KAKAO_UA);

    const href = kakaoHref('https://weddingpick-app-web.onrender.com/login?wp_ext=1');

    /* 자동으로 옮기고도 누를 자리를 남긴다 — 스킴 이동이 막히는 인앱이 있다. */
    expect(escapeInAppBrowser()).toEqual({ kind: 'manual', href });
    expect(window.location.href).toBe(href);
  });

  it('원래 주소의 쿼리를 잃지 않는다', () => {
    setLocation('https://weddingpick-app-web.onrender.com/search?q=hall&sort=new');
    setUserAgent(KAKAO_UA);

    escapeInAppBrowser();

    expect(window.location.href).toBe(
      kakaoHref('https://weddingpick-app-web.onrender.com/search?q=hall&sort=new&wp_ext=1')
    );
  });

  it('안드로이드 기타 인앱은 크롬을 지목한 intent 주소로 넘긴다', () => {
    setUserAgent(INSTAGRAM_ANDROID_UA);

    expect(window.location.href).toBe('https://weddingpick-app-web.onrender.com/login');
    expect(escapeInAppBrowser()).toEqual({
      kind: 'manual',
      href: 'intent://weddingpick-app-web.onrender.com/login?wp_ext=1#Intent;scheme=https;package=com.android.chrome;end',
    });
  });

  /**
   * **iOS 기타 인앱에서는 억지로 시도하지 않는다.** 사파리를 강제로 띄우는 공개
   * API가 없다 — 안 되는 것을 되는 척하면 빈 화면이나 멈춘 화면만 남는다.
   * 누를 자리도 두지 않는다. 눌러도 갈 곳이 없다.
   */
  it('iOS 기타 인앱은 넘기지 않고 안내만 한다', () => {
    setUserAgent(INSTAGRAM_IOS_UA);

    expect(escapeInAppBrowser()).toEqual({ kind: 'guide' });
    expect(window.location.href).toBe('https://weddingpick-app-web.onrender.com/login');
  });
});

/**
 * 무한 반복 방지. 탈출한 뒤 돌아온 주소에서 또 나가면 창이 계속 튄다.
 *
 * **자동 이동만 막는다.** 누를 자리는 남긴다 — 자동으로 못 나간 사람에게서
 * 그 자리까지 뺏으면 할 수 있는 일이 없어진다.
 */
describe('되풀이 막기', () => {
  it('한 번 옮긴 웹뷰에서는 자동으로 다시 옮기지 않는다', () => {
    setUserAgent(KAKAO_UA);
    escapeInAppBrowser();

    setLocation('https://weddingpick-app-web.onrender.com/login');

    expect(escapeInAppBrowser()).toEqual({
      kind: 'manual',
      href: kakaoHref('https://weddingpick-app-web.onrender.com/login?wp_ext=1'),
    });
    expect(window.location.href).toBe('https://weddingpick-app-web.onrender.com/login');
  });

  it('표식이 붙어 돌아온 주소에서는 표식을 지우고 자동으로 옮기지 않는다', () => {
    setLocation('https://weddingpick-app-web.onrender.com/login?wp_ext=1');
    setUserAgent(KAKAO_UA);

    escapeInAppBrowser();

    expect(replaceState).toHaveBeenCalledWith(null, '', '/login');
    expect(window.location.href).toBe('https://weddingpick-app-web.onrender.com/login?wp_ext=1');
  });

  it('표식과 함께 온 다른 쿼리는 남긴다', () => {
    setLocation('https://weddingpick-app-web.onrender.com/search?wp_ext=1&q=hall');
    setUserAgent(KAKAO_UA);

    escapeInAppBrowser();

    expect(replaceState).toHaveBeenCalledWith(null, '', '/search?q=hall');
  });

  /** 표식을 지운 주소로 다시 물어도, 누를 자리에는 표식이 다시 붙는다. */
  it('표식을 지운 뒤 그 창이 다시 떠도 자동으로 옮기지 않는다', () => {
    setLocation('https://weddingpick-app-web.onrender.com/login?wp_ext=1');
    setUserAgent(KAKAO_UA);
    escapeInAppBrowser();

    setLocation('https://weddingpick-app-web.onrender.com/login');

    expect(escapeInAppBrowser()).toEqual({
      kind: 'manual',
      href: kakaoHref('https://weddingpick-app-web.onrender.com/login?wp_ext=1'),
    });
    expect(window.location.href).toBe('https://weddingpick-app-web.onrender.com/login');
  });

  it('일반 브라우저에서는 표식이 붙어 와도 아무것도 남기지 않는다', () => {
    setLocation('https://weddingpick-app-web.onrender.com/login?wp_ext=1');

    expect(escapeInAppBrowser()).toEqual({ kind: 'none' });
    expect(replaceState).toHaveBeenCalledWith(null, '', '/login');
  });
});
