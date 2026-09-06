import type { AuthProvider } from '@weddingpick/api-contract';
import { SocialColors } from '@weddingpick/ui';
import * as AppleAuthentication from 'expo-apple-authentication';
import { AuthRequest, ResponseType, makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { listAuthProviders, signIn, signInWithAuthorizationCode } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { DEV_LOGIN_SECRET, devIdToken } from '@/features/auth/dev-login';

export const PROVIDER_LABEL = {
  apple: 'Apple로 계속하기',
  kakao: '카카오로 계속하기',
  google: 'Google로 계속하기',
  naver: '네이버로 계속하기',
} as const;

/**
 * WP-AUTH-002 "다른 방법으로 시작" 시트의 고정 노출 순서(spec/tokens.json
 * `auth.sheetOrder`). 카카오는 이 시트에 나오지 않는다 — `/login`의 기본
 * 버튼 자리다.
 */
export const PROVIDER_SHEET_ORDER: AuthProvider['provider'][] = ['naver', 'google', 'apple'];

/**
 * 로그인 버튼 색. 제공자 브랜드색은 앱 스킨과 무관하게 고정이다(`SocialColors`
 * 참고) — `ActionButton`의 `tone`으로 그대로 넘긴다. 개발용 대체
 * (`isDevelopmentStandIn`)는 실제 브랜드가 아니라서 여기 없다 — 그 경우
 * 화면이 `tone`을 생략해 기존 테마색(secondary)으로 남는다.
 */
export function providerTone(provider: AuthProvider): (typeof SocialColors)[keyof typeof SocialColors] | undefined {
  if (provider.isDevelopmentStandIn) return undefined;

  return SocialColors[provider.provider];
}

const KAKAO_CLIENT_ID = process.env.EXPO_PUBLIC_KAKAO_CLIENT_ID;
const GOOGLE_CLIENT_ID =
  Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
    : process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const NAVER_CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_CLIENT_ID;
const NAVER_REDIRECT_URI = process.env.EXPO_PUBLIC_NAVER_REDIRECT_URI;
// Kakao Native AppKey가 발급한 스킴만 Android/iOS OAuth callback으로 사용한다.
const KAKAO_REDIRECT_SCHEME = 'kakao8ffc70af8bf397e03d930e10ca38cb22';

// 웹에서는 제공자가 redirect한 창을 닫고 원래 로그인 요청을 완료해야 한다.
WebBrowser.maybeCompleteAuthSession();

/**
 * 쓸 수 있는 로그인 방법.
 *
 * 로그인 화면과 로그인 시트가 **같은 목록을 같은 방법으로** 읽는다. 두 곳에 따로
 * 적어두면 제공자를 붙이는 날 한쪽만 고쳐진다.
 *
 * `null`은 아직 모르는 상태고 `[]`는 없는 상태다. 둘을 같게 다루면 서버가
 * 늦게 답하는 동안 "로그인할 수 없습니다"라고 잘못 말하게 된다.
 */
export function useAuthProviders(): { providers: AuthProvider[] | null; error: string | null } {
  // 서버 주소가 없으면 물어볼 곳도 없다. 처음부터 빈 목록으로 시작한다.
  const [providers, setProviders] = useState<AuthProvider[] | null>(
    isServerConfigured ? null : []
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isServerConfigured) {
      return;
    }

    listAuthProviders()
      .then((response) => setProviders(response.providers))
      .catch((caught: Error) => {
        setProviders([]);
        setError(caught.message);
      });
  }, []);

  return { providers, error };
}

/** 이 방법으로 지금 로그인할 수 있는가. 개발용은 비밀값이 있어야 눌린다. */
export function canSignInWith(provider: AuthProvider): boolean {
  if (provider.isDevelopmentStandIn) return Boolean(DEV_LOGIN_SECRET);

  switch (provider.provider) {
    case 'apple':
      // 현재 구현은 expo-apple-authentication 네이티브 흐름이다.
      return Platform.OS === 'ios';
    case 'kakao':
      return Boolean(KAKAO_CLIENT_ID);
    case 'google':
      return Boolean(GOOGLE_CLIENT_ID);
    case 'naver':
      return Boolean(NAVER_CLIENT_ID && NAVER_REDIRECT_URI);
  }
}

/**
 * 로그인 한 번.
 *
 * 제공자 SDK는 클라이언트 ID가 나온 뒤에 붙인다. 그 전까지 실제 제공자 버튼은
 * 눌러도 여기서 멈춘다 — 눌리는 척하고 아무 일도 안 하는 것보다 낫다.
 */
export async function signInWith(provider: AuthProvider): Promise<void> {
  if (provider.isDevelopmentStandIn) {
    if (provider.provider === 'naver') throw new Error('네이버 개발용 로그인은 지원하지 않습니다.');
    await signIn(provider.provider, devIdToken());
    return;
  }

  if (provider.provider === 'apple') {
    if (!(await AppleAuthentication.isAvailableAsync())) {
      throw new Error('이 기기에서는 Apple 로그인을 사용할 수 없습니다.');
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('Apple 로그인 토큰을 받지 못했습니다. 다시 시도해 주세요.');
    }

    const appleName = [credential.fullName?.familyName, credential.fullName?.givenName]
      .filter(Boolean)
      .join(' ');
    await signIn('apple', credential.identityToken, appleName || undefined);
    return;
  }

  if (provider.provider === 'kakao') {
    if (!KAKAO_CLIENT_ID) {
      throw new Error('카카오 로그인 설정이 아직 완료되지 않았습니다.');
    }

    const redirectUri = makeRedirectUri({ scheme: KAKAO_REDIRECT_SCHEME, path: 'oauth' });
    const request = new AuthRequest({
      clientId: KAKAO_CLIENT_ID,
      redirectUri,
      responseType: ResponseType.IdToken,
      scopes: ['openid'],
      usePKCE: false,
    });
    const result = await request.promptAsync({
      authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
    });

    if (result.type !== 'success' || !result.params.id_token) {
      if (result.type === 'cancel' || result.type === 'dismiss') return;
      throw new Error('카카오 로그인에 실패했습니다. 다시 시도해 주세요.');
    }

    await signIn('kakao', result.params.id_token);
    return;
  }

  if (provider.provider === 'google') {
    if (!GOOGLE_CLIENT_ID) throw new Error('Google 로그인 설정이 아직 완료되지 않았습니다.');
    const request = new AuthRequest({
      clientId: GOOGLE_CLIENT_ID,
      redirectUri: makeRedirectUri({ scheme: 'weddingpick' }),
      responseType: ResponseType.IdToken,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: false,
    });
    const result = await request.promptAsync({ authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' });
    if (result.type !== 'success' || !result.params.id_token) {
      if (result.type === 'cancel' || result.type === 'dismiss') return;
      throw new Error('Google 로그인에 실패했습니다. 다시 시도해 주세요.');
    }
    await signIn('google', result.params.id_token);
    return;
  }

  if (!NAVER_CLIENT_ID || !NAVER_REDIRECT_URI) {
    throw new Error('네이버 로그인 설정이 아직 완료되지 않았습니다.');
  }

  const request = new AuthRequest({
    clientId: NAVER_CLIENT_ID,
    redirectUri: NAVER_REDIRECT_URI,
    responseType: ResponseType.Code,
    usePKCE: true,
  });
  const result = await request.promptAsync({
    authorizationEndpoint: 'https://nid.naver.com/oauth2.0/authorize',
  });

  if (result.type !== 'success' || !result.params.code) {
    if (result.type === 'cancel' || result.type === 'dismiss') return;
    throw new Error('네이버 로그인에 실패했습니다. 다시 시도해 주세요.');
  }

  await signInWithAuthorizationCode({
    authorizationCode: result.params.code,
    state: result.params.state ?? request.state,
    redirectUri: NAVER_REDIRECT_URI,
    codeVerifier: request.codeVerifier,
  });
}
