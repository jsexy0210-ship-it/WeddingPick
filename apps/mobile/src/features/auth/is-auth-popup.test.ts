import { Platform } from 'react-native';

const mockMaybeCompleteAuthSession = jest.fn();
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: mockMaybeCompleteAuthSession }));

import { completeAuthPopup, isAuthPopup } from './is-auth-popup';

/**
 * 카카오 인증 팝업 판별과 완료 처리.
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

/**
 * `completeAuthPopup()`이 실제로 opener에게 결과를 넘기는지.
 *
 * `WebBrowser.maybeCompleteAuthSession()`은 저절로 실행되지 않는다 — 이전에는
 * 로그인 화면이 로드될 때 딸려 오는 부수효과였는데, `app/_layout.tsx`가
 * `isAuthPopup()`일 때 `<Stack>`을 안 그리게 하면서 그 화면 자체가 로드되지
 * 않아 이 호출도 같이 사라졌다. 팝업이 opener에게 결과를 못 넘겨 영원히 안
 * 닫히고, 원래 창도 멈춘 채로 남는 회귀가 실제로 있었다(2026-09-07). 그 회귀를
 * 다시 잡는다.
 */
describe('카카오 인증 팝업 완료', () => {
  it('expo-web-browser의 maybeCompleteAuthSession을 부른다', () => {
    completeAuthPopup();

    expect(mockMaybeCompleteAuthSession).toHaveBeenCalledTimes(1);
  });
});
