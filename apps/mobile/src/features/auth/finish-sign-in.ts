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
  router.replace(me?.setupComplete || after.savedWedding ? '/(tabs)' : '/setup');
}
