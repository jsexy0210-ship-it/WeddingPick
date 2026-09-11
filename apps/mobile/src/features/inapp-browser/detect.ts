/**
 * 인앱 브라우저 판별과 탈출 방법.
 *
 * 여기 있는 것은 전부 순수 함수다 — `window`도 `Platform`도 보지 않는다. 실제로
 * 주소를 옮기는 일은 `escape.ts`가 맡는다. 갈라 둔 이유는 판별을 테스트로
 * 덮기 위해서다(`detect.test.ts`).
 *
 * 왜 필요한가: `weddingpick-app-web.onrender.com` 주소를 카카오톡·인스타그램으로
 * 공유하면 받는 사람은 그 앱 안의 브라우저에서 연다. 그 브라우저들은 팝업을
 * 막거나 `window.opener` 없이 열어서 소셜 로그인이 깨진다 — 동의까지 마친
 * 사람이 로그인 화면으로 되돌아오는 버그가 실제로 있었다(2026-09-08,
 * `features/auth/providers.ts`). 같은 창 이동으로 한 번 고쳤지만 인앱 브라우저
 * 자체의 제약은 남아 있어서, 아예 바깥 브라우저로 넘긴다.
 */

/** 알아보는 인앱 브라우저. **목록은 여기 하나뿐이다.** */
export type InAppBrowserApp = 'kakaotalk' | 'instagram' | 'facebook' | 'line' | 'naver' | 'daum';

export type MobileOs = 'ios' | 'android' | 'other';

/**
 * 이 창을 어떻게 할 것인가.
 *
 * - `stay` 아무것도 하지 않는다. 일반 브라우저이거나, 인앱이어도 방법이 없다.
 * - `open` 이 주소로 옮기면 바깥 브라우저가 뜬다.
 * - `guide` 옮길 방법이 없다. 사람에게 직접 열라고 한 줄 안내한다.
 */
export type EscapePlan = { kind: 'stay' } | { kind: 'open'; href: string } | { kind: 'guide' };

/**
 * User-Agent 표식. **못 알아본 브라우저는 그냥 둔다** — 일반 브라우저를 인앱으로
 * 잘못 보고 바깥으로 튕기는 쪽이 훨씬 나쁘다. 그래서 표식은 넓게 잡지 않는다:
 *
 * - `Line/`은 슬래시까지 본다. 버전이 붙은 `Line/12.5.0` 형태만 LINE이다.
 * - `NAVER(`는 여는 괄호까지 본다. 네이버 앱은 `NAVER(inapp; …)`로 적는다.
 *   웨일 브라우저는 `Whale`이라 여기 걸리지 않는다.
 * - 다음은 `DaumApps`만 본다. `Daum`만으로는 너무 흔하다.
 * - 페이스북·인스타그램 인앱은 `FBAN`·`FBAV`·`FB_IAB` 중 하나를 싣는다.
 */
const SIGNATURES: readonly { app: InAppBrowserApp; pattern: RegExp }[] = [
  { app: 'kakaotalk', pattern: /kakaotalk/i },
  { app: 'instagram', pattern: /instagram/i },
  { app: 'facebook', pattern: /FB(AN|AV|_IAB)/ },
  { app: 'line', pattern: /\bLine\// },
  { app: 'naver', pattern: /NAVER\(/ },
  { app: 'daum', pattern: /DaumApps/ },
];

/** 어느 앱의 인앱 브라우저인가. 못 알아보면 null — 일반 브라우저로 본다. */
export function detectInAppBrowser(userAgent: string): InAppBrowserApp | null {
  return SIGNATURES.find(({ pattern }) => pattern.test(userAgent))?.app ?? null;
}

export function detectMobileOs(userAgent: string): MobileOs {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios';
  if (/Android/.test(userAgent)) return 'android';

  return 'other';
}

/**
 * 안드로이드 크롬을 직접 지목해서 여는 주소.
 *
 * 조각(`#…`)은 싣지 않는다 — `intent://` 자신이 `#Intent;…;end`로 조각 자리를
 * 쓴다. 웹 export는 경로로 화면을 가르므로(expo-router) 조각에 실린 상태가 없다.
 */
function androidIntentUrl(url: string): string {
  const parsed = new URL(url);

  return `intent://${parsed.host}${parsed.pathname}${parsed.search}#Intent;scheme=https;package=com.android.chrome;end`;
}

/**
 * 이 창을 어떻게 할지 정한다. `url`은 바깥 브라우저에서 열 주소다.
 *
 * 되는 것과 안 되는 것이 갈린다 —
 *
 * | 상황 | 방법 |
 * |---|---|
 * | 카카오톡 인앱(안드로이드·iOS) | `kakaotalk://web/openExternal` |
 * | 안드로이드 기타 인앱(인스타·페북·라인·네이버·다음) | `intent://…;package=com.android.chrome` |
 * | iOS 기타 인앱 | **방법이 없다** — 사파리를 강제로 띄우는 공개 API가 없다 |
 *
 * **iOS 기타 인앱에서 억지로 시도하지 않는다.** 안 되는 것을 되는 척하면 빈
 * 화면이나 멈춘 화면만 남는다. 그 자리는 `guide`로 돌려 사람에게 맡긴다.
 *
 * 안드로이드도 iOS도 아닌 인앱(알아본 표식은 있는데 OS를 모르는 경우)은 그냥
 * 둔다 — 사파리를 열라는 안내가 맞지 않는 자리다.
 */
export function planInAppEscape(userAgent: string, url: string): EscapePlan {
  const app = detectInAppBrowser(userAgent);

  if (app === null) return { kind: 'stay' };

  /* 카카오톡은 OS를 가리지 않고 이 스킴을 받는다. */
  if (app === 'kakaotalk') {
    return { kind: 'open', href: `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}` };
  }

  const os = detectMobileOs(userAgent);

  if (os === 'android') return { kind: 'open', href: androidIntentUrl(url) };
  if (os === 'ios') return { kind: 'guide' };

  return { kind: 'stay' };
}
