import {
  WEB_SHELL_CHANNEL, WEB_SHELL_RECEIVER, WEB_SHELL_REQUEST,
  WEB_SHELL_TIMEOUT_MS, WEB_SHELL_TOKEN,
} from '../features/webshell/session-protocol';

const STORAGE_KEY = 'weddingpick.sessionToken.v1';
type BridgeWindow = Window & {
  ReactNativeWebView?: { postMessage(message: string): void };
  __weddingpickSessionChannel?: string;
  __weddingpickReceiveSession?: (channel: string, token: unknown) => void;
};
let initialization: Promise<void> | undefined;
let shell = false;
let token: string | null = null;
let channel: string | null = null;

function browser(): BridgeWindow | undefined {
  return typeof window !== 'undefined' && typeof window.location?.href === 'string'
    ? window as BridgeWindow : undefined;
}

export function isWebShellSession(): boolean { return shell; }
export function readWebShellToken(): string | null { return token; }

/** 원문 토큰을 URL에서 읽어 저장하는 구버전 진입은 더 이상 허용하지 않는다. */
export function stripLegacyWebShellToken(): void {
  const win = browser();
  if (!win) return;
  const url = new URL(win.location.href);
  if (!url.searchParams.has('wp_token')) return;
  url.searchParams.delete('wp_token');
  win.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

/** 웹뷰 세션은 페이지 메모리에만 둔다. 일반 브라우저의 저장 방식은 바꾸지 않는다. */
export function initializeWebShellSession(): Promise<void> {
  const win = browser();
  if (!win) return Promise.resolve();
  stripLegacyWebShellToken();
  const marked = new URL(win.location.href).searchParams.has('wp_shell');
  if (!marked && !win.ReactNativeWebView) return Promise.resolve();
  shell = true;
  if (initialization) return initialization;
  if (win.top !== win || win.location.protocol !== 'https:' ||
      typeof win.ReactNativeWebView?.postMessage !== 'function' || !win.crypto?.getRandomValues) {
    return Promise.reject(new Error('앱을 업데이트한 뒤 다시 로그인해주세요.'));
  }

  initialization = new Promise<void>((resolve, reject) => {
    const bytes = new Uint8Array(32);
    win.crypto.getRandomValues(bytes);
    const request = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    let settled = false;
    const cleanup = () => {
      delete win[WEB_SHELL_RECEIVER];
      delete win[WEB_SHELL_REQUEST];
      clearTimeout(timer);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      token = null;
      reject(new Error('앱의 로그인 정보를 받지 못했어요. 다시 시도해주세요.'));
    };
    const timer = setTimeout(fail, WEB_SHELL_TIMEOUT_MS);
    win[WEB_SHELL_REQUEST] = request;
    win[WEB_SHELL_RECEIVER] = (received, value) => {
      if (settled || received !== request || !WEB_SHELL_CHANNEL.test(received)) return;
      if (value !== null && (typeof value !== 'string' || !WEB_SHELL_TOKEN.test(value))) {
        fail();
        return;
      }
      try {
        // 이전 웹뷰 버전이 남긴 영속 토큰은 새 세션보다 먼저 지운다.
        win.localStorage.removeItem(STORAGE_KEY);
      } catch {
        fail();
        return;
      }
      token = value as string | null;
      channel = request;
      settled = true;
      cleanup();
      resolve();
    };
    try {
      win.ReactNativeWebView!.postMessage(JSON.stringify({ type: 'session:ready', channel: request }));
    } catch {
      fail();
    }
  });
  const pending = initialization;
  // 타임아웃 후 다시 시도할 수 있지만 같은 요청을 중복 시작하지 않는다.
  void pending.catch(() => { if (initialization === pending) initialization = undefined; });
  return pending;
}

export function clearWebShellToken(): void {
  token = null;
  const win = browser();
  if (win && channel) {
    try { win.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'session:clear', channel })); }
    catch { /* 로컬 세션은 이미 제거했다. 서버 세션 폐기는 API 로그아웃이 담당한다. */ }
  }
}
