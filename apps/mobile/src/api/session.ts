import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import {
  clearWebShellToken, initializeWebShellSession, isWebShellSession, readWebShellToken,
} from './web-shell-session';

const STORAGE_KEY = 'weddingpick.sessionToken.v1';
const listeners = new Set<() => void>();
let tail: Promise<unknown> = Promise.resolve();

/** 저장·이전 응답·로그아웃이 비동기 저장소에서 서로 앞지르지 않게 직렬화한다. */
function serial<T>(action: () => Promise<T>): Promise<T> {
  const result = tail.then(action);
  tail = result.catch(() => undefined);
  return result;
}
function changed(): void { for (const listener of listeners) listener(); }
export function subscribeToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function usesNativeSecureStore(): boolean {
  return Platform.OS !== 'web' && !isWebShellSession();
}


/**
 * 기존 앱이 AsyncStorage에 보관하던 네이티브 세션을 한 번만 SecureStore로 옮긴다.
 *
 * SecureStore 쓰기가 성공하기 전에는 옛 값을 지우지 않는다. 앱 업데이트 직후 키체인/
 * Keystore 쓰기가 실패했다고 사용자를 강제로 로그아웃시키는 것보다, 이전 값을 남겨
 * 다음 실행에서 다시 이관하는 편이 안전하다.
 */
async function readNativeToken(): Promise<string | null> {
  const secured = await SecureStore.getItemAsync(STORAGE_KEY);
  if (secured !== null) {
    // SecureStore가 정본이면 이관 도중 남은 legacy 사본은 더 이상 필요 없다.
    // cleanup 실패로 현재 세션까지 실패시키지 않고 다음 load에서 다시 시도한다.
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // SecureStore 토큰은 이미 안전하게 존재한다. legacy cleanup만 재시도 대상으로 남긴다.
    }

    return secured;
  }

  const legacy = await AsyncStorage.getItem(STORAGE_KEY);
  if (legacy === null) return null;

  await SecureStore.setItemAsync(STORAGE_KEY, legacy);
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // SecureStore가 이미 정본이다. 다음 load에서 stale legacy cleanup을 다시 시도한다.
  }
  return legacy;
}

async function readCurrent(): Promise<string | null> {
  if (isWebShellSession()) return readWebShellToken();
  if (usesNativeSecureStore()) return readNativeToken();
  return AsyncStorage.getItem(STORAGE_KEY);
}

async function removeCurrent(): Promise<void> {
  if (isWebShellSession()) {
    clearWebShellToken();
  } else if (usesNativeSecureStore()) {
    /*
     * legacy를 먼저 지운다. 반대로 SecureStore를 먼저 지운 뒤 legacy 삭제가 실패하면
     * 다음 load가 옛 토큰을 다시 SecureStore로 이관해 로그아웃을 되돌릴 수 있다.
     */
    await AsyncStorage.removeItem(STORAGE_KEY);
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } else {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
  changed();
}

export async function loadToken(): Promise<string | null> {
  await initializeWebShellSession();
  return serial(readCurrent);
}

export async function saveToken(token: string): Promise<void> {
  await initializeWebShellSession();
  if (isWebShellSession()) {
    // 네이티브와 웹이 다른 계정으로 로그인하는 것을 막는다. 재인증은 앱에서 한다.
    clearWebShellToken();
    throw new Error('앱에서 다시 로그인해주세요.');
  }

  await serial(async () => {
    if (usesNativeSecureStore()) {
      await SecureStore.setItemAsync(STORAGE_KEY, token);
      // 새 secure 토큰이 정본이다. legacy cleanup 실패는 다음 load에서 재시도한다.
      try {
        await AsyncStorage.removeItem(STORAGE_KEY);
      } catch {
        // stale legacy는 readNativeToken이 secure 값을 우선한 뒤 다시 정리한다.
      }
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, token);
    }
    changed();
  });
}

export async function clearToken(): Promise<void> {
  // 전달 실패·저장소 장애 중에도 로그아웃을 시도할 수 있어야 한다.
  await serial(removeCurrent);
}

/** 오래된 웹뷰의 로그아웃 메시지가 새 계정을 지우지 못하게 한다. */
export async function clearTokenIfMatches(expected: string): Promise<boolean> {
  return serial(async () => {
    if (await readCurrent() !== expected) return false;
    await removeCurrent();
    return true;
  });
}

/** 탈퇴 시 영속 저장소뿐 아니라 탭별 OAuth 임시 정보도 제거한다. */
export async function wipeDevice(): Promise<void> {
  await serial(async () => {
    const nativeSecure = usesNativeSecureStore();

    if (isWebShellSession()) {
      clearWebShellToken();
    }

    /*
     * 탈퇴도 legacy를 먼저 제거한다. AsyncStorage 정리가 실패하면 secure token을 남긴
     * 채 실패해야, 다음 실행에서 오래된 token이 재이관되는 상태를 만들지 않는다.
     */
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith('weddingpick.'));
    await Promise.all(keys.map((key) => AsyncStorage.removeItem(key)));

    if (nativeSecure) {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    }

    if (typeof window !== 'undefined' && typeof window.location?.href === 'string') {
      const storage = window.sessionStorage;
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i);
        if (key?.startsWith('weddingpick.')) storage.removeItem(key);
      }
      window.dispatchEvent(new Event('weddingpick:adminToken'));
    }
    changed();
  });
}
