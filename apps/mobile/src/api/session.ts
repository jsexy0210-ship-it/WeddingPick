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
