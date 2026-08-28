import { ApiError, signIn } from '@/api/client';
import { loadToken } from '@/api/session';

/**
 * 개발용 로그인 비밀값. 설정된 빌드에서만 쓴다.
 *
 * EXPO_PUBLIC_* 값은 앱 번들에 그대로 들어간다. 개발 빌드 밖에서는 절대 넣지 말 것.
 * 실제 로그인(Apple·Kakao)이 붙으면 이 경로는 지운다.
 */
const DEV_LOGIN_SECRET = process.env.EXPO_PUBLIC_DEV_LOGIN_SECRET;

let deviceKey: string | undefined;

/** 서버를 부르기 전에 세션이 있는지 확인한다. */
export async function ensureSignedIn(): Promise<void> {
  if (await loadToken()) {
    return;
  }

  if (!DEV_LOGIN_SECRET) {
    throw new ApiError('unauthenticated', '로그인이 필요합니다.');
  }

  deviceKey ??= `device-${Date.now()}`;
  await signIn('apple', `${DEV_LOGIN_SECRET}:${deviceKey}`);
}
