export {};

// 이 테스트에 필요한 Node 경계만 선언한다. 앱 전체의 타입 범위를 넓히지 않는다.
declare const require: (id: string) => unknown;
declare const __dirname: string;
const { execFileSync } = require('node:child_process') as {
  execFileSync: (file: string, args: string[], options: {
    cwd: string; env: Record<string, string | undefined>; encoding: 'utf8'; timeout: number;
  }) => string;
};
const { resolve } = require('node:path') as { resolve: (...paths: string[]) => string };
const runtime = require('node:process') as { execPath: string; env: Record<string, string | undefined> };

/** 기존 workspace Jest에서 실행한다. 별도 Actions 트리거를 추가하지 않는다. */
it('디자인 복구의 라우팅·비동기 조회·폰트 산출물 회귀를 검사한다', () => {
  const root = resolve(__dirname, '../../../../..');
  const env = { ...runtime.env };
  delete env.DESIGN_REPORT_PATH;
  const output = execFileSync(runtime.execPath, ['scripts/verify-design-recovery.cjs'], {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout: 20_000,
  });
  const result = JSON.parse(output.trim()) as { passed: number; failed: number };
  expect(result.failed).toBe(0);
  expect(result.passed).toBeGreaterThan(0);
}, 30_000);
