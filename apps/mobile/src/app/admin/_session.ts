import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 관리자 세션 토큰.
 *
 * **사용자 토큰과 다른 자리에 둔다.** 같은 자리를 쓰면 관리자로 로그인하는 순간
 * 그 브라우저의 사용자 세션이 덮이고, 관리자에서 로그아웃하면 사용자도 함께
 * 튕긴다. 관리자 콘솔은 웹에서만 열리므로 사용자 화면과 한 브라우저를 공유한다.
 *
 * 접두어는 `weddingpick.`을 지킨다 — 탈퇴가 기기를 쓸어낼 때 이 키도 함께 지운다.
 */
const KEY = 'weddingpick.adminToken.v1';

/** 이 탭 안에서 토큰이 바뀌었음을 알리는 신호. 브라우저의 `storage`는 다른 탭에만 간다. */
const CHANGED = 'weddingpick:adminToken';

export async function loadAdminToken(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

/**
 * 지금 이 순간의 토큰. **웹에서는 기다리지 않고 바로 답한다.**
 *
 * `loadAdminToken`은 비동기라, 화면을 옮긴 직후에는 아직 답이 오지 않았다. 그 틈에
 * 레이아웃이 「토큰 없음」으로 읽고 로그인으로 되돌리면 **로그인에 성공해도 로그인
 * 화면으로 돌아온다** — 예전에 전체 새로고침으로 덮어 두었던 문제가 이 자리다.
 *
 * 웹의 `AsyncStorage`는 `localStorage`를 감싼 것이라 값은 이미 메모리에 있다.
 * 비동기인 것은 네이티브와 낯을 맞추기 위해서지 실제로 기다릴 일이 있어서가 아니다.
 * 그래서 웹에서는 곧바로 읽는다.
 *
 * 네이티브에서는 `null`을 돌려준다 — 관리자 콘솔은 웹 전용이라 그 자리에 닿지
 * 않는다. 「모른다」와 「없다」를 가르는 것은 부르는 쪽이 `loadAdminToken`으로
 * 이어서 확인하는 것으로 한다.
 */
export function readAdminTokenSync(): string | null {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return null;

  try {
    return window.localStorage.getItem(KEY);
  } catch {
    /* 사생활 보호 창처럼 저장소를 막아둔 곳. 없는 것으로 본다. */
    return null;
  }
}

/**
 * **웹에는 곧바로도 쓴다.**
 *
 * `AsyncStorage`의 웹 구현은 약속(promise)이 끝난 뒤에도 실제 `localStorage` 쓰기를
 * 미룬다 — 여러 쓰기를 모아 한 번에 넣는다. 그래서 `await saveAdminToken()`이 끝난
 * 직후에 곧바로 읽으면 **아직 없다.**
 *
 * 그 틈이 실제로 로그인을 막았다. 로그인이 `router.replace`로 옮기면 레이아웃이
 * 토큰을 곧바로 읽는데 그때는 비어 있어서, 「토큰 없음」으로 보고 로그인으로
 * 되돌렸다. 화면에는 로그인이 실패한 것처럼 보인다(2026-09-10).
 *
 *   layout 렌더 /admin/queue  sync=null   ← 여기
 *   layout 렌더 /admin/login  sync=ok     ← 되돌아온 뒤에야 보인다
 *
 * 미루는 것을 기다릴 방법이 없으므로 우리가 직접 넣는다. `AsyncStorage`에도 그대로
 * 남겨 둔다 — 나중에 그쪽 값이 덮어써도 같은 값이다.
 */
function writeThrough(token: string | null): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;

  try {
    if (token === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, token);
  } catch {
    /* 저장소를 막아둔 창. AsyncStorage 쪽이 맡는다. */
  }

  /*
   * **같은 탭에는 `storage` 이벤트가 오지 않는다.** 브라우저는 그것을 다른 탭에만
   * 보낸다. 우리 탭에서 바뀐 것을 우리가 알아야 하므로 직접 알린다.
   */
  window.dispatchEvent(new Event(CHANGED));
}

/**
 * 토큰이 바뀌면 알려준다. `useSyncExternalStore`가 쓴다.
 *
 * 다른 탭에서 로그아웃하면 `storage`가 오고, 이 탭에서 바꾸면 위의 `CHANGED`가 온다.
 * 둘 다 듣는다 — 관리자 콘솔은 한 브라우저에서 여러 탭으로 열려 있기 쉽다.
 */
export function subscribeAdminToken(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGED, onChange);

  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

export async function saveAdminToken(token: string): Promise<void> {
  writeThrough(token);
  await AsyncStorage.setItem(KEY, token);
}

export async function clearAdminToken(): Promise<void> {
  writeThrough(null);
  await AsyncStorage.removeItem(KEY);
}
