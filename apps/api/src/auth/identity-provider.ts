export type IdentityProviderName = 'apple' | 'kakao' | 'google' | 'naver';

export type VerifiedIdentity = {
  provider: IdentityProviderName;
  /** 제공자가 주는 안정적인 식별자 */
  subject: string;
  email?: string;
  profile?: {
    name?: string;
    nickname?: string;
    profileImageUrl?: string;
    gender?: string;
    birthday?: string;
    ageRange?: string;
    birthYear?: string;
    mobile?: string;
  };
};

export type AuthorizationCodeCredential = {
  authorizationCode: string;
  state: string;
  redirectUri: string;
  codeVerifier?: string;
};

export type IdentityProvider = {
  /**
   * 개발용 대체 경로인지. 실제 제공자 검증이 아니다.
   *
   * 앱에 그대로 내려보내 화면에서 "실제 애플 로그인이 아니다"라고 말하게 한다.
   * 개발용 문을 열어두고 실제 로그인인 척하면, 그 빌드가 어디까지 나가는지 아무도 모른다.
   */
  isDevelopmentStandIn?: boolean;
} & (
  | { flow: 'id_token'; verify(idToken: string): Promise<VerifiedIdentity> }
  | { flow: 'authorization_code'; verify(credential: AuthorizationCodeCredential): Promise<VerifiedIdentity> }
);

/**
 * OIDC id_token을 제공자의 공개키로 검증한다.
 *
 * Apple과 Kakao 모두 OIDC라 검증 방식이 같다. 우리는 토큰을 만들지 않고 확인만 한다 —
 * 제공자의 비밀키를 서버가 들고 있지 않아도 된다.
 */
function createOidcProvider(options: {
  provider: IdentityProviderName;
  issuer: string | string[];
  jwksUrl: string;
  audience: string | string[];
}): IdentityProvider {
  // jose는 ESM 전용이라 실행 시점에 불러온다. 공개키 묶음은 한 번만 만들어 재사용한다.
  let jwks: Awaited<ReturnType<typeof loadJwks>> | undefined;

  async function loadJwks() {
    const { createRemoteJWKSet } = await import('jose');
    return createRemoteJWKSet(new URL(options.jwksUrl));
  }

  return {
    flow: 'id_token',
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
        profile: {
          name: stringValue(payload.name),
          nickname: stringValue(payload.nickname ?? payload.preferred_username),
          profileImageUrl: stringValue(payload.picture),
          gender: stringValue(payload.gender),
          birthday: stringValue(payload.birthdate),
          mobile: stringValue(payload.phone_number),
        },
      };
    },
  };
}

export function createNaverProvider(options: {
  clientId: string;
  clientSecret: string;
  allowedRedirectUris: string[];
  fetchImpl?: typeof fetch;
}): IdentityProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const allowedRedirectUris = new Set(options.allowedRedirectUris);

  return {
    flow: 'authorization_code',
    async verify(credential) {
      if (!allowedRedirectUris.has(credential.redirectUri)) {
        throw new Error('허용되지 않은 네이버 redirect URI다.');
      }

      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: options.clientId,
        client_secret: options.clientSecret,
        code: credential.authorizationCode,
        state: credential.state,
      });
      if (credential.codeVerifier) tokenBody.set('code_verifier', credential.codeVerifier);

      const tokenResponse = await fetchImpl('https://nid.naver.com/oauth2/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: tokenBody,
      });
      if (!tokenResponse.ok) throw new Error('네이버 토큰 교환에 실패했다.');

      const token = (await tokenResponse.json()) as { access_token?: unknown };
      if (typeof token.access_token !== 'string' || token.access_token.length === 0) {
        throw new Error('네이버 access token이 없다.');
      }

      const profileResponse = await fetchImpl('https://openapi.naver.com/v1/nid/me', {
        headers: { authorization: `Bearer ${token.access_token}` },
      });
      if (!profileResponse.ok) throw new Error('네이버 프로필 조회에 실패했다.');

      const profile = (await profileResponse.json()) as {
        resultcode?: unknown;
        response?: Record<string, unknown>;
      };
      if (profile.resultcode !== '00' || typeof profile.response?.id !== 'string') {
        throw new Error('네이버 프로필 응답이 올바르지 않다.');
      }

      return {
        provider: 'naver',
        subject: profile.response.id,
        email: typeof profile.response.email === 'string' ? profile.response.email : undefined,
        profile: {
          name: stringValue(profile.response.name),
          nickname: stringValue(profile.response.nickname),
          profileImageUrl: stringValue(profile.response.profile_image),
          gender: stringValue(profile.response.gender),
          birthday: stringValue(profile.response.birthday),
          ageRange: stringValue(profile.response.age),
          birthYear: stringValue(profile.response.birthyear),
          mobile: stringValue(profile.response.mobile),
        },
      };
    },
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
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
    // Google은 두 issuer 값을 모두 정상 토큰으로 명시한다.
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    // Android/iOS/웹 클라이언트 ID를 쉼표로 함께 허용한다.
    audience: clientId.split(',').map((value) => value.trim()).filter(Boolean),
  });
}

export type IdentityProviders = Partial<Record<IdentityProviderName, IdentityProvider>>;
