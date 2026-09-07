import { Platform } from 'react-native';

import { isAuthPopup } from './is-auth-popup';

/**
 * 카카오 인증 팝업 판별.
 *
 * `window.opener`가 있으면 전체 앱 부팅(글꼴 로딩·세션 확인 요청·최소 1.4초
 * 스플래시)을 건너뛴다. `maybeCompleteAuthSession()`의 opener 통지는 이 판별과
 * 무관하게 모듈 로드 시점에 이미 실행되므로, 여기서 막아도 인증 결과 전달은
 * 그대로 된다 — 화면만 안 그린다.
 *
 * 네이티브에서는 팝업이라는 개념 자체가 없다 — Platform.OS를 'web'으로 고정한다.
 */
describe('카카오 인증 팝업 판별', () => {
  const originalOS = Platform.OS;
  const originalOpener = window.opener;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    Object.defineProperty(window, 'opener', { value: originalOpener, configurable: true });
  });

  it('opener가 있으면 팝업으로 본다', () => {
    Object.defineProperty(window, 'opener', { value: {}, configurable: true });
    expect(isAuthPopup()).toBe(true);
  });

  it('opener가 없으면 팝업이 아니다', () => {
    Object.defineProperty(window, 'opener', { value: null, configurable: true });
    expect(isAuthPopup()).toBe(false);
  });

  it('네이티브에서는 opener가 있어도 팝업으로 보지 않는다', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    Object.defineProperty(window, 'opener', { value: {}, configurable: true });
    expect(isAuthPopup()).toBe(false);
  });
});
