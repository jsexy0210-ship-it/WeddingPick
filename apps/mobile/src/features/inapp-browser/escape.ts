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
 * 탈출한 뒤 돌아온 주소라는 표식. 바깥 브라우저에서 이 표식을 보면 다시
 * 시도하지 않고, 주소창에서 지운다 — `wp_token`과 같은 방식이다
 * (`app/_layout.tsx`). 지우는 이유는 두 가지다: 주소에 남을 이유가 없고,
 * 남은 채로 그 주소가 다시 공유되면 그 사람은 영영 탈출하지 못한다.
 */
const ESCAPE_PARAM = 'wp_ext';

/**
 * 이 웹뷰에서 이미 한 번 시도했다는 표시.
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

function stripEscapeParam(params: URLSearchParams): void {
  params.delete(ESCAPE_PARAM);

  const search = params.toString();

  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`
  );
}

/**
 * 부팅 때 한 번 부른다. 바깥 브라우저로 옮길 수 있으면 옮기고, 옮길 방법이
 * 없는 자리(iOS 기타 인앱)에서만 `true`를 돌려준다 — 그때만 안내를 보인다.
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
 * - 이미 한 번 시도한 웹뷰. 무한 반복을 막는다.
 */
export function escapeInAppBrowser(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;

  if (window.location.pathname.startsWith('/admin')) return false;

  const params = new URLSearchParams(window.location.search);

  if (params.has('wp_token')) return false;

  if (params.has(ESCAPE_PARAM)) {
    /* 탈출해서 돌아온 주소다. 표식을 지우고, 이 창에서는 더 시도하지 않는다. */
    stripEscapeParam(params);
    markAttempted();

    return false;
  }

  if (hasKakaoReturn()) return false;

  if (readAttempted()) return false;

  params.set(ESCAPE_PARAM, '1');

  const plan = planInAppEscape(
    window.navigator.userAgent,
    `${window.location.origin}${window.location.pathname}?${params.toString()}`
  );

  if (plan.kind === 'stay') return false;
  if (plan.kind === 'guide') return true;

  /* 옮기기 **전에** 적어둔다 — 옮기고 나면 이 코드가 더 돌지 않는다. */
  markAttempted();
  window.location.href = plan.href;

  return false;
}
