export type IdentityProviderName = 'apple' | 'kakao';

export type VerifiedIdentity = {
  provider: IdentityProviderName;
  /** 제공자가 주는 안정적인 식별자 */
  subject: string;
  email?: string;
};

export type IdentityProvider = {
  verify(idToken: string): Promise<VerifiedIdentity>;
};

/**
 * OIDC id_token을 제공자의 공개키로 검증한다.
 *
 * Apple과 Kakao 모두 OIDC라 검증 방식이 같다. 우리는 토큰을 만들지 않고 확인만 한다 —
 * 제공자의 비밀키를 서버가 들고 있지 않아도 된다.
 */
function createOidcProvider(options: {
  provider: IdentityProviderName;
  issuer: string;
  jwksUrl: string;
  audience: string;
}): IdentityProvider {
  // jose는 ESM 전용이라 실행 시점에 불러온다. 공개키 묶음은 한 번만 만들어 재사용한다.
  let jwks: Awaited<ReturnType<typeof loadJwks>> | undefined;

  async function loadJwks() {
    const { createRemoteJWKSet } = await import('jose');
    return createRemoteJWKSet(new URL(options.jwksUrl));
  }

  return {
    async verify(idToken) {
      const { jwtVerify } = await import('jose');
      jwks ??= await loadJwks();

      const { payload } = await jwtVerify(idToken, jwks, {
        issuer: options.issuer,
        audience: options.audience,
      });

      if (!payload.sub) {
        throw new Error('id_token에 sub이 없다.');
      }

      return {
        provider: options.provider,
        subject: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
      };
    },
  };
}

export function createAppleProvider(clientId: string): IdentityProvider {
  return createOidcProvider({
    provider: 'apple',
    issuer: 'https://appleid.apple.com',
    jwksUrl: 'https://appleid.apple.com/auth/keys',
    audience: clientId,
  });
}

export function createKakaoProvider(appKey: string): IdentityProvider {
  return createOidcProvider({
    provider: 'kakao',
    issuer: 'https://kauth.kakao.com',
    jwksUrl: 'https://kauth.kakao.com/.well-known/jwks.json',
    audience: appKey,
  });
}

export type IdentityProviders = Partial<Record<IdentityProviderName, IdentityProvider>>;
