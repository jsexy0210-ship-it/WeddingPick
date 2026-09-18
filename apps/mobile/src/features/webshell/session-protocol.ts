/** 네이티브 웹뷰 세션 전달 규약. URL에는 자격증명을 넣지 않는다. */
export const WEB_SHELL_CHANNEL = /^[a-f0-9]{64}$/;
export const WEB_SHELL_TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const WEB_SHELL_TIMEOUT_MS = 10_000;
export const WEB_SHELL_RECEIVER = '__weddingpickReceiveSession';
export const WEB_SHELL_REQUEST = '__weddingpickSessionChannel';

type Message = { type: 'session:ready' | 'session:clear'; channel: string };

function secureUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('웹 화면에는 HTTPS 주소를 설정해주세요.');
  }
  return url;
}

/** Android의 첫 요청은 이동 차단 콜백을 거치지 않으므로 미리 검사한다. */
export function webShellTarget(base: string, path: string): { uri: string; origin: string } {
  const configured = secureUrl(base);
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    throw new Error('웹 화면 주소를 확인해주세요.');
  }
  const target = new URL(path, configured.origin);
  if (!isTrustedWebShellUrl(target.href, configured.origin)) {
    throw new Error('웹 화면 주소를 확인해주세요.');
  }
  target.searchParams.set('wp_shell', '1');
  return { uri: target.href, origin: configured.origin };
}

export function isTrustedWebShellUrl(value: string, origin: string): boolean {
  try {
    const url = secureUrl(value);
    return url.origin === origin && !/^\/admin(?:\/|$)/.test(url.pathname) &&
      !url.searchParams.has('wp_token');
  } catch {
    return false;
  }
}

/** origin은 문자열 접두어가 아니라 URL의 정확한 origin으로 비교한다. */
export function parseWebShellMessage(raw: string, sourceUrl: string, origin: string): Message | null {
  if (!isTrustedWebShellUrl(sourceUrl, origin) || raw.length > 1024) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const message = value as Record<string, unknown>;
    if ((message.type !== 'session:ready' && message.type !== 'session:clear') ||
        typeof message.channel !== 'string' || !WEB_SHELL_CHANNEL.test(message.channel)) return null;
    return { type: message.type, channel: message.channel };
  } catch {
    return null;
  }
}

/** 이동 도중 실행되더라도 다른 origin·프레임·페이지 요청에는 토큰을 주지 않는다. */
export function sessionInjection(origin: string, channel: string, token: string | null): string {
  if (secureUrl(origin).origin !== origin || !WEB_SHELL_CHANNEL.test(channel) ||
      (token !== null && !WEB_SHELL_TOKEN.test(token))) throw new Error('세션 전달 정보를 확인하지 못했어요.');
  const payload = JSON.stringify({ origin, channel, token }).replace(/</g, '\\u003c');
  return `(function () {
    const payload = ${payload};
    if (window.top !== window || window.location.origin !== payload.origin ||
        window.${WEB_SHELL_REQUEST} !== payload.channel) return;
    const receive = window.${WEB_SHELL_RECEIVER};
    if (typeof receive === 'function') receive(payload.channel, payload.token);
  })(); true;`;
}
