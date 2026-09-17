module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  /*
   * **한 번에 한 파일씩 돈다.** 이 워크스페이스의 시험은 전부 같은 DB 하나를 보고,
   * 저마다 `resetSchema`로 스키마를 통째로 지웠다 다시 올린다 — 둘이 동시에 돌면
   * 한쪽이 `public`을 지우는 사이 다른 쪽이 `schema_migrations`를 찾는다.
   *
   * 파일이 하나였을 때는 드러나지 않던 자리다(2026-09-16에 둘이 되면서 드러났다).
   */
  maxWorkers: 1,
  testTimeout: 60000,
  forceExit: true,
  openHandlesTimeout: 0,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
