import { ApiError, getAppBootstrap, getCurrentUser, getSignupState } from '@/api/client';
import { loadToken } from '@/api/session';
import { noteSignupPending } from '@/features/auth/sign-in-handoff';
import { errorKindOf, type ErrorKind } from '@/features/errors/kind';
import { error as errorCopy } from '../../../../../spec/strings.ko.json';

/**
 * `'consent'`는 v3.29 신규 — 약관 동의 · 권한 안내(WP-AUTH-010, `/login/consent`)다.
 * 로그인은 했지만 가입이 안 끝난 계정(`!signup.activated`)은 온보딩(`/setup`)보다
 * 그 화면이 먼저다(CHANGELOG v3.29 「약관 동의 · 권한 안내 한 화면 통합」).
 */
export type SessionEntry = 'login' | 'consent' | 'setup' | 'app';

export function isAuthenticationFailure(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.code === 'unauthenticated');
}

export function sessionErrorKind(error: unknown): ErrorKind {
  return error instanceof ApiError ? errorKindOf(error.status) ?? 'general' : 'general';
}

/** 토큰의 존재는 인증 성공이 아니다. 일시 장애는 호출자가 재시도할 수 있도록 남긴다. */
export async function resolveSessionEntry(): Promise<SessionEntry> {
  const token = await loadToken();
  if (!token) return 'login';

  try {
    // 대기 계정도 읽을 수 있는 상태부터 확인한다. /me와 bootstrap은 가입 전에는 403이다.
    const signup = await getSignupState();
    if (await loadToken() !== token) throw new Error(errorCopy['general.body']);
    if (!signup.activated) {
      /* 방금 물어 «가입 전»을 확인했다 — 약관 동의가 같은 것을 로더와 함께 또 묻지 않게. */
      noteSignupPending();

      return 'consent';
    }

    void getAppBootstrap().catch(() => undefined);
    const me = await getCurrentUser();
    if (await loadToken() !== token) throw new Error(errorCopy['general.body']);
    return me.setupComplete ? 'app' : 'setup';
  } catch (error) {
    const currentToken = await loadToken();
    if (!currentToken) return 'login';
    if (currentToken !== token) throw new Error(errorCopy['general.body']);
    if (isAuthenticationFailure(error)) return 'login';
    throw error;
  }
}
