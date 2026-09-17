import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/** 기존 workspace Jest에서 실행한다. 별도 Actions 트리거를 추가하지 않는다. */
it('디자인 복구의 라우팅·비동기 조회·폰트 산출물 회귀를 검사한다', () => {
  const root = resolve(__dirname, '../../../../..');
  const env = { ...process.env };
  delete env.DESIGN_REPORT_PATH;
  const output = execFileSync(process.execPath, ['scripts/verify-design-recovery.cjs'], {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout: 20_000,
  });
  const result = JSON.parse(output.trim()) as { passed: number; failed: number };
  expect(result.failed).toBe(0);
  expect(result.passed).toBeGreaterThan(0);
}, 30_000);
