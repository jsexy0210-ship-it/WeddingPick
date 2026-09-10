import type { AuthProvider } from '@weddingpick/api-contract';
import { router } from 'expo-router';
import { useState } from 'react';

import { finishSignIn } from '@/features/auth/finish-sign-in';
import { signInWithKakao } from '@/features/auth/providers';
import { AGE_REQUIRED_ROUTE, isUnderAgeSignInError } from '@/features/auth/sign-in-handoff';

/**
 * `/login`의 카카오 버튼(WP-AUTH-001/008)이 쓴다. 로그인 실패는 시트로 뜬다
 * (`login-failure-sheet.tsx`).
 *
 * 세션이 열리면 응답이 알려준 값(`SessionEntry`)으로 **바로** 화면을 옮긴다 —
 * 서버에 다시 묻지 않는다. 웹은 카카오에 같은 창으로 갔다 오고, 돌아온 뒤는
 * 부팅(app/_layout.tsx)이 스플래시에서 곧장 마무리한다 — 로그인 화면은 그
 * 결과 중 실패만 `reportError`로 넘겨받아 시트로 띄운다.
 *
 * 서버가 만 14세 미만으로 판정한 것(`under_age`, v3.22 SPEC 3.5)은 실패가 아니라
 * 안내다 — 시트 대신 WP-AUTH-009으로 간다.
 *
 * **나이를 확인하지 못한 것(`age_unverified`)은 다른 자리다.** 미만이라고 판정한
 * 것이 아니라 카카오가 연령대를 주지 않아 판정을 못 한 것이고, 그 사람은 서른일
 * 수도 있다. WP-AUTH-009으로 보내지 않고 실패 시트로 둔다 — 서버 문구가 무엇을
 * 하면 되는지까지 말하고, 시트에는 「다시 시도」가 있다.
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
      const entry = await signInWithKakao(provider);

      /* null은 취소(또는 웹에서 이미 떠난 뒤)다 — 아무 데도 가지 않는다. */
      if (entry) await finishSignIn({ provider: provider.provider, email: null }, entry);
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  }

  /** 실패 하나를 시트 또는 WP-AUTH-009으로. 두 진입(버튼 · 부팅)이 같은 판단을 쓴다. */
  function fail(caught: unknown) {
    if (isUnderAgeSignInError(caught)) {
      router.replace(AGE_REQUIRED_ROUTE);

      return;
    }

    setError(caught instanceof Error ? caught.message : '로그인하지 못했어요.');
  }

  function retry() {
    if (lastProvider) void signIn(lastProvider);
  }

  function dismissError() {
    setError(null);
  }

  /** 부팅이 넘긴 실패(카카오 리다이렉트 마무리 실패)를 시트로 띄운다. 문장 하나로 온다. */
  function reportError(message: string) {
    fail(new Error(message));
  }

  return { signIn, busy, error, retry, dismissError, reportError };
}
