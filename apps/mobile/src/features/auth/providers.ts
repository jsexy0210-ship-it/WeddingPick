import type { AuthProvider } from '@weddingpick/api-contract';
import { SocialColors } from '@weddingpick/ui';
import { AuthRequest, ResponseType, makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { listAuthProviders, signIn, signInWithAuthorizationCode } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { DEV_LOGIN_SECRET, devIdToken } from '@/features/auth/dev-login';

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
 * 카카오 redirect URI. 네이티브 앱 커스텀 스킴(`kakao...://`)은 웹에서 의미가
 * 없다 — 웹은 실제 페이지 주소로 돌아와야 팝업이 원래 창에 결과를 돌려줄 수
 * 있다(`WebBrowser.maybeCompleteAuthSession`). `/login` 고정 경로를 쓴다 —
 * 버튼이 이 화면(또는 그 하위 화면)에서만 눌리므로 항상 이 경로로 돌아온다.
 * 카카오 개발자센터에 이 값을 Redirect URI로 등록해야 한다.
 */
function webRedirectUri(): string {
  return `${window.location.origin}/login`;
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
export async function signInWithKakao(provider: AuthProvider): Promise<void> {
  if (provider.isDevelopmentStandIn) {
    await signIn('apple', devIdToken());

    return;
  }

  if (!KAKAO_CLIENT_ID) {
    throw new Error('카카오 로그인 설정이 아직 완료되지 않았습니다.');
  }

  const redirectUri =
    Platform.OS === 'web' ? webRedirectUri() : makeRedirectUri({ scheme: KAKAO_REDIRECT_SCHEME, path: 'oauth' });
  const request = new AuthRequest({
    clientId: KAKAO_CLIENT_ID,
    redirectUri,
    responseType: ResponseType.Code,
    /* profile_nickname — id_token에 nickname 클레임이 실린다. 화면 이름은 닉네임만 쓴다. */
    scopes: ['openid', 'profile_nickname'],
    usePKCE: true,
  });
  const result = await request.promptAsync({
    authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
  });

  if (result.type !== 'success' || !result.params.code) {
    if (result.type === 'cancel' || result.type === 'dismiss') return;
    throw new Error('카카오 로그인에 실패했습니다. 다시 시도해 주세요.');
  }

  await signInWithAuthorizationCode({
    provider: 'kakao',
    authorizationCode: result.params.code,
    state: result.params.state ?? request.state,
    redirectUri,
    codeVerifier: request.codeVerifier,
  });
}
