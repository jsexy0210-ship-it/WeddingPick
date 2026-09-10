import { NOT_ACTIVATED_NOTICE } from '@weddingpick/domain';
import { ApiError, getAppBootstrap, getCurrentUser, getSignupState } from '@/api/client';
import { loadToken } from '@/api/session';
import { errorKindOf, type ErrorKind } from '@/features/errors/kind';
import { error as errorCopy } from '../../../../../spec/strings.ko.json';

export type SessionEntry = 'login' | 'setup' | 'app';

export function isAuthenticationFailure(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.code === 'unauthenticated');
}

export function sessionErrorKind(error: unknown): ErrorKind {
  return error instanceof ApiError ? errorKindOf(error.status) ?? 'general' : 'general';
}

/** 현재 API는 가입 미완료만 이 403 문구로 구별한다. 다른 권한 거부는 가입으로 보내지 않는다. */
function isSignupPending(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403
    && error.code === 'forbidden' && error.message === NOT_ACTIVATED_NOTICE;
}

/** 토큰의 존재는 인증 성공이 아니다. 일시 장애는 호출자가 재시도할 수 있도록 남긴다. */
export async function resolveSessionEntry(): Promise<SessionEntry> {
  const token = await loadToken();
  if (!token) return 'login';

  void getAppBootstrap().catch(() => undefined);
  try {
    const me = await getCurrentUser();
    if (await loadToken() !== token) throw new Error(errorCopy['general.body']);
    return me.setupComplete ? 'app' : 'setup';
  } catch (error) {
    const currentToken = await loadToken();
    if (!currentToken) return 'login';
    if (currentToken !== token) throw new Error(errorCopy['general.body']);
    if (isAuthenticationFailure(error)) return 'login';
    if (!isSignupPending(error)) throw error;

    try {
      const signup = await getSignupState();
      if (await loadToken() !== token) throw new Error(errorCopy['general.body']);
      if (!signup.activated) return 'setup';
      // 가입이 완료됐는데 회원 조회가 거부됐다면 임의로 앱을 열지 않는다.
      throw error;
    } catch (signupError) {
      const latestToken = await loadToken();
      if (!latestToken) return 'login';
      if (latestToken === token && isAuthenticationFailure(signupError)) return 'login';
      throw signupError;
    }
  }
}
