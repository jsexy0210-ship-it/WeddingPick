import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import {
  clearToken, clearTokenIfMatches, loadToken, saveToken, wipeDevice,
} from './session';

jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => values.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
      removeItem: jest.fn(async (key: string) => { values.delete(key); }),
      getAllKeys: jest.fn(async () => [...values.keys()]),
      __values: values,
    },
  };
});

jest.mock('expo-secure-store', () => {
  const values = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    deleteItemAsync: jest.fn(async (key: string) => { values.delete(key); }),
    __values: values,
  };
});

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

jest.mock('./web-shell-session', () => ({
  clearWebShellToken: jest.fn(),
  initializeWebShellSession: jest.fn(async () => undefined),
  isWebShellSession: jest.fn(() => false),
  readWebShellToken: jest.fn(() => null),
}));

const KEY = 'weddingpick.sessionToken.v1';
const legacyValues = (AsyncStorage as unknown as { __values: Map<string, string> }).__values;
const secureValues = (SecureStore as unknown as { __values: Map<string, string> }).__values;

describe('native session secure storage', () => {
  beforeEach(() => {
    legacyValues.clear();
    secureValues.clear();
    jest.clearAllMocks();

    (AsyncStorage.getItem as jest.Mock).mockImplementation(
      async (key: string) => legacyValues.get(key) ?? null
    );
    (AsyncStorage.setItem as jest.Mock).mockImplementation(
      async (key: string, value: string) => { legacyValues.set(key, value); }
    );
    (AsyncStorage.removeItem as jest.Mock).mockImplementation(
      async (key: string) => { legacyValues.delete(key); }
    );
    (AsyncStorage.getAllKeys as jest.Mock).mockImplementation(
      async () => [...legacyValues.keys()]
    );

    (SecureStore.getItemAsync as jest.Mock).mockImplementation(
      async (key: string) => secureValues.get(key) ?? null
    );
    (SecureStore.setItemAsync as jest.Mock).mockImplementation(
      async (key: string, value: string) => { secureValues.set(key, value); }
    );
    (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(
      async (key: string) => { secureValues.delete(key); }
    );

    (Platform as { OS: string }).OS = 'ios';
  });

  it('기존 AsyncStorage 세션을 SecureStore로 이관한 뒤 구 사본을 지운다', async () => {
    legacyValues.set(KEY, 'legacy-token');

    await expect(loadToken()).resolves.toBe('legacy-token');

    expect(secureValues.get(KEY)).toBe('legacy-token');
    expect(legacyValues.has(KEY)).toBe(false);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(KEY, 'legacy-token');
  });

  it('SecureStore 이관 쓰기가 실패하면 기존 AsyncStorage 토큰을 보존한다', async () => {
    legacyValues.set(KEY, 'legacy-token');
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('secure store unavailable'));

    await expect(loadToken()).rejects.toThrow('secure store unavailable');

    expect(legacyValues.get(KEY)).toBe('legacy-token');
    expect(secureValues.has(KEY)).toBe(false);
  });

  it('SecureStore 세션이 있으면 구 AsyncStorage 값을 정리하고 secure 값을 쓴다', async () => {
    secureValues.set(KEY, 'secure-token');
    legacyValues.set(KEY, 'stale-token');

    await expect(loadToken()).resolves.toBe('secure-token');

    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(legacyValues.has(KEY)).toBe(false);
  });

  it('legacy cleanup이 한 번 실패해도 secure 세션을 유지하고 다음 조회에서 다시 정리한다', async () => {
    secureValues.set(KEY, 'secure-token');
    legacyValues.set(KEY, 'stale-token');
    (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('legacy cleanup failed'));

    await expect(loadToken()).resolves.toBe('secure-token');
    expect(secureValues.get(KEY)).toBe('secure-token');
    expect(legacyValues.get(KEY)).toBe('stale-token');

    await expect(loadToken()).resolves.toBe('secure-token');
    expect(legacyValues.has(KEY)).toBe(false);
  });

  it('신규 secure 저장 후 legacy cleanup 실패는 로그인 성공을 되돌리지 않는다', async () => {
    legacyValues.set(KEY, 'old-token');
    (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('legacy cleanup failed'));

    await expect(saveToken('new-token')).resolves.toBeUndefined();

    expect(secureValues.get(KEY)).toBe('new-token');
    expect(legacyValues.get(KEY)).toBe('old-token');

    await expect(loadToken()).resolves.toBe('new-token');
    expect(legacyValues.has(KEY)).toBe(false);
  });

  it('네이티브 신규 로그인은 SecureStore에 저장하고 구 사본을 제거한다', async () => {
    legacyValues.set(KEY, 'old-token');

    await saveToken('new-token');

    expect(secureValues.get(KEY)).toBe('new-token');
    expect(legacyValues.has(KEY)).toBe(false);
  });

  it('로그아웃은 SecureStore와 남아 있을 수 있는 구 사본을 모두 지운다', async () => {
    secureValues.set(KEY, 'secure-token');
    legacyValues.set(KEY, 'legacy-token');

    await clearToken();

    expect(secureValues.has(KEY)).toBe(false);
    expect(legacyValues.has(KEY)).toBe(false);
  });

  it('legacy 삭제 실패 시 secure 토큰을 먼저 지우지 않아 세션 부활을 막는다', async () => {
    secureValues.set(KEY, 'secure-token');
    legacyValues.set(KEY, 'legacy-token');
    (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('legacy cleanup failed'));

    await expect(clearToken()).rejects.toThrow('legacy cleanup failed');

    expect(secureValues.get(KEY)).toBe('secure-token');
    expect(legacyValues.get(KEY)).toBe('legacy-token');
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('다른 토큰을 대상으로 한 오래된 로그아웃 메시지는 현재 세션을 지우지 않는다', async () => {
    secureValues.set(KEY, 'current-token');

    await expect(clearTokenIfMatches('old-token')).resolves.toBe(false);
    expect(secureValues.get(KEY)).toBe('current-token');

    await expect(clearTokenIfMatches('current-token')).resolves.toBe(true);
    expect(secureValues.has(KEY)).toBe(false);
  });

  it('탈퇴는 SecureStore 세션과 weddingpick AsyncStorage 잔여를 모두 제거한다', async () => {
    secureValues.set(KEY, 'secure-token');
    legacyValues.set(KEY, 'legacy-token');
    legacyValues.set('weddingpick.oauth.pending', 'pending');
    legacyValues.set('other.app.key', 'keep');

    await wipeDevice();

    expect(secureValues.has(KEY)).toBe(false);
    expect(legacyValues.has(KEY)).toBe(false);
    expect(legacyValues.has('weddingpick.oauth.pending')).toBe(false);
    expect(legacyValues.get('other.app.key')).toBe('keep');
  });

  it('일반 웹은 기존 AsyncStorage 경로를 유지하고 SecureStore를 호출하지 않는다', async () => {
    (Platform as { OS: string }).OS = 'web';

    await saveToken('web-token');
    await expect(loadToken()).resolves.toBe('web-token');

    expect(legacyValues.get(KEY)).toBe('web-token');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  });
});
