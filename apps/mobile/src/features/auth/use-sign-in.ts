import type { AuthProvider } from '@weddingpick/api-contract';
import { router } from 'expo-router';
import { useState } from 'react';

import { getCurrentUser } from '@/api/client';
import { completeAfterSignIn } from '@/features/auth/after-sign-in';
import { signInWith } from '@/features/auth/providers';
import { saveRememberedAccount } from '@/features/auth/remembered-account';

/**
 * `/login`의 기본 버튼과, 그 화면이 띄우는 "다른 방법으로 시작" 시트
 * (`other-login-sheet.tsx`)가 로그인 완료 후 해야 하는 일은 똑같다 — 가입
 * 미완료 처리, 멈춰둔 Pick 마무리, 다음 화면 결정. `/login`이 이 훅 하나만
 * 만들어서 시트에 `onSelect`로 넘긴다 — 두 곳에 따로 적어두면 한쪽만
 * 고쳐지는 날이 온다.
 */
export function useSignIn() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** WP-AUTH-004 "다시 시도"가 같은 제공자로 다시 부를 수 있게 마지막 시도를 기억한다. */
  const [lastProvider, setLastProvider] = useState<AuthProvider | null>(null);

  async function signIn(provider: AuthProvider) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setLastProvider(provider);

    try {
      await signInWith(provider);
      const after = await completeAfterSignIn();

      if (after.needsSignup) {
        /* 이름은 가입을 마쳐야 나온다 — 그래도 다음 실행에서 WP-AUTH-003이
           최소한 로그인 방법은 기억하도록 지금 남겨둔다. */
        await saveRememberedAccount({ provider: provider.provider, displayName: null });
        router.replace('/signup');

        return;
      }

      const me = await getCurrentUser().catch(() => null);

      await saveRememberedAccount({ provider: provider.provider, displayName: me?.displayName ?? null });
      router.replace(me?.setupComplete || after.savedWedding ? '/(tabs)' : '/setup');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    if (lastProvider) void signIn(lastProvider);
  }

  function dismissError() {
    setError(null);
  }

  return { signIn, busy, error, retry, dismissError };
}
