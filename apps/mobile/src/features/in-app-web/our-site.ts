import { SITE_ORIGIN } from '@weddingpick/domain';

/**
 * 이 주소를 앱 «안»의 iframe 껍데기로 열 수 있는가.
 *
 * **우리 사이트만 감싼다.** 약관 · 방침의 정본이 거기 있고(CLAUDE.md 「약관과
 * 개인정보처리방침의 정본은 웹사이트다」), 그 응답에 `X-Frame-Options`도 CSP
 * `frame-ancestors`도 없다는 것을 2026-09-15에 쟀다. 대표 지시가 이름으로 짚은
 * 화면 넷이 전부 여기로 들어온다.
 *
 * **남의 사이트는 감싸려고 시도하지 않는다.** 대부분 `X-Frame-Options: DENY`나
 * CSP `frame-ancestors`로 거절하고 우리가 못 바꾼다 — 거기까지는 예상대로다.
 * 문제는 **거절당한 것을 브라우저가 알려주지 않는다**는 데 있다.
 *
 * 처음에는 `load` 뒤에 `contentDocument`가 읽히는지로 갈랐다(이동이 취소되면
 * 우리 출처의 빈 문서가 남는다는 옛 동작). **2026-09-16에 크로미움으로 직접
 * 재 보니 틀렸다** — 허용 응답과 `X-Frame-Options: DENY` 응답이 부모 쪽에서
 * 완전히 같았다. 둘 다 `load`가 한 번 뜨고, `contentDocument`는 `null`,
 * `contentWindow.location`은 예외, `contentWindow.length`는 0, 리소스 타이밍도
 * `transferSize` 0 · `responseStatus` 0으로 같았다. 거절당한 프레임은
 * `chrome-error://chromewebdata/`로 가 있지만 그 주소마저 부모는 못 읽는다.
 *
 * 그래서 「일단 감싸 보고 안 되면 새 탭」은 **웹에서 만들 수 없는 동작이다.**
 * 알아챌 방법이 없으면 남는 것은 빈 칸뿐이고, 빈 칸을 보여주고 끝내지 않는 것이
 * 이 기능의 요구사항이다. 남의 주소는 웹에서 «누른 그 순간» 새 탭으로 열고
 * 「새 창에서 열려요」를 알린다 — 누른 순간이라 팝업 차단에도 걸리지 않는다.
 *
 * **네이티브에는 이 제약이 없다.** `expo-web-browser`의 인앱 브라우저는 iframe이
 * 아니라 시스템 브라우저 시트라서 `X-Frame-Options`와 무관하다. 그쪽은 남의
 * 주소도 전부 앱 위에서 연다(`open-external.ts`).
 *
 * 주소를 손으로 적은 목록으로 가르지 않는다 — `SITE_ORIGIN` 하나를 본다.
 * 사이트 주소가 바뀌면 그 상수와 함께 움직인다.
 */
export function isOurSite(url: string): boolean {
  try {
    return new URL(url).origin === SITE_ORIGIN;
  } catch {
    return false;
  }
}

/**
 * 껍데기가 `load`를 이만큼 기다린다. 넘으면 「불러오지 못했어요」와 새 창 단추를
 * 그린다.
 *
 * 우리 사이트라고 늘 뜨는 것은 아니다 — 회선이 끊기거나 배포 중이면 응답이
 * 없다. 그때 빈 칸을 계속 보여주지 않기 위한 마지막 그물이다.
 *
 * 6초는 느린 회선을 오해하지 않는 선이다. 3G에서 첫 응답이 2~3초까지 나온다.
 *
 * **자동으로 새 탭을 열지 않는다.** 여기는 누름에서 멀어진 자리라
 * `window.open`이 팝업 차단에 막히고, 막힌 채로 「새 창에서 열려요」만 남으면
 * 아무 일도 일어나지 않은 것과 같다. 사람이 누를 자리를 그린다.
 */
export const FRAME_READY_TIMEOUT_MS = 6000;
