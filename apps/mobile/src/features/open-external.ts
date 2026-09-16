import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

import { isOurSite } from '@/features/in-app-web/our-site';
import { noticeInAppWeb, openInAppWeb } from '@/features/in-app-web/shell-store';

/**
 * 바깥 주소를 **앱 «안»에서** 연다.
 *
 * 2026-09-15 대표 지시 — 「인앱에서 웹 새창 또는 이동 시 앱을 탈출하게 된다.
 * 하여 iframe 껍데기 씌워서 웨딩픽 앱 밖으로 나가지 못하게 한다」 ·
 * 「서비스이용약관 개인정보처리방침 약관 관련된것도 다 In-App Browser 형태로
 * 변경한다」(CLAUDE.md 「앱 밖으로 나가지 않는다」).
 *
 *     네이티브(iOS · 안드로이드)   `expo-web-browser`의 인앱 브라우저. 주소를
 *                                 가리지 않는다 — 시스템 시트가 앱 «위에» 뜨고
 *                                 닫으면 돌아온다.
 *     웹 · 우리 사이트             우리 화면 안의 iframe 껍데기
 *                                 (`features/in-app-web`). 닫기는 우리가 그린다.
 *     웹 · 남의 사이트             누른 그 순간 새 탭으로 열고 알린다. 감쌀 수
 *                                 없어서가 아니라 **거절당한 것을 알아낼 방법이
 *                                 없어서**다 — 근거는 `our-site.ts`에 쟀다.
 *
 * **예전에는 둘 다 앱을 떠났다** — 웹은 `window.open(_blank)`, 네이티브는
 * `Linking.openURL`이었다. 약관 · 방침 넷이 이 함수를 쓰므로 여기 하나만
 * 바꾸면 그 넷이 같이 바뀐다.
 *
 * `expo-web-browser`는 이미 들어 있다 — 로그인이 쓴다(`features/auth/providers.ts`).
 * 새로 넣은 의존성은 없다.
 */
export type OpenExternalOptions = {
  /**
   * 껍데기 머리에 적을 이름(웹). 주소의 호스트를 쓰지 않는 이유는 영문이
   * 사용자 화면에 뜨기 때문이다 — 부르는 쪽이 한글 제목을 안다.
   */
  title?: string;
  /**
   * **다른 앱에 넘기는 자리인가.** 참이면 앱 밖으로 나간다.
   *
   * 지도(`map.kakao.com`)와 달력(`.ics`)이 여기다 — 지도 앱에서 길을 찾고
   * 달력 앱에 일정을 넣는 것이 목적이라 앱 안에 가두면 그 일을 못 한다.
   *
   * **주소를 보고 가르지 않는다.** `map.kakao.com`이면 내보낸다는 식으로 짜면
   * 네이버 지도가 붙는 날 · 주소가 한 글자 바뀌는 날 조용히 샌다. 넘기는
   * 자리라는 것은 부르는 쪽만 아는 사실이므로 부르는 쪽이 말하게 한다.
   */
  handOff?: boolean;
};

/** 부르는 쪽이 제목을 주지 않았을 때 껍데기 머리에 적는 이름. */
const DEFAULT_TITLE = '웨딩픽';

export async function openExternal(url: string, options: OpenExternalOptions = {}): Promise<void> {
  if (options.handOff) {
    await Linking.openURL(url);

    return;
  }

  if (Platform.OS !== 'web') {
    /*
     * 기본값 그대로 연다 — iOS는 `SFSafariViewController`, 안드로이드는 Chrome
     * Custom Tabs다. 둘 다 앱 «위에» 뜨고 닫으면 앱으로 돌아온다. 색·표시
     * 옵션을 얹지 않는 이유는 박람회 화면이 이미 기본값으로 부르고 있어서,
     * 같은 인앱 브라우저가 자리마다 달라 보이지 않게 하기 위해서다.
     */
    await WebBrowser.openBrowserAsync(url);

    return;
  }

  if (isOurSite(url)) {
    openInAppWeb({ url, title: options.title ?? DEFAULT_TITLE });

    return;
  }

  /*
   * **`await` 앞에서 연다.** 여기까지는 누름과 같은 실행 흐름이라 브라우저가
   * 사용자 제스처로 인정한다 — 한 번이라도 기다렸다 열면 팝업 차단에 막히고,
   * 막힌 채로 「새 창에서 열려요」만 남으면 아무 일도 안 일어난 것과 같다.
   */
  window.open(url, '_blank', 'noopener,noreferrer');
  noticeInAppWeb('newWindow');
}
