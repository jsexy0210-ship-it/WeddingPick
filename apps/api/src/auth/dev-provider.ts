import type { IdentityProvider } from './identity-provider';

/**
 * 개발용 로그인.
 *
 * Apple·Kakao 클라이언트 ID가 없어도 앱을 서버에 붙여볼 수 있게 한다.
 * `idToken`은 `<비밀값>:<사용자키>` 형식이고, 비밀값이 맞아야 통과한다.
 *
 * **프로덕션에서는 만들어지지 않는다.** index.ts가 NODE_ENV와 비밀값 길이를 함께
 * 확인하고, 켜질 때 경고를 남긴다. 이 문이 열려 있으면 누구나 아무 계정이 될 수 있다.
 */
export function createDevProvider(secret: string): IdentityProvider {
  return {
    flow: 'id_token',
    isDevelopmentStandIn: true,
    async verify(idToken: string) {
      const separator = idToken.indexOf(':');
      const given = separator === -1 ? '' : idToken.slice(0, separator);
      const subject = separator === -1 ? '' : idToken.slice(separator + 1);

      if (given !== secret || subject.length === 0) {
        throw new Error('개발용 토큰이 올바르지 않다.');
      }

      return { provider: 'apple' as const, subject: `dev:${subject}` };
    },
  };
}
