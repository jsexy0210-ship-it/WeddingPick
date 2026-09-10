import { Platform } from 'react-native';

import { hasKakaoReturn } from '@/features/auth/providers';

import { planInAppEscape } from './detect';

/**
 * 인앱 브라우저에서 바깥 브라우저로 빠져나온다. **웹에서만 도는 코드다.**
 *
 * 판별은 전부 `detect.ts`의 순수 함수가 한다. 여기는 「지금 이 창에서 해도 되는
 * 일인가」만 가린 뒤 주소를 옮긴다.
 */

/**
 * 화면 위에 남길 것.
 *
 * - `none` 아무것도 안 보인다. 일반 브라우저이거나 방법이 없는 자리다.
 * - `manual` 누르면 바깥 브라우저가 뜨는 자리. **자동 이동과 짝이다** — 자동으로
 *   옮기고도 이 자리를 남긴다. 인앱 브라우저가 스킴 이동을 막는 경우가 있고,
 *   그때 화면에 아무것도 없으면 사람이 할 수 있는 일이 없다.
 * - `guide` 옮길 방법이 없다(iOS 기타 인앱). 직접 여는 방법을 한 줄 안내한다.
 */
export type InAppBrowserNotice =
  | { kind: 'none' }
  | { kind: 'manual'; href: string }
  | { kind: 'guide' };

const NONE: InAppBrowserNotice = { kind: 'none' };

/**
 * 탈출한 뒤 돌아온 주소라는 표식. 바깥 브라우저에서 이 표식을 보면 다시
 * 자동으로 나가지 않고, 주소창에서 지운다 — `wp_token`과 같은 방식이다
 * (`app/_layout.tsx`). 지우는 이유는 두 가지다: 주소에 남을 이유가 없고,
 * 남은 채로 그 주소가 다시 공유되면 그 사람은 영영 탈출하지 못한다.
 */
const ESCAPE_PARAM = 'wp_ext';

/**
 * 이 웹뷰에서 이미 한 번 자동으로 옮겼다는 표시.
 *
 * 표식만으로는 모자란다 — 카카오톡 인앱에서 바깥 브라우저를 띄우면 인앱
 * 브라우저는 표식 없는 원래 주소를 그대로 띄운 채 뒤에 남는다. 사람이 카카오톡으로
 * 돌아와 그 화면을 다시 띄우면 또 튕겨 나간다. `sessionStorage`는 웹뷰가 살아 있는
 * 동안만 남아서 이 자리에 맞는다.
 */
const ATTEMPTED_KEY = 'weddingpick.inAppEscape.v1';

function readAttempted(): boolean {
  try {
    return window.sessionStorage.getItem(ATTEMPTED_KEY) === '1';
  } catch {
    /* 시크릿 모드 등 저장소가 막힌 곳. 표식 하나로만 막는다. */
    return false;
  }
}

function markAttempted(): void {
  try {
    window.sessionStorage.setItem(ATTEMPTED_KEY, '1');
  } catch {
    /* 못 적어도 탈출 자체는 진행한다. */
  }
}

function replaceSearch(params: URLSearchParams): void {
  const search = params.toString();

  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`
  );
}

/** 바깥 브라우저에서 열 주소. 원래 쿼리는 그대로 두고 돌아올 표식만 더한다. */
function escapeTarget(params: URLSearchParams): string {
  const next = new URLSearchParams(params);

  next.set(ESCAPE_PARAM, '1');

  return `${window.location.origin}${window.location.pathname}?${next.toString()}`;
}

/** 누를 자리(`manual`)가 실제로 하는 일. 자동 이동과 같은 주소로 간다. */
export function openOutside(href: string): void {
  window.location.href = href;
}

/**
 * 부팅 때 한 번 부른다. 옮길 수 있으면 **자동으로 옮기고**, 어느 경우든 화면에
 * 남길 것을 돌려준다.
 *
 * 자동 이동은 웹뷰당 한 번뿐이다 — 되풀이를 막는다. 두 번째부터는 옮기지 않고
 * 누를 자리만 남긴다. 자동 이동 자체가 막히는 인앱 브라우저도 있어서, 처음부터
 * 누를 자리를 같이 둔다.
 *
 * 아무것도 하지 않는 자리 —
 *
 * - 네이티브(`Platform.OS !== 'web'`). 인앱 브라우저라는 것이 없다.
 * - 관리자 콘솔(`/admin`). PC에서 쓰는 화면이다.
 * - 네이티브 쉘의 웹뷰(`wp_token`). 우리 앱 안이지 남의 인앱 브라우저가 아니다.
 * - **카카오에서 돌아온 직후(`code`·`error`)**. 코드를 세션으로 바꾸려면 떠나기
 *   전에 적어둔 PKCE verifier가 필요한데, 그것은 이 브라우저의 저장소에 있다.
 *   여기서 바깥 브라우저로 넘기면 코드만 건너가고 verifier가 없어 로그인이
 *   깨진다.
 */
export function escapeInAppBrowser(): InAppBrowserNotice {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return NONE;

  if (window.location.pathname.startsWith('/admin')) return NONE;

  const params = new URLSearchParams(window.location.search);

  if (params.has('wp_token')) return NONE;

  if (hasKakaoReturn()) return NONE;

  if (params.has(ESCAPE_PARAM)) {
    /* 탈출해서 돌아온 주소다. 표식을 지우고, 이 창에서는 자동으로 나가지 않는다. */
    params.delete(ESCAPE_PARAM);
    replaceSearch(params);
    markAttempted();
  }

  const plan = planInAppEscape(window.navigator.userAgent, escapeTarget(params));

  if (plan.kind === 'stay') return NONE;
  if (plan.kind === 'guide') return { kind: 'guide' };

  if (!readAttempted()) {
    /* 옮기기 **전에** 적어둔다 — 옮기고 나면 이 코드가 더 돌지 않는다. */
    markAttempted();
    openOutside(plan.href);
  }

  return { kind: 'manual', href: plan.href };
}
