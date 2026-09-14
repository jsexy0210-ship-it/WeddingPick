import type { AuthProvider } from '@weddingpick/api-contract';
import { router } from 'expo-router';
import { useState } from 'react';

import { finishSignIn } from '@/features/auth/finish-sign-in';
import { signInWithKakao } from '@/features/auth/providers';
import {
  AGE_REQUIRED_ROUTE,
  isAgeUnverifiedSignInError,
  isUnderAgeSignInError,
} from '@/features/auth/sign-in-handoff';

/**
 * `/login`의 카카오 버튼(WP-AUTH-001/008)이 쓴다. 로그인 실패는 시트로 뜬다
 * (`login-failure-sheet.tsx`).
 *
 * 세션이 열리면 응답이 알려준 값(`SessionEntry`)으로 **바로** 화면을 옮긴다 —
 * 서버에 다시 묻지 않는다. 웹은 카카오에 같은 창으로 갔다 오고, 돌아온 뒤는
 * 부팅(app/_layout.tsx)이 스플래시에서 곧장 마무리한다 — 로그인 화면은 그
 * 결과 중 실패만 `reportError`로 넘겨받아 시트로 띄운다.
 *
 * 나이로 갈리는 결과가 **둘**이고 가는 곳이 다르다(2026-09-10).
 *
 *   `under_age`       미달로 확인됐다 → WP-AUTH-009 이용 불가 안내
 *   `age_unverified`  판정할 근거가 없었다 → 로그인 화면이 «만 14세 이상이에요»를
 *                     한 번 받고 다시 시도한다(`needsAgeConfirm`)
 *
 * 둘을 한 곳으로 보내면 안 된다. 카카오가 연령대를 주지 않은 사람에게
 * 「만 14세가 되면 다시 찾아주세요」라고 말하게 되는데, 그 사람은 미달이라고
 * 확인된 적이 없다.
 */
export function useSignIn() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** 로그인 실패 시트의 "다시 시도"가 같은 제공자로 다시 부를 수 있게 마지막 시도를 기억한다. */
  const [lastProvider, setLastProvider] = useState<AuthProvider | null>(null);

  /**
   * 화면이 «만 14세 이상이에요»를 받아야 하는가. 서버가 연령대를 못 받았을 때만
   * 켜진다 — 평소에는 묻지 않는다(제공자가 판정한다).
   */
  const [needsAgeConfirm, setNeedsAgeConfirm] = useState(false);

  async function signIn(provider: AuthProvider, options: { ageAcknowledged?: boolean } = {}) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setLastProvider(provider);

    try {
      const entry = await signInWithKakao(provider, options);

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

    /*
     * 실패 시트를 띄우지 않는다. 다시 시도하라고 할 것이 아니라 확인 하나를 더
     * 받아야 하는 자리다 — 시트를 띄우면 「다시 시도」가 같은 실패를 반복한다.
     */
    if (isAgeUnverifiedSignInError(caught)) {
      setNeedsAgeConfirm(true);

      return;
    }

    setError(caught instanceof Error ? caught.message : '로그인하지 못했어요.');
  }

  /*
   * 확인값을 여기서 채우지 않는다. `ageAcknowledged`는 **사람이 화면에서 누른
   * 것**일 때만 실린다 — 훅이 「확인이 필요한 상태니까 확인된 것으로 하자」고
   * 채우면, 앱이 늘 true를 보내던 예전 자리를 이름만 바꿔 되살리는 것이 된다.
   */
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

  return { signIn, busy, error, retry, dismissError, reportError, needsAgeConfirm };
}
