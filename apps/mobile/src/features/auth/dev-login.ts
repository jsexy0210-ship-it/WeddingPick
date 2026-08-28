/**
 * 개발용 로그인 비밀값. 설정된 빌드에서만 쓴다.
 *
 * EXPO_PUBLIC_* 값은 앱 번들에 그대로 들어간다. 개발 빌드 밖에서는 절대 넣지 말 것.
 * 실제 로그인(Apple·Kakao)이 붙으면 이 파일을 지운다.
 */
export const DEV_LOGIN_SECRET = process.env.EXPO_PUBLIC_DEV_LOGIN_SECRET;

let deviceKey: string | undefined;

/** 개발용 서버가 받아주는 토큰 형식. `<비밀값>:<기기키>`. */
export function devIdToken(): string {
  if (!DEV_LOGIN_SECRET) {
    throw new Error('개발용 로그인이 설정되지 않았습니다.');
  }

  deviceKey ??= `device-${Date.now()}`;

  return `${DEV_LOGIN_SECRET}:${deviceKey}`;
}
