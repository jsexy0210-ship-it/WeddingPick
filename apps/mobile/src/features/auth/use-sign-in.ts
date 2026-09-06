import type { AuthProvider } from '@weddingpick/api-contract';
import { useState } from 'react';

import { finishSignIn } from '@/features/auth/finish-sign-in';
import { signInWithKakao } from '@/features/auth/providers';

/**
 * `/login`의 카카오 버튼(WP-AUTH-001/008)이 쓴다. 로그인 실패는 시트로 뜬다
 * (`login-failure-sheet.tsx`).
 */
export function useSignIn() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** 로그인 실패 시트의 "다시 시도"가 같은 제공자로 다시 부를 수 있게 마지막 시도를 기억한다. */
  const [lastProvider, setLastProvider] = useState<AuthProvider | null>(null);

  async function signIn(provider: AuthProvider) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setLastProvider(provider);

    try {
      await signInWithKakao(provider);
      await finishSignIn({ provider: provider.provider, email: null });
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
