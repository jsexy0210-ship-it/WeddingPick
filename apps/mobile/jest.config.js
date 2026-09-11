/**
 * **`testTimeout`을 둔다 — jest 기본값 5초는 화면을 그리는 시험에 모자란다.**
 *
 * `depth-back-buttons.test.tsx`의 첫 시험이 2026-09-11 CI에서 두 번 죽었다
 * (run 34562339488 · 34567734303). 단정이 깨진 것이 아니라 시간이 넘었다 —
 * `thrown: "Exceeded timeout of 5000 ms for a test."`
 *
 * 그 시험은 평소 275ms에 끝난다. 파일 맨 위에서 실제 화면 셋을 import하고
 * **그 적재·첫 렌더 비용을 파일의 첫 시험이 혼자 내기 때문에**, 러너가 눌리면
 * 그 한 줄만 예산을 넘긴다(뒤 여덟 개는 2~5ms). 같은 커밋이 로컬에서는
 * 전체 통과했고 CI에서는 세 번 중 두 번 죽었다.
 *
 * 값을 늘리는 것은 시험을 끄거나 건너뛰는 것이 아니다 — 단정은 그대로이고
 * 느려진 것을 기다려 줄 뿐이다. 정말 멈춘 시험은 30초에 그대로 잡힌다.
 *
 * `apps/api`와 `packages/db`가 이미 같은 것을 한다(둘 다 `testTimeout: 60000`).
 * 여기만 기본값이었다. 30초는 실측 최악(6.4초)의 다섯 배다.
 */
module.exports = {
  testTimeout: 30000,
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  forceExit: true,
  openHandlesTimeout: 0,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
