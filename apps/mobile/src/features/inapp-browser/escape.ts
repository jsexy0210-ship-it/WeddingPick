import { Platform } from 'react-native';
import { hasKakaoReturn } from '@/features/auth/providers';
import { planInAppEscape } from './detect';

export type InAppBrowserNotice =
  | { kind: 'none' }
  | { kind: 'manual'; href: string }
  | { kind: 'guide' };
const NONE: InAppBrowserNotice = { kind: 'none' };
const ESCAPE_PARAM = 'wp_ext';
const ATTEMPTED_KEY = 'weddingpick.inAppEscape.v1';

function readAttempted(): boolean {
  try { return window.sessionStorage.getItem(ATTEMPTED_KEY) === '1'; }
  catch { return false; }
}
function markAttempted(): void {
  try { window.sessionStorage.setItem(ATTEMPTED_KEY, '1'); }
  catch { /* 저장소를 막은 브라우저에서도 외부 열기는 가능하다. */ }
}
function replaceSearch(params: URLSearchParams): void {
  const search = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`);
}
function escapeTarget(params: URLSearchParams): string {
  const next = new URLSearchParams(params);
  next.delete('wp_token');
  next.set(ESCAPE_PARAM, '1');
  return `${window.location.origin}${window.location.pathname}?${next.toString()}`;
}
export function openOutside(href: string): void { window.location.href = href; }

/** 카카오 callback의 PKCE 저장소와 자체 네이티브 웹뷰를 외부 브라우저로 넘기지 않는다. */
export function escapeInAppBrowser(): InAppBrowserNotice {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return NONE;
  if (/^\/admin(?:\/|$)/.test(window.location.pathname)) return NONE;
  const params = new URLSearchParams(window.location.search);
  const bridge = (window as Window & { ReactNativeWebView?: unknown }).ReactNativeWebView;
  if (bridge || params.has('wp_shell') || params.has('wp_token')) return NONE;
  if (hasKakaoReturn()) return NONE;
  if (params.has(ESCAPE_PARAM)) {
    params.delete(ESCAPE_PARAM);
    replaceSearch(params);
    markAttempted();
  }
  const plan = planInAppEscape(window.navigator.userAgent, escapeTarget(params));
  if (plan.kind === 'stay') return NONE;
  if (plan.kind === 'guide') return { kind: 'guide' };
  if (!readAttempted()) { markAttempted(); openOutside(plan.href); }
  return { kind: 'manual', href: plan.href };
}
