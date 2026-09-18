import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/** 기존 Jest 실행에 연결하며 CI 트리거나 런타임 의존성을 추가하지 않는다. */
it('확인창 대기열의 수명·순서·중복 실행 방어를 검사한다', () => {
  const output = execFileSync(process.execPath, ['--test', 'scripts/verify-confirmation-queue.cjs'], {
    cwd: resolve(__dirname, '../../../..'),
    encoding: 'utf8',
    timeout: 20_000,
  });
  expect(output).toMatch(/# pass 14\b/);
  expect(output).toMatch(/# fail 0\b/);
}, 30_000);
