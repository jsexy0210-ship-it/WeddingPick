import { Platform } from 'react-native';

/**
 * 이 창이 카카오 인증 팝업인가.
 *
 * `window.opener`만 보는 이유: 이 앱이 스스로를 팝업으로 여는 경로가 없다
 * (관리자 화면도 별도 오리진이다). 켜져 있다는 것 자체가 다른 창이 이 창을
 * `openAuthSessionAsync`로 열었다는 뜻이다.
 */
export function isAuthPopup(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && window.opener != null;
}

/**
 * 팝업이 할 일은 이것 하나뿐이다 — opener에게 결과를 넘기고 닫힌다.
 *
 * **`WebBrowser.maybeCompleteAuthSession()`은 저절로 실행되지 않는다.** 원래는
 * 로그인 화면(`features/auth/providers.ts`)이 로드될 때 그 모듈 최상단에서
 * 실행되는 부수효과였다. `app/_layout.tsx`가 `isAuthPopup()`일 때 `<Stack>`을
 * 그리지 않으면 라우터가 그 화면 자체를 로드하지 않고, 그 부수효과도 같이
 * 사라진다 — 팝업이 opener에게 결과를 못 넘겨 영원히 안 닫히고, 원래 창도
 * 멈춘 채로 남는 회귀가 실제로 있었다(2026-09-07). 화면을 안 그려도 이 호출만은
 * 직접 한다.
 *
 * `expo-web-browser`를 여기서 지연 `require`하는 이유: 팝업이 아닌 일반 부팅
 * 경로에는 이 모듈이 필요 없다. 정적으로 얹으면 모든 사용자의 번들에 실린다.
 */
export function completeAuthPopup(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- 필요할 때만 부른다.
  const WebBrowser = require('expo-web-browser') as typeof import('expo-web-browser');

  WebBrowser.maybeCompleteAuthSession();
}
