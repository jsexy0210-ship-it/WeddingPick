import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'weddingpick.sessionToken.v1';

/** 세션 토큰. 서버가 발급할 때 한 번만 내려오므로 기기에 둔다. */
export async function loadToken(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEY);
}

export async function saveToken(token: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/**
 * 이 기기에 남은 웨딩픽 흔적을 전부 지운다 — 회원탈퇴가 쓴다(2026-09-08).
 *
 * 토큰만 지우면 부족하다. 기억된 계정(로그인 유지 화면), 온보딩 초안, 미뤄둔
 * 행동, 카카오 인증 요청, 최근 검색어, 기기 저장 서류까지 남는다 — 탈퇴한
 * 사람의 것이 하나라도 남으면 다음 사람이 그걸 본다. 키 이름을 하나씩 나열하지
 * 않고 `weddingpick.` 접두어로 쓸어낸다 — 나중에 키가 늘어도 빠뜨리지 않게.
 */
export async function wipeDevice(): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith('weddingpick.'));

  await Promise.all(keys.map((key) => AsyncStorage.removeItem(key)));
}
