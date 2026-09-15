import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/*
 * 웹으로 내보낸 앱(그리고 관리자 콘솔)의 HTML 껍데기.
 *
 * **이 파일이 생긴 이유는 하나다 — 서체.** `packages/ui/src/theme.ts`의 웹 스택은
 * 맨 앞이 'Pretendard Variable'인데, 2026-09-15까지 저장소에 폰트 파일도
 * `@font-face`도 없었다. 브라우저는 못 찾은 이름을 조용히 건너뛰고 시스템 서체로
 * 떨어진다 — **앱 웹은 한 번도 Pretendard로 그려진 적이 없었고, 아무 오류도 나지
 * 않아서 드러나지 않았다.**
 *
 * 대표님이 2026-09-15에 원본을 올리셨다. 여기서 실제로 싣는다.
 *
 * 나머지 태그(charset · viewport · ScrollViewStyleReset)는 Expo Router의 기본
 * 껍데기에 있던 것을 그대로 옮긴 것이다. 이 파일을 두면 기본 껍데기를 쓰지 않으므로
 * **빠뜨리면 그대로 사라진다.** 지울 때는 무엇이 같이 사라지는지 보고 지운다.
 */

/**
 * 가변 폰트 한 벌. 45~920 축 하나가 400 · 600 · 700 · 800을 전부 덮는다.
 *
 * 값은 원본 배포판 `variable/pretendardvariable.css`를 그대로 옮겼다 —
 * `font-weight: 45 920` · `format('woff2-variations')`. 지어낸 숫자가 없다.
 *
 * 자리는 `apps/mobile/public/fonts/`다. Expo 정적 내보내기가 `public/`을 통째로
 * 출력 폴더 뿌리에 복사한다.
 */
const FONT_FACE = `@font-face{font-family:'Pretendard Variable';font-weight:45 920;font-style:normal;font-display:swap;src:url('/fonts/PretendardVariable.woff2') format('woff2-variations')}`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/*
         * 미리 받기. 스타일시트 속 `@font-face`는 그 서체를 쓰는 글자가 나타나야 받기
         * 시작한다. **`crossOrigin`이 빠지면 두 번 받는다** — 폰트는 익명 CORS로 받게
         * 돼 있어서, 속성이 없으면 preload한 것과 다른 요청이 된다.
         */}
        <link
          rel="preload"
          href="/fonts/PretendardVariable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
        <style id="weddingpick-font" dangerouslySetInnerHTML={{ __html: FONT_FACE }} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
