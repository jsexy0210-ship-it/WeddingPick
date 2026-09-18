// AsyncStorage는 네이티브 모듈이라 테스트에서는 공식 인메모리 목을 쓴다.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest')
);

// SecureStore도 네이티브 저장소다. API/client 회귀 테스트는 저장소 구현 자체가 아니라
// 세션 경계와 캐시 무효화를 검증하므로 테스트 전역에서는 실제 저장 의미를 가진
// 최소 인메모리 목을 쓴다. SecureStore 이전/실패 동작은 session.test.ts에서 별도 검증한다.
jest.mock('expo-secure-store', () => {
  const values = new Map();
  return {
    getItemAsync: async (key) => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); },
    deleteItemAsync: async (key) => { values.delete(key); },
  };
});
