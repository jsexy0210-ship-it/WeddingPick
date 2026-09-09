import { router } from 'expo-router';

import { getCurrentUser, type SessionEntry } from '@/api/client';
import { completeAfterSignIn } from '@/features/auth/after-sign-in';
import { saveRememberedAccount, type RememberedAccount } from '@/features/auth/remembered-account';

type Identity = { provider: RememberedAccount['provider']; email: string | null };

/**
 * 로그인(카카오·이메일 공통)이 끝난 직후 한 번. `useSignIn`(카카오)과
 * 이메일 로그인 화면들이 같이 쓴다 — 가입 마무리·기억할 계정 정보·다음 화면
 * 결정이 로그인 방법과 무관하게 같아서, 두 곳에 따로 적으면 한쪽만 고쳐지는
 * 날이 온다.
 *
 * **세션 응답이 다음 화면을 이미 알려준다**(`entry`, 2026-09-08). 예전에는
 * 여기서 /v1/me/signup을 한 번 더 묻고 나서야 화면을 옮겨서, 카카오 동의를
 * 마친 사람이 로그인 화면에 머물렀다가 온보딩으로 넘어갔다. 이제 그 값이
 * 있으면 서버에 아무것도 묻지 않고 **바로** 옮긴다. 기억할 계정의 이름·예식일은
 * 화면을 옮긴 뒤 뒤에서 채운다 — 다음 실행에나 쓰는 값이라 지금 기다릴 이유가
 * 없다. `entry`가 없는 호출(이메일 화면, 보류 중)은 예전 경로 그대로다.
 */
export async function finishSignIn(identity: Identity, entry?: SessionEntry) {
  if (entry) {
    const next = await entryAfterSignIn(entry);

    void rememberSignedIn(identity, next === '/setup');
    router.replace(next);

    return;
  }

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
    /*
     * 별도의 «가입 마무리» 화면은 없다. 만 14세 확인은 서버가 로그인 콜백에서
     * 이미 끝냈고(v3.24), 동의는 로그인 CTA에 붙은 안내(«시작하면
     * 이용약관과 개인정보처리방침에 동의하게 돼요»)로 받는다. 온보딩(`/setup`)이
     * 둘 다 서버에 올린다.
     */
    router.replace('/setup');

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
 * 세션 응답만 보고 첫 화면을 고른다. 부팅(app/_layout.tsx)이 카카오 리다이렉트를
 * 마무리할 때도 같은 판단을 쓴다 — 두 곳이 다르면 한쪽만 고쳐지는 날이 온다.
 *
 * 가입이 끝난 계정은 기기에 적어둔 초안·미뤄둔 행동을 여기서 마저 처리한다
 * (`completeAfterSignIn`, 서버에 다시 묻지 않는다 — 기기 저장소만 읽는다).
 */
export async function entryAfterSignIn(entry: SessionEntry): Promise<'/(tabs)' | '/setup'> {
  if (!entry.activated) return '/setup';

  const after = await completeAfterSignIn({ activated: true });

  return nextAfterSignIn({ setupComplete: entry.setupComplete, savedWedding: after.savedWedding });
}

/**
 * WP-AUTH-008(로그인 유지)이 다음 실행에서 보여줄 계정을 남긴다.
 *
 * `pending`이면 이름·예식일이 아직 없다(가입 전) — 로그인 방법만 남긴다.
 * 아니면 서버에서 이름·예식일을 받아 채우되, 못 받아도 방법만은 남긴다.
 */
export async function rememberSignedIn(identity: Identity, pending: boolean): Promise<void> {
  const me = pending ? null : await getCurrentUser().catch(() => null);

  await saveRememberedAccount({
    provider: identity.provider,
    displayName: me?.displayName ?? null,
    email: identity.email,
    weddingDate: me?.weddingDate ?? null,
  }).catch(() => undefined);
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
