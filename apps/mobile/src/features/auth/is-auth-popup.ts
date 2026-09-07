import { Platform } from 'react-native';

/**
 * 이 창이 카카오 인증 팝업인가.
 *
 * `WebBrowser.maybeCompleteAuthSession()`(`features/auth/providers.ts` 최상단)은
 * 이 여부와 무관하게 모듈이 로드되는 순간 실행돼 opener에게 결과를 넘긴다 —
 * 그 동작은 이 함수가 없어도 그대로 된다. 이 함수가 막는 것은 **그 뒤에 이어지던
 * 전체 앱 부팅**뿐이다(`app/_layout.tsx`): 글꼴 로딩, `/v1/me` 등 세션 확인
 * 요청, 최소 1.4초(`SPLASH_MINIMUM_MS`) 스플래시. 팝업은 몇 백 ms 안에 opener가
 * 닫아버리므로 그 요청들은 결과에 쓰이지 않는 채로 허공에 뜬다.
 *
 * `window.opener`만 보는 이유: 이 앱이 스스로를 팝업으로 여는 경로가 없다
 * (관리자 화면도 별도 오리진이다). 켜져 있다는 것 자체가 다른 창이 이 창을
 * `openAuthSessionAsync`로 열었다는 뜻이다.
 */
export function isAuthPopup(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && window.opener != null;
}
