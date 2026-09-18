import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthProvider } from '@weddingpick/api-contract';
import { SocialColors } from '@weddingpick/ui';
import { AuthRequest, ResponseType, makeRedirectUri } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import {
  ApiError,
  listAuthProviders,
  signIn,
  signInWithAuthorizationCode,
  type SessionEntry,
} from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { DEV_LOGIN_SECRET, devIdToken } from '@/features/auth/dev-login';
import {
  AGE_UNVERIFIED_SIGN_IN_MESSAGE,
  UNDER_AGE_SIGN_IN_MESSAGE,
} from '@/features/auth/sign-in-handoff';
import {
  KAKAO_AUTH_REQUEST_KEY,
  validateKakaoRedirect,
  type PendingKakaoRedirect,
} from './kakao-redirect-state';

/** 연령 오류도 부팅 경로에서 구분할 수 있도록 기존 안내 문구를 유지한다. */
async function exchangeKakaoCode(
  input: Parameters<typeof signInWithAuthorizationCode>[0]
): Promise<SessionEntry> {
  try {
    return await signInWithAuthorizationCode(input);
  } catch (caught) {
    if (caught instanceof ApiError && caught.code === 'under_age') throw new Error(UNDER_AGE_SIGN_IN_MESSAGE);
    if (caught instanceof ApiError && caught.code === 'age_unverified') throw new Error(AGE_UNVERIFIED_SIGN_IN_MESSAGE);
    throw caught;
  }
}

export function providerTone(provider: AuthProvider): (typeof SocialColors)[keyof typeof SocialColors] | undefined {
  if (provider.isDevelopmentStandIn) return undefined;
  return provider.provider === 'apple' ? SocialColors.apple : SocialColors.kakao;
}

export function providerLabel(provider: AuthProvider, mode: 'start' | 'continue'): string {
  if (provider.isDevelopmentStandIn) return '개발용 로그인';
  if (provider.provider === 'apple') return 'Apple로 계속하기';
  return mode === 'start' ? '카카오로 시작하기' : '카카오로 계속하기';
}

const KAKAO_CLIENT_ID = process.env.EXPO_PUBLIC_KAKAO_CLIENT_ID;
// app.json과 카카오 콘솔에 등록한 네이티브 스킴을 함께 유지해야 한다.
const KAKAO_REDIRECT_SCHEME = 'kakao8ffc70af8bf397e03d930e10ca38cb22';
export const KAKAO_WEB_REDIRECT_PATH = '/setup';
const KAKAO_AUTHORIZE = 'https://kauth.kakao.com/oauth/authorize';
const KAKAO_FAILED = '카카오 로그인에 실패했습니다. 다시 시도해 주세요.';
const APPLE_FAILED = 'Apple 로그인에 실패했습니다. 다시 시도해 주세요.';

WebBrowser.maybeCompleteAuthSession();

function webRedirectUri(): string {
  return `${window.location.origin}${KAKAO_WEB_REDIRECT_PATH}`;
}

/** 서버에서 켠 제공자 중 카카오와 iOS Apple만 표시한다. 개발용은 별도로 표시한다. */
export function useAuthProviders(): { providers: AuthProvider[] | null; error: string | null } {
  const [providers, setProviders] = useState<AuthProvider[] | null>(isServerConfigured ? null : []);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!isServerConfigured) return;
    let cancelled = false;
    listAuthProviders()
      .then((response) => { if (!cancelled) setProviders(usableProviders(response.providers)); })
      .catch((caught: Error) => {
        if (cancelled) return;
        setProviders([]);
        setError(caught.message);
      });
    return () => { cancelled = true; };
  }, []);
  return { providers, error };
}

export function usableProviders(providers: readonly AuthProvider[]): AuthProvider[] {
  return providers.filter((provider) => {
    if (provider.isDevelopmentStandIn || provider.provider === 'kakao') return true;
    return provider.provider === 'apple' && Platform.OS === 'ios';
  }).sort((a, b) => providerOrder(a) - providerOrder(b));
}

function providerOrder(provider: AuthProvider): number {
  if (provider.isDevelopmentStandIn) return 2;
  return provider.provider === 'kakao' ? 0 : 1;
}

export function canSignInWith(provider: AuthProvider): boolean {
  if (provider.isDevelopmentStandIn) return Boolean(DEV_LOGIN_SECRET);
  if (provider.provider === 'apple') return Platform.OS === 'ios';
  return provider.provider === 'kakao' && Boolean(KAKAO_CLIENT_ID);
}

export async function startSignIn(
  provider: AuthProvider,
  options: { ageAcknowledged?: boolean } = {}
): Promise<SessionEntry | null> {
  if (provider.isDevelopmentStandIn) return signIn('apple', devIdToken(), undefined, options.ageAcknowledged);
  if (provider.provider === 'apple') return signInWithApple(options);
  if (provider.provider === 'kakao') return signInWithKakao(provider, options);
  throw new Error('이 로그인 방법은 앱에서 지원하지 않습니다.');
}

/** Apple이 최초 한 번 주는 이름만 별도 전달한다. 나이 확인 값을 자동으로 채우지 않는다. */
export async function signInWithApple(
  options: { ageAcknowledged?: boolean } = {}
): Promise<SessionEntry | null> {
  const AppleAuthentication = await import('expo-apple-authentication');
  const nonceBytes = await Crypto.getRandomBytesAsync(32);
  const nonce = Array.from(nonceBytes, (value) => value.toString(16).padStart(2, '0')).join('');
  let credential: Awaited<ReturnType<typeof AppleAuthentication.signInAsync>>;
  try {
    credential = await AppleAuthentication.signInAsync({
      nonce,
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (caught) {
    if (isAppleCancel(caught)) return null;
    throw new Error(APPLE_FAILED);
  }
  if (!credential.identityToken) throw new Error(APPLE_FAILED);
  return signIn(
    'apple',
    credential.identityToken,
    appleProfileName(credential.fullName),
    options.ageAcknowledged,
    nonce
  );
}

function isAppleCancel(caught: unknown): boolean {
  return typeof caught === 'object' && caught !== null && 'code' in caught &&
    (caught as { code?: unknown }).code === 'ERR_REQUEST_CANCELED';
}

function appleProfileName(
  fullName: { givenName?: string | null; familyName?: string | null } | null
): string | undefined {
  const joined = [fullName?.familyName, fullName?.givenName].filter(Boolean).join('').trim();
  return joined.length > 0 ? joined : undefined;
}

export async function signInWithKakao(
  provider: AuthProvider,
  options: { ageAcknowledged?: boolean } = {}
): Promise<SessionEntry | null> {
  if (provider.isDevelopmentStandIn) return signIn('apple', devIdToken(), undefined, options.ageAcknowledged);
  if (!KAKAO_CLIENT_ID) throw new Error('카카오 로그인 설정이 아직 완료되지 않았습니다.');
  if (Platform.OS === 'web') {
    await startKakaoRedirect(options.ageAcknowledged);
    return null;
  }

  const redirectUri = makeRedirectUri({ scheme: KAKAO_REDIRECT_SCHEME, path: 'oauth' });
  const request = kakaoRequest(redirectUri);
  const result = await request.promptAsync({ authorizationEndpoint: KAKAO_AUTHORIZE });
  if (result.type !== 'success' || !result.params.code) {
    const params = 'params' in result ? result.params as Record<string, string | undefined> : {};
    if (isUnderAgeDenial(params.error ?? '', params.error_description ?? null)) throw new Error(UNDER_AGE_SIGN_IN_MESSAGE);
    if (result.type === 'cancel' || result.type === 'dismiss') return null;
    throw new Error(KAKAO_FAILED);
  }
  if (!result.params.state || result.params.state !== request.state || !request.codeVerifier) {
    throw new Error('로그인 요청이 맞지 않아요. 다시 시도해 주세요.');
  }
  return exchangeKakaoCode({
    provider: 'kakao',
    authorizationCode: result.params.code,
    state: result.params.state,
    redirectUri,
    codeVerifier: request.codeVerifier,
    ageAcknowledged: options.ageAcknowledged,
  });
}

function kakaoRequest(redirectUri: string): AuthRequest {
  return new AuthRequest({
    clientId: KAKAO_CLIENT_ID!,
    redirectUri,
    responseType: ResponseType.Code,
    scopes: ['openid', 'profile_nickname', 'age_range'],
    usePKCE: true,
  });
}

/** 웹은 같은 창으로 이동한다. 요청은 탭별 sessionStorage에 두고 최대 10분만 인정한다. */
async function startKakaoRedirect(ageAcknowledged?: boolean): Promise<void> {
  const redirectUri = webRedirectUri();
  const request = kakaoRequest(redirectUri);
  const url = await request.makeAuthUrlAsync({ authorizationEndpoint: KAKAO_AUTHORIZE });
  if (!request.codeVerifier) throw new Error(KAKAO_FAILED);
  const pending: PendingKakaoRedirect = {
    state: request.state,
    codeVerifier: request.codeVerifier,
    redirectUri,
    startedAt: Date.now(),
    ageAcknowledged,
  };
  // 저장소가 막혔으면 카카오로 떠나지 않는다. 돌아와서 복구할 수 없기 때문이다.
  window.sessionStorage.setItem(KAKAO_AUTH_REQUEST_KEY, JSON.stringify(pending));
  await AsyncStorage.removeItem(KAKAO_AUTH_REQUEST_KEY);
  window.location.assign(url);
  await new Promise<never>(() => undefined);
}

export function hasKakaoReturn(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('code') || params.has('error');
}

export function isUnderAgeDenial(error: string, description: string | null): boolean {
  if (error !== 'access_denied' || !description) return false;
  return /under\s*age|age\s*14|14\s*세|연령/.test(description.toLowerCase());
}

export async function completeKakaoRedirect(): Promise<SessionEntry | null> {
  if (!hasKakaoReturn()) return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  const errorDescription = params.get('error_description');
  for (const key of ['code', 'state', 'error', 'error_description']) params.delete(key);
  const search = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`);

  const tabRequest = window.sessionStorage.getItem(KAKAO_AUTH_REQUEST_KEY);
  window.sessionStorage.removeItem(KAKAO_AUTH_REQUEST_KEY);
  // 배포 직전에 이전 버전으로 시작한 요청만 호환한다. 같은 TTL/PKCE 검증을 적용한다.
  const raw = tabRequest ?? await AsyncStorage.getItem(KAKAO_AUTH_REQUEST_KEY);
  await AsyncStorage.removeItem(KAKAO_AUTH_REQUEST_KEY);

  if (error) {
    if (isUnderAgeDenial(error, errorDescription)) throw new Error(UNDER_AGE_SIGN_IN_MESSAGE);
    if (error === 'access_denied') return null;
    throw new Error(KAKAO_FAILED);
  }
  const pending = validateKakaoRedirect(raw, state, code, webRedirectUri());
  return exchangeKakaoCode({
    provider: 'kakao',
    authorizationCode: code!,
    state: pending.state,
    redirectUri: pending.redirectUri,
    codeVerifier: pending.codeVerifier,
    ageAcknowledged: pending.ageAcknowledged,
  });
}
