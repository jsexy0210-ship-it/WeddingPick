import type { AuthProvider } from '@weddingpick/api-contract';
import { useCallback, useRef, useState } from 'react';

import { finishSignIn } from '@/features/auth/finish-sign-in';
import { completeKakaoRedirect, signInWithKakao } from '@/features/auth/providers';

/**
 * `/login`의 카카오 버튼(WP-AUTH-001/008)이 쓴다. 로그인 실패는 시트로 뜬다
 * (`login-failure-sheet.tsx`).
 *
 * 웹은 카카오에 **같은 창으로** 갔다 온다(`providers.ts`). 그래서 돌아온
 * 직후의 `/login?code=…`를 이 화면이 스스로 알아채고 마무리해야 한다 —
 * `resumeRedirect`가 그 일이다. 화면이 뜰 때 한 번 부른다.
 */
export function useSignIn() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** 로그인 실패 시트의 "다시 시도"가 같은 제공자로 다시 부를 수 있게 마지막 시도를 기억한다. */
  const [lastProvider, setLastProvider] = useState<AuthProvider | null>(null);
  /* 렌더와 무관하게 «지금 진행 중인가»를 본다 — 마운트 효과에서 부르는 resumeRedirect가 쓴다. */
  const busyRef = useRef(false);

  async function signIn(provider: AuthProvider) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setLastProvider(provider);

    try {
      await signInWithKakao(provider);
      await finishSignIn({ provider: provider.provider, email: null });
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const resumeRedirect = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);

    try {
      if (await completeKakaoRedirect()) {
        await finishSignIn({ provider: 'kakao', email: null });
      }
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  function retry() {
    if (lastProvider) void signIn(lastProvider);
  }

  function dismissError() {
    setError(null);
  }

  return { signIn, resumeRedirect, busy, error, retry, dismissError };
}
