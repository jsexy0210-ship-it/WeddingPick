import { FONT_COMMON, fontFaceRules } from '@weddingpick/domain';
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import {
  APP_WEB_ORIGIN,
  SHARE_DESCRIPTION,
  SHARE_IMAGE,
  SHARE_IMAGE_ALT,
  SHARE_TITLE,
} from '../features/social-meta';

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
 *
 * **공유 카드(OG) 태그가 2026-09-15까지 한 줄도 없었다.** 링크를 공유해도 카드가
 * 뜨지 않았다는 뜻이다. 값은 `../features/social-meta`에서 온다 — 문구는
 * `apps/web`과 같은 `spec/strings.ko.json`, 그림은 `apps/web`이 굽는 코랄 카드를
 * 그대로 가리킨다. **이 껍데기는 관리자 콘솔도 함께 쓴다**(아래 admin 분리 참고) —
 * 관리자 화면에도 같은 카드가 실리는데, 그 정리는 이 파일이 아니라
 * `scripts/split-admin-dist.mjs`가 나눌 때의 몫으로 남겨 둔다.
 */

/**
 * 가변 폰트 한 벌. 45~920 축 하나가 400 · 600 · 700 · 800을 전부 덮는다.
 *
 * **두 벌로 갈라 싣는다**(2026-09-17 대표 지시 「용량은 미리 축소한다」). 원본 한 벌은
 * 2.0MB이고 화면마다 그것을 받았다. 흔한 글자와 나머지를 가르면 보통 화면은 493KB만
 * 받는다 — 빠지는 글자는 없다. 가른 근거와 잰 값은 `packages/domain/src/web-font.ts`.
 *
 * **글자를 여기 적지 않는다.** 웹사이트(`apps/web/src/fonts.ts`)와 같은 것을 써야 하고,
 * 두 곳에 따로 적으면 한쪽만 고쳐서 갈라진다 — 2026-09-15까지 실제로 그랬다.
 *
 * 자리는 `apps/mobile/public/fonts/`다. Expo 정적 내보내기가 `public/`을 통째로
 * 출력 폴더 뿌리에 복사한다.
 */
const FONT_DIR = '/fonts';
const FONT_FACE = fontFaceRules(FONT_DIR);

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>{SHARE_TITLE}</title>
        <meta name="description" content={SHARE_DESCRIPTION} />
        <meta property="og:title" content={SHARE_TITLE} />
        <meta property="og:description" content={SHARE_DESCRIPTION} />
        <meta property="og:image" content={SHARE_IMAGE} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={SHARE_IMAGE_ALT} />
        <meta property="og:url" content={APP_WEB_ORIGIN} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="ko_KR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={SHARE_TITLE} />
        <meta name="twitter:description" content={SHARE_DESCRIPTION} />
        <meta name="twitter:image" content={SHARE_IMAGE} />
        {/*
         * 미리 받기. 스타일시트 속 `@font-face`는 그 서체를 쓰는 글자가 나타나야 받기
         * 시작한다. **`crossOrigin`이 빠지면 두 번 받는다** — 폰트는 익명 CORS로 받게
         * 돼 있어서, 속성이 없으면 preload한 것과 다른 요청이 된다.
         */}
        <link
          rel="preload"
          href={`${FONT_DIR}/${FONT_COMMON.file}`}
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
