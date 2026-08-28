import { ApiError, signIn } from '@/api/client';
import { loadToken } from '@/api/session';
import { DEV_LOGIN_SECRET, devIdToken } from '@/features/auth/dev-login';

/**
 * 서버를 부르기 전에 세션이 있는지 확인한다.
 *
 * 세션이 없으면 부르는 쪽이 A-02 로그인 화면으로 보낸다. 개발 빌드에서는 조용히
 * 개발용 로그인을 쓴다 — 서버를 붙여 시험하는 데 매번 화면을 거치지 않게.
 */
export async function ensureSignedIn(): Promise<void> {
  if (await loadToken()) {
    return;
  }

  if (!DEV_LOGIN_SECRET) {
    throw new ApiError('unauthenticated', '로그인이 필요합니다.');
  }

  await signIn('apple', devIdToken());
}
