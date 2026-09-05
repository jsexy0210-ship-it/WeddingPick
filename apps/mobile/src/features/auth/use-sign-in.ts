import type { AuthProvider } from '@weddingpick/api-contract';
import { router } from 'expo-router';
import { useState } from 'react';

import { getCurrentUser } from '@/api/client';
import { completeAfterSignIn } from '@/features/auth/after-sign-in';
import { signInWith } from '@/features/auth/providers';

/**
 * 로그인 화면(`/login`)과 다른 방법으로 로그인 화면(`/login-other`)이 로그인
 * 완료 후 해야 하는 일은 똑같다 — 가입 미완료 처리, 멈춰둔 Pick 마무리,
 * 다음 화면 결정. 두 화면에 각각 적어두면 한쪽만 고쳐지는 날이 온다.
 */
export function useSignIn() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(provider: AuthProvider) {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      await signInWith(provider);
      const after = await completeAfterSignIn();

      if (after.needsSignup) {
        router.replace('/signup');

        return;
      }

      const me = await getCurrentUser().catch(() => null);

      router.replace(me?.setupComplete || after.savedWedding ? '/(tabs)' : '/setup');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return { signIn, busy, error };
}
