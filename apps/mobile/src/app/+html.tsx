import { FONT_COMMON, fontFaceRules } from '@weddingpick/domain';
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { Colors, FontSize, Fonts, Layout, LineHeight, Motion, Spacing } from '@weddingpick/ui';

import {
  APP_WEB_ORIGIN,
  SHARE_DESCRIPTION,
  SHARE_IMAGE,
  SHARE_IMAGE_ALT,
  SHARE_TITLE,
} from '../features/social-meta';
import { AUTH_RETURN_STATIC_ID, SIGNING_IN_MESSAGE } from '../features/auth/signing-in-view';

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

/**
 * **카카오에서 돌아온 새 페이지의 첫 HTML**(2026-09-26 대표 지시 — 「스플래시 → 카카오 로그인 →
 * 로더가 두 번 돈다. 로더 써클만 돌도록 통합한다」).
 *
 * 정적 내보내기의 첫 HTML은 부팅 화면인 **코랄 스플래시**다(`app/_layout.tsx` — 서버와 브라우저의
 * 첫 렌더가 같아야 해서 주소를 못 읽는다). 그래서 카카오 동의를 마치고 돌아온 사람은 코랄
 * 스플래시를 한 번 더 보고, 그 뒤에야 «로그인하는 중»(원형 고리)을 봤다 — 앱이 다시 켜지는 것처럼
 * 보이고 기다림 화면이 두 번 섰다.
 *
 * 여기서는 React 밖에서 주소만 보고(`code` · `error`) 같은 모양의 판을 먼저 세운다 — 흰 바탕 ·
 * 원형 고리 40(테두리 3 · 900ms · 700ms 뒤에 나타남) · 그 아래 문구 한 줄. 값은 전부 토큰에서 온다.
 * React가 같은 화면(`SigningInView`)을 세우면 이 판을 걷는다. 고리 각도와 700ms는 같은 시계
 * (페이지가 열린 순간 = 0)로 맞춰, 판이 갈아 끼워져도 고리가 다시 서지 않는다.
 *
 * 관리자 주소와 인증 팝업 창(`window.opener`)에는 세우지 않는다 — 그 둘은 이 화면을 그리지 않는다.
 */
const AUTH_RETURN_SCRIPT = `(function(){try{var p=new URLSearchParams(location.search);`
  + `if(!(p.has('code')||p.has('error'))||window.opener||/^\\/admin(\\/|$)/.test(location.pathname))return;`
  + `var d=document.documentElement,t=performance.now();d.setAttribute('data-wp-auth-return','');`
  + `d.style.setProperty('--wp-ar-spin',(-(t%${Motion.loaderCircleSpin}))+'ms');`
  + `d.style.setProperty('--wp-ar-show',Math.max(0,${Motion.loaderThreshold}-t)+'ms');}catch(e){}})();`;

const AUTH_RETURN_STYLE = [
  `#${AUTH_RETURN_STATIC_ID}{display:none}`,
  `html[data-wp-auth-return] #${AUTH_RETURN_STATIC_ID}{position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483000;`
    + `display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Spacing.three}px;`
    + `background:${Colors.light.background}}`,
  `#${AUTH_RETURN_STATIC_ID} .wp-ar-circle{box-sizing:border-box;width:40px;height:40px;border-radius:999px;`
    + `border:${Layout.loaderCircleStrokeLarge}px solid ${Colors.light.line};border-top-color:${Colors.light.tint};`
    + `animation:wpSpin ${Motion.loaderCircleSpin}ms linear var(--wp-ar-spin,0ms) infinite,`
    + `wpArShow 1ms linear var(--wp-ar-show,${Motion.loaderThreshold}ms) both}`,
  `#${AUTH_RETURN_STATIC_ID} .wp-ar-msg{font-family:${Fonts.sans ?? 'sans-serif'};font-size:${FontSize.t7}px;`
    + `line-height:${LineHeight.t7}px;font-weight:400;color:${Colors.light.textAssistive}}`,
  '@keyframes wpSpin{to{transform:rotate(360deg)}}',
  '@keyframes wpArShow{from{opacity:0}to{opacity:1}}',
].join('');

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
        <style id="weddingpick-auth-return" dangerouslySetInnerHTML={{ __html: AUTH_RETURN_STYLE }} />
        <script dangerouslySetInnerHTML={{ __html: AUTH_RETURN_SCRIPT }} />
        <ScrollViewStyleReset />
      </head>
      <body>
        {children}
        <div id={AUTH_RETURN_STATIC_ID} role="progressbar" aria-label={SIGNING_IN_MESSAGE}>
          <span className="wp-ar-circle" />
          <span className="wp-ar-msg">{SIGNING_IN_MESSAGE}</span>
        </div>
      </body>
    </html>
  );
}
