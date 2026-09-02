export type IdentityProviderName = 'apple' | 'kakao' | 'google' | 'naver';

export type VerifiedIdentity = {
  provider: IdentityProviderName;
  /** 제공자가 주는 안정적인 식별자 */
  subject: string;
  email?: string;
};

export type IdentityProvider = {
  /**
   * 개발용 대체 경로인지. 실제 제공자 검증이 아니다.
   *
   * 앱에 그대로 내려보내 화면에서 "실제 애플 로그인이 아니다"라고 말하게 한다.
   * 개발용 문을 열어두고 실제 로그인인 척하면, 그 빌드가 어디까지 나가는지 아무도 모른다.
   */
  isDevelopmentStandIn?: boolean;
  /**
   * `token`은 대부분 OIDC id_token이다. 네이버만 다르다 — authorization
   * code이고, `extra.state`가 함께 있어야 서버가 code를 교환할 수 있다
   * (docs/social-login-handoff.md).
   */
  verify(token: string, extra?: { state?: string }): Promise<VerifiedIdentity>;
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

export function createGoogleProvider(clientId: string): IdentityProvider {
  return createOidcProvider({
    provider: 'google',
    issuer: 'https://accounts.google.com',
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    audience: clientId,
  });
}

type NaverTokenResponse =
  | { access_token: string }
  | { error: string; error_description?: string };

type NaverProfileResponse = {
  resultcode: string;
  message: string;
  response?: { id: string; email?: string };
};

/**
 * 네이버는 OIDC가 아니다 — 클라이언트가 받은 것은 id_token이 아니라
 * authorization code다. 서버가 `client_secret`으로 직접 토큰과 교환해야
 * 하고, 그래서 다른 세 제공자와 달리 client secret이 필요하다.
 *
 * `fetchImpl`은 테스트에서 실제 네이버 서버를 부르지 않고 가짜 응답을
 * 끼우기 위한 자리다 — 운영에서는 전역 `fetch`를 그대로 쓴다.
 */
export function createNaverProvider(
  clientId: string,
  clientSecret: string,
  fetchImpl: typeof fetch = fetch
): IdentityProvider {
  return {
    async verify(code, extra) {
      const state = extra?.state;

      if (!state) {
        throw new Error('네이버 로그인에는 state가 함께 있어야 한다.');
      }

      const tokenUrl = new URL('https://nid.naver.com/oauth2.0/token');
      tokenUrl.searchParams.set('grant_type', 'authorization_code');
      tokenUrl.searchParams.set('client_id', clientId);
      tokenUrl.searchParams.set('client_secret', clientSecret);
      tokenUrl.searchParams.set('code', code);
      tokenUrl.searchParams.set('state', state);

      const tokenResponse = await fetchImpl(tokenUrl);
      const tokenBody = (await tokenResponse.json()) as NaverTokenResponse;

      if (!('access_token' in tokenBody)) {
        throw new Error(tokenBody.error_description ?? '네이버 토큰 교환에 실패했다.');
      }

      const profileResponse = await fetchImpl('https://openapi.naver.com/v1/nid/me', {
        headers: { Authorization: `Bearer ${tokenBody.access_token}` },
      });
      const profileBody = (await profileResponse.json()) as NaverProfileResponse;

      if (profileBody.resultcode !== '00' || !profileBody.response) {
        throw new Error(profileBody.message || '네이버 프로필을 가져오지 못했다.');
      }

      return {
        provider: 'naver',
        subject: profileBody.response.id,
        email: profileBody.response.email,
      };
    },
  };
}

export type IdentityProviders = Partial<Record<IdentityProviderName, IdentityProvider>>;
