import { router } from 'expo-router';

import { getCurrentUser } from '@/api/client';
import { completeAfterSignIn } from '@/features/auth/after-sign-in';
import { saveRememberedAccount, type RememberedAccount } from '@/features/auth/remembered-account';

/**
 * 로그인(카카오·이메일 공통)이 끝난 직후 한 번. `useSignIn`(카카오)과
 * 이메일 로그인 화면들이 같이 쓴다 — 가입 마무리·기억할 계정 정보·다음 화면
 * 결정이 로그인 방법과 무관하게 같아서, 두 곳에 따로 적으면 한쪽만 고쳐지는
 * 날이 온다.
 */
export async function finishSignIn(identity: { provider: RememberedAccount['provider']; email: string | null }) {
  const after = await completeAfterSignIn();

  if (after.needsSignup) {
    /* 이름·예식일은 가입을 마쳐야 나온다 — 그래도 다음 실행에서 WP-AUTH-008이
       최소한 로그인 방법은 기억하도록 지금 남겨둔다. */
    await saveRememberedAccount({
      provider: identity.provider,
      displayName: null,
      email: identity.email,
      weddingDate: null,
    });
    router.replace('/signup');

    return;
  }

  const me = await getCurrentUser().catch(() => null);

  await saveRememberedAccount({
    provider: identity.provider,
    displayName: me?.displayName ?? null,
    email: identity.email,
    weddingDate: me?.weddingDate ?? null,
  });
  router.replace(nextAfterSignIn({ setupComplete: me?.setupComplete, savedWedding: after.savedWedding }));
}

/**
 * 로그인·가입을 마친 뒤 어디로 가는가.
 *
 * **한 곳에만 적는다.** 로그인 경로와 가입 마무리 경로가 각자 적어두는 바람에
 * `signup.tsx`가 `'/'`로 굳어 온보딩(`/setup`)을 통째로 건너뛰고 있었다 —
 * 예식일·지역·예산·분위기를 한 번도 묻지 않고 홈에 도착했다. 같은 결정을 두 곳에
 * 적으면 한쪽만 고쳐지는 날이 온다.
 */
export function nextAfterSignIn(state: {
  setupComplete?: boolean;
  savedWedding?: boolean;
}): '/(tabs)' | '/setup' {
  return state.setupComplete || state.savedWedding ? '/(tabs)' : '/setup';
}
