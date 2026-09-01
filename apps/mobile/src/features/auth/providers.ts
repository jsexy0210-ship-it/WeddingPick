import type { AuthProvider } from '@weddingpick/api-contract';
import { useEffect, useState } from 'react';

import { listAuthProviders, signIn } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { DEV_LOGIN_SECRET, devIdToken } from '@/features/auth/dev-login';

export const PROVIDER_LABEL = {
  apple: 'Apple로 계속하기',
  kakao: '카카오로 계속하기',
} as const;

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
  return provider.isDevelopmentStandIn ? Boolean(DEV_LOGIN_SECRET) : true;
}

/**
 * 로그인 한 번.
 *
 * 제공자 SDK는 클라이언트 ID가 나온 뒤에 붙인다. 그 전까지 실제 제공자 버튼은
 * 눌러도 여기서 멈춘다 — 눌리는 척하고 아무 일도 안 하는 것보다 낫다.
 */
export async function signInWith(provider: AuthProvider): Promise<void> {
  if (!provider.isDevelopmentStandIn) {
    throw new Error('아직 준비 중입니다.');
  }

  await signIn(provider.provider, devIdToken());
}
