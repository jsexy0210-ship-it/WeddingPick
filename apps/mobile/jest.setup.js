// AsyncStorage는 네이티브 모듈이라 테스트에서는 공식 인메모리 목을 쓴다.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest')
);
