import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthProvider } from '@weddingpick/api-contract';

const STORAGE_KEY = 'weddingpick.rememberedAccount.v1';

export type RememberedAccount = {
  provider: AuthProvider['provider'];
  /** MY에서 정하는 이름. 아직 안 정했으면 null — 그 경우 화면은 이름 없이 인사한다. */
  displayName: string | null;
};

/**
 * WP-AUTH-003 "로그인 유지"가 읽는 값. 세션 토큰(`api/session.ts`)과 분리한다 —
 * 로그아웃하거나 세션이 만료돼도 "누가 마지막으로 썼는지"는 남아야 다음
 * 실행에서 빈 로그인 화면 대신 이 화면을 보여줄 수 있다.
 *
 * 서버 `/v1/me`(`currentUserSchema`)에는 이메일이 없다 — 마스킹된 이메일
 * 같은 계정 식별자는 아직 못 보여준다. 이름·로그인 방법만 기억한다.
 */
export async function loadRememberedAccount(): Promise<RememberedAccount | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);

  if (!raw) return null;

  try {
    return JSON.parse(raw) as RememberedAccount;
  } catch {
    return null;
  }
}

export async function saveRememberedAccount(account: RememberedAccount): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(account));
}
