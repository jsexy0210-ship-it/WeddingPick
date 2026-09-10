import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 관리자 세션 토큰.
 *
 * **사용자 토큰과 다른 자리에 둔다.** 같은 자리를 쓰면 관리자로 로그인하는 순간
 * 그 브라우저의 사용자 세션이 덮이고, 관리자에서 로그아웃하면 사용자도 함께
 * 튕긴다. 관리자 콘솔은 웹에서만 열리므로 사용자 화면과 한 브라우저를 공유한다.
 *
 * 접두어는 `weddingpick.`을 지킨다 — 탈퇴가 기기를 쓸어낼 때 이 키도 함께 지운다.
 */
const KEY = 'weddingpick.adminToken.v1';

export async function loadAdminToken(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

export async function saveAdminToken(token: string): Promise<void> {
  await AsyncStorage.setItem(KEY, token);
}

export async function clearAdminToken(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
