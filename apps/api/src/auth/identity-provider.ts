/**
 * 로그인 제공자. 이메일·비밀번호 로그인(v3.12)은 2026-09-08에 서버에서도 지웠다 —
 * 남은 것은 카카오와, 이미 가입한 계정을 위한 애플·구글·네이버 검증뿐이다.
 */
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

type OidcOptions = {
  provider: IdentityProviderName;
  issuer: string | string[];
  jwksUrl: string;
  audience: string | string[];
};

/**
 * OIDC id_token을 제공자의 공개키로 검증하는 함수를 만든다.
 *
 * Apple·Google·Kakao 모두 OIDC라 검증 방식이 같다. 우리는 토큰을 만들지 않고 확인만
 * 한다 — 제공자의 비밀키를 서버가 들고 있지 않아도 된다. 앱이 id_token을 직접
 * 받아오는 제공자(`createOidcProvider`)와 서버가 인가 코드를 교환해서 받는 제공자
 * (카카오)가 같은 검증을 쓴다.
 */
function createIdTokenVerifier(options: OidcOptions): (idToken: string) => Promise<VerifiedIdentity> {
  // jose는 ESM 전용이라 실행 시점에 불러온다. 공개키 묶음은 한 번만 만들어 재사용한다.
  let jwks: Awaited<ReturnType<typeof loadJwks>> | undefined;

  async function loadJwks() {
    const { createRemoteJWKSet } = await import('jose');
    return createRemoteJWKSet(new URL(options.jwksUrl));
  }

  return async (idToken) => {
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
  };
}

function createOidcProvider(options: OidcOptions): IdentityProvider {
  return { flow: 'id_token', verify: createIdTokenVerifier(options) };
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

/**
 * 카카오. 앱은 인가 코드만 받고 서버가 `/oauth/token`으로 교환한다.
 *
 * 카카오 REST API는 `/oauth/authorize`에서 `response_type=code`만 지원한다 —
 * `id_token`을 바로 달라고 하면 "지원하지 않는 SDK 버전"(KOE033)으로 거부된다.
 * OpenID Connect가 켜진 앱은 토큰 교환 응답에 `id_token`이 함께 오므로, 그걸
 * Apple·Google과 같은 방식으로 공개키 검증한다.
 *
 * `appKey`는 REST API 키다 — 앱이 authorize 요청에 쓴 client_id와 같아야 교환도
 * 되고 id_token의 `aud`도 맞는다. redirect URI 허용목록은 두지 않는다 — 카카오가
 * 교환 시점에 authorize 때 쓴 값과 같은지 직접 대조하고, 등록되지 않은 주소로는
 * 애초에 코드가 발급되지 않는다. Client Secret은 카카오 콘솔에서 "사용함"으로
 * 켠 앱에만 필요하다.
 */
export function createKakaoProvider(options: {
  appKey: string;
  clientSecret?: string;
  fetchImpl?: typeof fetch;
}): IdentityProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const verifyIdToken = createIdTokenVerifier({
    provider: 'kakao',
    issuer: 'https://kauth.kakao.com',
    jwksUrl: 'https://kauth.kakao.com/.well-known/jwks.json',
    audience: options.appKey,
  });

  return {
    flow: 'authorization_code',
    async verify(credential) {
      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: options.appKey,
        redirect_uri: credential.redirectUri,
        code: credential.authorizationCode,
      });
      if (options.clientSecret) tokenBody.set('client_secret', options.clientSecret);
      if (credential.codeVerifier) tokenBody.set('code_verifier', credential.codeVerifier);

      const tokenResponse = await fetchImpl('https://kauth.kakao.com/oauth/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: tokenBody,
      });
      if (!tokenResponse.ok) {
        // 카카오가 무엇이 틀렸는지 본문에 적어 보낸다(error_code KOE0xx). 이것을
        // 버리면 설정이 어긋났을 때 남는 단서가 없다 — 실제로 그래서 원인을
        // 좁히지 못했다. 사용자에게는 라우트가 일반 문구로 바꿔 내려주고,
        // 이 문장은 서버 로그에만 남는다. 본문에 우리 비밀은 들어있지 않다.
        // 본문을 못 읽어도 원래 오류는 던져야 한다 — 오류 경로가 스스로 터지면
        // 진짜 원인이 가려진다.
        let detail = '';
        try {
          detail = (await tokenResponse.text?.()) ?? '';
        } catch {
          detail = '';
        }
        throw new Error(`카카오 토큰 교환에 실패했다 (HTTP ${tokenResponse.status}) ${detail.slice(0, 300)}`.trim());
      }

      const token = (await tokenResponse.json()) as { id_token?: unknown };
      if (typeof token.id_token !== 'string' || token.id_token.length === 0) {
        throw new Error('카카오 id_token이 없다. 앱의 OpenID Connect가 꺼져 있거나 scope에 openid가 빠졌다.');
      }

      return verifyIdToken(token.id_token);
    },
  };
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
