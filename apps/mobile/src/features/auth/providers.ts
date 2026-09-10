import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthProvider } from '@weddingpick/api-contract';
import { SocialColors } from '@weddingpick/ui';
import { AuthRequest, ResponseType, makeRedirectUri } from 'expo-auth-session';
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
import { UNDER_AGE_SIGN_IN_MESSAGE } from '@/features/auth/sign-in-handoff';

/**
 * 인가 코드를 세션으로 바꾼다. 서버가 만 14세 미만으로 판정하면(`under_age`,
 * v3.22 SPEC 3.5) 정해진 문장으로 바꿔 던진다 — 부팅 경로는 실패를 문장 하나로만
 * 넘기므로, 그 경로에서도 WP-AUTH-010으로 갈 수 있어야 한다.
 */
async function exchangeKakaoCode(
  input: Parameters<typeof signInWithAuthorizationCode>[0]
): Promise<SessionEntry> {
  try {
    return await signInWithAuthorizationCode(input);
  } catch (caught) {
    if (caught instanceof ApiError && caught.code === 'under_age') {
      throw new Error(UNDER_AGE_SIGN_IN_MESSAGE);
    }
    throw caught;
  }
}

/**
 * 로그인 버튼 색. 카카오 브랜드색은 앱 스킨과 무관하게 고정이다(`SocialColors`
 * 참고) — `ActionButton`의 `tone`으로 그대로 넘긴다. 개발용 대체는 실제
 * 브랜드가 아니라서 여기 없다 — 그 경우 화면이 `tone`을 생략해 기존
 * 테마색(secondary)으로 남는다.
 */
export function providerTone(provider: AuthProvider): (typeof SocialColors)[keyof typeof SocialColors] | undefined {
  if (provider.isDevelopmentStandIn) return undefined;

  return SocialColors.kakao;
}

const KAKAO_CLIENT_ID = process.env.EXPO_PUBLIC_KAKAO_CLIENT_ID;
// Kakao REST API 키가 발급한 스킴만 Android/iOS OAuth callback으로 쓴다.
const KAKAO_REDIRECT_SCHEME = 'kakao8ffc70af8bf397e03d930e10ca38cb22';

// 웹에서는 제공자가 redirect한 창을 닫고 원래 로그인 요청을 완료해야 한다.
WebBrowser.maybeCompleteAuthSession();

/**
 * 카카오 redirect URI(웹). 네이티브 앱 커스텀 스킴(`kakao...://`)은 웹에서
 * 의미가 없다 — 웹은 실제 페이지 주소로 돌아와야 한다.
 *
 * **카카오 개발자센터에 등록한 값과 글자 하나까지 같아야 한다** — 다르면
 * 카카오가 로그인 화면을 열기도 전에 KOE006으로 막는다. 등록값은
 * `https://weddingpick-app-web.onrender.com/setup`(2026-09-08). 돌아온 뒤 어느
 * 화면을 보일지는 이 경로가 아니라 부팅(`app/_layout.tsx`)이 세션 응답으로
 * 정한다 — 온보딩이 안 끝났으면 `/setup`, 끝났으면 홈.
 */
export const KAKAO_WEB_REDIRECT_PATH = '/setup';

function webRedirectUri(): string {
  return `${window.location.origin}${KAKAO_WEB_REDIRECT_PATH}`;
}

/**
 * 쓸 수 있는 로그인 방법 — 카카오뿐이다(v3.12, 네이버·구글·애플 폐기).
 *
 * 개발용 대체(`isDevelopmentStandIn`)는 실제 카카오가 아니라서 항상 남겨둔다 —
 * `KAKAO_APP_KEY`가 아직 없는 개발 환경에서도 로그인 흐름을 시험할 수 있어야
 * 한다. 이메일은 여기 없다 — OAuth 앱 등록 여부에 좌우되지 않고 항상 켜져
 * 있어서, 화면의 "이메일로 시작하기"는 이 목록이 아니라 고정 버튼이다.
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
      .then((response) =>
        setProviders(response.providers.filter((p) => p.provider === 'kakao' || p.isDevelopmentStandIn))
      )
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

  return Boolean(KAKAO_CLIENT_ID);
}

/**
 * 카카오 로그인 한 번.
 *
 * 카카오는 `/oauth/authorize`에서 id_token을 바로 주지 않는다 —
 * `response_type=id_token`은 "지원하지 않는 SDK 버전"(KOE033)으로 거부된다.
 * 네이버가 쓰던 것과 같은 구조로 인가 코드만 받고, 서버가 `/oauth/token`으로
 * 교환한 응답의 id_token을 검증한다.
 */
/**
 * 카카오 로그인 한 번. 세션이 열리면 다음 화면을 고를 두 값(`SessionEntry`)을
 * 돌려주고, 사용자가 취소했으면 null이다. 웹은 같은 창으로 떠나므로 돌아오지
 * 않는다 — 돌아온 뒤는 `completeKakaoRedirect`가 잇는다.
 */
export async function signInWithKakao(provider: AuthProvider): Promise<SessionEntry | null> {
  if (provider.isDevelopmentStandIn) {
    return await signIn('apple', devIdToken());
  }

  if (!KAKAO_CLIENT_ID) {
    throw new Error('카카오 로그인 설정이 아직 완료되지 않았습니다.');
  }

  if (Platform.OS === 'web') {
    await startKakaoRedirect();

    return null;
  }

  const redirectUri = makeRedirectUri({ scheme: KAKAO_REDIRECT_SCHEME, path: 'oauth' });
  const request = kakaoRequest(redirectUri);
  const result = await request.promptAsync({ authorizationEndpoint: KAKAO_AUTHORIZE });

  if (result.type !== 'success' || !result.params.code) {
    /*
     * 웹과 같은 이유로 여기서도 나이를 먼저 본다 — 카카오 앱이 「만 14세 미만
     * 이용 불가」로 설정돼 있으면 동의 화면 전에 `access_denied`로 돌아온다.
     * 네이티브는 그 값이 `result.params`에 실려 온다.
     */
    const params = 'params' in result ? (result.params as Record<string, string | undefined>) : {};

    if (isUnderAgeDenial(params.error ?? '', params.error_description ?? null)) {
      throw new Error(UNDER_AGE_SIGN_IN_MESSAGE);
    }
    if (result.type === 'cancel' || result.type === 'dismiss') return null;
    throw new Error(KAKAO_FAILED);
  }

  return await exchangeKakaoCode({
    provider: 'kakao',
    authorizationCode: result.params.code,
    state: result.params.state ?? request.state,
    redirectUri,
    codeVerifier: request.codeVerifier,
  });
}

const KAKAO_AUTHORIZE = 'https://kauth.kakao.com/oauth/authorize';
const KAKAO_FAILED = '카카오 로그인에 실패했습니다. 다시 시도해 주세요.';

function kakaoRequest(redirectUri: string): AuthRequest {
  return new AuthRequest({
    clientId: KAKAO_CLIENT_ID!,
    redirectUri,
    responseType: ResponseType.Code,
    /* profile_nickname — id_token에 nickname 클레임이 실린다. 화면 이름은 닉네임만 쓴다. */
    scopes: ['openid', 'profile_nickname'],
    usePKCE: true,
  });
}

/*
 * ── 웹: 팝업이 아니라 **같은 창에서 갔다 온다** ──────────────────────────
 *
 * 예전에는 웹도 `promptAsync`(팝업 + window.opener)였다. 카카오톡 인앱
 * 브라우저·삼성 인터넷 등 모바일 브라우저는 팝업을 막거나 opener 없이 열어서,
 * 카카오가 `/login?code=…`로 돌려보내도 그 결과를 받을 창이 없었다 — 동의까지
 * 마친 사람이 로그인 화면으로 되돌아오는 버그(2026-09-08). 같은 창에서 이동하면
 * 창이 하나뿐이라 그 문제가 없다.
 *
 * 돌아온 뒤 코드를 교환하려면 떠나기 전의 PKCE verifier·state가 필요하다 —
 * 기기 저장소(웹은 localStorage)에 적어두고 돌아와서 읽는다. 세션 토큰과 같은
 * 비밀은 아니지만(한 번 쓰면 지운다) 창을 닫아도 남지 않게 쓰자마자 지운다.
 */
const REDIRECT_KEY = 'weddingpick.kakaoAuthRequest.v1';

type PendingRedirect = {
  state: string;
  codeVerifier?: string;
  redirectUri: string;
  startedAt: number;
};

async function startKakaoRedirect(): Promise<void> {
  const redirectUri = webRedirectUri();
  const request = kakaoRequest(redirectUri);
  const url = await request.makeAuthUrlAsync({ authorizationEndpoint: KAKAO_AUTHORIZE });
  const pending: PendingRedirect = {
    state: request.state,
    codeVerifier: request.codeVerifier,
    redirectUri,
    startedAt: Date.now(),
  };

  await AsyncStorage.setItem(REDIRECT_KEY, JSON.stringify(pending));
  window.location.assign(url);

  /* 페이지가 떠난다. 여기서 돌아오지 않는 것이 정상이다 — 버튼이 다시 켜지지 않게 붙잡아 둔다. */
  await new Promise<never>(() => undefined);
}

/** 지금 이 창이 카카오에서 돌아온 직후인가(URL에 code 또는 error). 부팅이 첫 화면을 정하기 전에 본다. */
export function hasKakaoReturn(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);

  return params.has('code') || params.has('error');
}

/**
 * 카카오에서 같은 창으로 돌아온 것을 마무리한다. **부팅(app/_layout.tsx)이
 * 첫 화면을 정하기 전에** 부른다 — 로그인 화면을 거치지 않고 스플래시에서
 * 곧장 온보딩/홈으로 간다.
 *
 * URL에 `code`가 있으면 떠나기 전에 적어둔 요청과 맞춰 서버에 교환하고 다음
 * 화면을 고를 값(`SessionEntry`)을 돌려준다. `code`가 없거나 사용자가 카카오에서
 * 취소했으면 null이다. URL의 인증 파라미터는 어느 경우든 지운다 — 새로고침에
 * 코드를 두 번 쓰지 않게.
 *
 * **`access_denied`가 늘 「취소」인 것은 아니다.** 카카오 앱을 「만 14세 미만
 * 이용 불가」로 설정하면, 14세 미만이 로그인할 때 카카오가 동의 화면을 띄우기도
 * 전에 `access_denied`로 되돌려 보낸다. 그것을 취소로 처리하면 아무 일도 없었던
 * 것처럼 로그인 화면에 남아, 그 사람은 왜 안 되는지 모른 채 계속 시도한다.
 * 이유는 `error_description`에 실려 온다 — 그 경우에는 WP-AUTH-010으로 보낸다.
 */
/**
 * 카카오가 나이 때문에 막은 것인가.
 *
 * 카카오 앱 설정의 「만 14세 미만 이용 불가」가 켜져 있으면 14세 미만은 동의
 * 화면까지 가지 못하고 `access_denied`로 돌아온다. 사용자가 스스로 취소한 것과
 * 같은 코드라 코드만 봐서는 갈리지 않고, 이유는 `error_description`에 있다.
 *
 * 문구는 카카오가 정하고 바뀔 수 있으므로 **낱말로 느슨하게 본다** — 영문
 * 안내(`Not allowed under age 14`)와 한글 안내를 함께 받는다. 못 알아보면
 * 취소로 남는다: 나이 때문에 막힌 사람을 취소로 보는 쪽이, 그냥 취소한 사람을
 * 「이용할 수 없다」로 보내는 것보다 덜 나쁘다.
 */
export function isUnderAgeDenial(error: string, description: string | null): boolean {
  if (error !== 'access_denied' || !description) return false;

  const text = description.toLowerCase();

  return /under\s*age|age\s*14|14\s*세|연령/.test(text);
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

  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`
  );

  const raw = await AsyncStorage.getItem(REDIRECT_KEY);

  await AsyncStorage.removeItem(REDIRECT_KEY);

  if (error) {
    if (isUnderAgeDenial(error, errorDescription)) throw new Error(UNDER_AGE_SIGN_IN_MESSAGE);
    if (error === 'access_denied') return null;
    throw new Error(KAKAO_FAILED);
  }

  if (!raw) {
    throw new Error('로그인 요청 정보가 없어요. 다시 시도해 주세요.');
  }

  const pending = JSON.parse(raw) as PendingRedirect;

  if (!state || state !== pending.state) {
    throw new Error('로그인 요청이 맞지 않아요. 다시 시도해 주세요.');
  }

  return await exchangeKakaoCode({
    provider: 'kakao',
    authorizationCode: code!,
    state,
    redirectUri: pending.redirectUri,
    codeVerifier: pending.codeVerifier,
  });
}
