import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { adminSession, createTestApp, resetDatabase, type TestApp } from './helpers';

const ROOT = join(__dirname, '..', '..', '..', '..');

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 뷰어 토큰으로는 아무것도 바꿀 수 없다.
 *
 * **화면에서 단추를 숨기는 것은 권한이 아니다.** 뷰어에게 콘솔을 열어 주면서 화면만
 * 손보면, 그 사람이 `PATCH`를 직접 부르는 순간 그대로 통한다. 막는 것은 서버여야
 * 하고, 막혔다는 것은 시험이 말해야 한다.
 *
 * ---------------------------------------------------------------------------
 * 라우트를 손으로 적지 않는다
 * ---------------------------------------------------------------------------
 *
 * 쓰기 라우트를 여기 목록으로 적어 두면, 열다섯 번째 라우트를 더하는 사람이 목록에
 * 적는 것을 잊는다. 잊은 것은 고장으로 보이지 않아 아무도 모르고, 그 라우트만 뷰어에게
 * 열린 채 남는다.
 *
 * 그래서 **저장소를 실제로 훑어** 라우트를 찾는다(`typography.test.ts`와 같은 방식).
 * 새 관리자 라우트가 생기면 이 시험이 저절로 그것도 두드린다.
 */
function adminRoutes(): { method: string; url: string }[] {
  const files = execSync("git ls-files 'apps/api/src/**/*.ts'", { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const found: { method: string; url: string }[] = [];

  for (const path of files) {
    const source = readFileSync(join(ROOT, path), 'utf8');

    for (const match of source.matchAll(/app\.(get|post|put|patch|delete)\('(\/v1\/admin[^']*)'/g)) {
      found.push({
        method: match[1]!.toUpperCase(),
        /* `:id`는 관문 뒤에서야 쓰인다. 관문에서 막히는지를 보는 시험이므로 아무 값이나 좋다. */
        url: match[2]!.replace(/:[a-zA-Z]+/g, '00000000-0000-4000-8000-000000000000'),
      });
    }
  }

  return found;
}

describeWithDb('관리자 쓰기 관문', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('훑어낸 관리자 라우트가 실제로 있다', () => {
    /*
     * 정규식이 어긋나 0개를 찾으면 아래 시험들이 **아무것도 확인하지 않고 통과한다.**
     * 빈 목록으로 도는 시험은 없는 시험보다 나쁘다 — 있다고 믿게 만든다.
     */
    const routes = adminRoutes();

    expect(routes.filter((route) => route.method === 'GET').length).toBeGreaterThan(20);
    expect(routes.filter((route) => route.method !== 'GET').length).toBeGreaterThan(10);
  });

  it('뷰어는 쓰기 라우트 전부에서 막힌다', async () => {
    const viewer = await adminSession(test, 'viewer');

    /* 로그인은 관문 밖이다 — 아이디·비밀번호로 들어오는 자리라 세션 등급이 없다. */
    const writes = adminRoutes().filter(
      (route) => route.method !== 'GET' && route.url !== '/v1/admin/login'
    );

    const passed: string[] = [];

    for (const route of writes) {
      const response = await test.app.inject({
        method: route.method as 'POST',
        url: route.url,
        headers: viewer.headers,
        payload: {},
      });

      if (response.statusCode !== 403) {
        passed.push(`${route.method} ${route.url} → ${response.statusCode}`);
      }
    }

    /* 어느 라우트가 열려 있는지 이름으로 말한다. 「몇 개 실패」로는 고칠 수 없다. */
    expect(passed).toEqual([]);
  });

  it('뷰어도 읽기는 된다 — 막는 것이 목적이 아니라 나누는 것이 목적이다', async () => {
    const viewer = await adminSession(test, 'viewer');

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/audit-log',
      headers: viewer.headers,
    });

    expect(response.statusCode).toBe(200);
  });

  it('운영자는 쓰기 관문을 지난다', async () => {
    const operator = await adminSession(test, 'operator');

    /*
     * 관문만 본다. 라우트가 400이든 200이든 상관없다 — 403이 아니면 지난 것이다.
     * 여기서 특정 라우트의 성공을 확인하면 그 라우트가 바뀔 때 이 시험이 함께 깨진다.
     */
    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/admin/retention/sweep',
      headers: operator.headers,
      payload: {},
    });

    expect(response.statusCode).not.toBe(403);
  });

  it('관리자가 아닌 계정은 읽기부터 막힌다', async () => {
    const outsider = await adminSession(test, null);

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/audit-log',
      headers: outsider.headers,
    });

    expect(response.statusCode).toBe(403);
  });

  it('계정 관리는 뷰어도 운영자도 읽지 못한다 — 슈퍼 전용이다', async () => {
    for (const role of ['viewer', 'operator'] as const) {
      const session = await adminSession(test, role);

      const response = await test.app.inject({
        method: 'GET',
        url: '/v1/admin/accounts',
        headers: session.headers,
      });

      expect(response.statusCode).toBe(403);
    }
  });
});
