import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/**
 * 바깥 주소(약관 전문 등)를 **앱 안에서** 연다.
 *
 * 2026-09-15 대표 지시 — 「인앱에서 웹 새창 또는 이동 시 앱을 탈출하게 된다. 하여
 * iframe 껍데기 씌워서 웨딩픽 앱 밖으로 나가지 못하게 한다」 · 「서비스이용약관
 * 개인정보처리방침 약관 관련된것도 다 In-App Browser 형태로 변경한다」.
 *
 * **전에는 앱을 떠났다.** 네이티브는 `Linking.openURL`(OS 브라우저로 넘김), 웹은
 * `window.open(_blank)`였다. 둘 다 사용자를 웨딩픽 밖으로 내보낸다 — 돌아오려면
 * 사용자가 직접 앱을 다시 찾아야 한다.
 *
 * ```
 * 네이티브   expo-web-browser의 인앱 브라우저. 시스템 시트가 앱 «위에» 뜨고
 *            닫으면 앱으로 돌아온다. 스택을 잃지 않는다.
 * 웹         아직 새 탭이다 — 우리 화면 안의 iframe 껍데기가 없다(아래).
 * ```
 *
 * **웹 쪽은 아직 규칙을 못 지킨다.** 껍데기 화면을 새로 그려야 하는 일이라 감독
 * 세션이 밀지 않고 넘겼다(`docs/sync/design-policy-audit.md` 10차). 그때까지
 * `noopener,noreferrer`를 유지한다 — 새 탭이 우리 창을 건드리지 못하게 하는 것은
 * 껍데기가 생기기 전까지도 지켜야 한다.
 *
 * **우리 사이트는 iframe에 들어간다**(2026-09-15 재어 확인 — `X-Frame-Options`도
 * CSP `frame-ancestors`도 없다). 약관·방침은 우리 사이트가 정본이므로 껍데기로
 * 감쌀 수 있다. **그 헤더를 나중에 켜면 약관 화면이 빈 칸이 된다** — 보안 헤더를
 * 더할 때 이 줄을 같이 본다.
 *
 * **지도와 달력은 이 함수를 쓰지 않는다.** `map.kakao.com`과 `.ics` 내려받기는
 * 다른 앱에 넘기는 것이 목적이라 `Linking.openURL`을 그대로 쓴다 — 앱 안에 가두면
 * 길 찾기와 일정 넣기를 못 한다.
 */
export async function openExternal(url: string): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');

    return;
  }

  await WebBrowser.openBrowserAsync(url);
}
