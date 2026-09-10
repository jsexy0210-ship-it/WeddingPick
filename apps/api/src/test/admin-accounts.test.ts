import { hashAdminPassword } from '../auth/admin-password';
import { adminSession, createTestApp, resetDatabase, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/** 12자 이상이어야 한다(라우트 규칙). 시험용 값이고 어디에도 저장되지 않는다. */
const PASSWORD = 'test-password-1';

/**
 * 관리자 계정 관리.
 *
 * 2026-09-10 사용자 요청 — 운영자가 직접 계정을 만들고, 실질 운영 권한과 단순 뷰어
 * 권한을 나눠 줄 수 있게 한다.
 *
 * 여기서 보는 것은 **등급이 스스로를 지키는가**다. 등급을 올릴 수 있는 사람이
 * 정해져 있지 않으면 등급은 이름표일 뿐이다.
 */
describeWithDb('관리자 계정 관리', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(async () => {
    await resetDatabase();
    test.context.config.adminLoginId = undefined;
    test.context.config.adminPasswordHash = undefined;
  });

  async function create(
    headers: Record<string, string>,
    body: { loginId: string; password?: string; role: string }
  ) {
    return await test.app.inject({
      method: 'POST',
      url: '/v1/admin/accounts',
      headers,
      payload: { password: PASSWORD, ...body },
    });
  }

  async function accountId(loginId: string): Promise<string> {
    const { rows } = await test.pool.query<{ id: string }>(
      'SELECT id FROM structured.admin_accounts WHERE login_id = $1',
      [loginId]
    );

    return rows[0]!.id;
  }

  describe('계정 만들기', () => {
    it('슈퍼 관리자가 운영자와 뷰어를 만든다', async () => {
      const boss = await adminSession(test, 'super');

      for (const role of ['operator', 'viewer'] as const) {
        const response = await create(boss.headers, { loginId: `made-${role}`, role });

        expect(response.statusCode).toBe(201);
        expect(response.json()).toMatchObject({ loginId: `made-${role}`, role, disabled: false });
      }
    });

    it('만든 계정으로 실제로 로그인된다', async () => {
      const boss = await adminSession(test, 'super');
      await create(boss.headers, { loginId: 'fresh-one', role: 'operator' });

      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/admin/login',
        payload: { id: 'fresh-one', password: PASSWORD },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ role: 'operator' });
    });

    it('등급이 users.is_operator와 어긋나지 않는다', async () => {
      const boss = await adminSession(test, 'super');
      await create(boss.headers, { loginId: 'runs-things', role: 'operator' });
      await create(boss.headers, { loginId: 'just-looks', role: 'viewer' });

      const { rows } = await test.pool.query<{ login_id: string; is_operator: boolean }>(
        `SELECT a.login_id, u.is_operator
         FROM structured.admin_accounts a JOIN structured.users u ON u.id = a.user_id
         ORDER BY a.login_id`
      );

      expect(rows).toEqual([
        /* 이 시험의 슈퍼 관리자 자신. 슈퍼도 「운영자 이상」이라 참이다. */
        { login_id: 'admin-super', is_operator: true },
        { login_id: 'just-looks', is_operator: false },
        { login_id: 'runs-things', is_operator: true },
      ]);
    });

    it('같은 아이디를 두 번 만들 수 없다', async () => {
      const boss = await adminSession(test, 'super');
      await create(boss.headers, { loginId: 'only-once', role: 'viewer' });

      const again = await create(boss.headers, { loginId: 'only-once', role: 'viewer' });

      expect(again.statusCode).toBe(409);
    });

    it('짧은 비밀번호는 거절한다', async () => {
      const boss = await adminSession(test, 'super');

      const response = await create(boss.headers, {
        loginId: 'too-easy',
        password: 'short',
        role: 'viewer',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('비밀번호는 어디에도 남지 않는다', () => {
    it('응답에 원문이 없다', async () => {
      const boss = await adminSession(test, 'super');

      const response = await create(boss.headers, { loginId: 'secret-keeper', role: 'viewer' });

      expect(response.body).not.toContain(PASSWORD);
    });

    it('저장된 것은 scrypt 해시뿐이다', async () => {
      const boss = await adminSession(test, 'super');
      await create(boss.headers, { loginId: 'secret-keeper', role: 'viewer' });

      const { rows } = await test.pool.query<{ password_hash: string }>(
        'SELECT password_hash FROM structured.admin_accounts WHERE login_id = $1',
        ['secret-keeper']
      );

      expect(rows[0]!.password_hash).toMatch(/^scrypt\$/);
      expect(rows[0]!.password_hash).not.toContain(PASSWORD);
    });

    it('감사기록에도 없다', async () => {
      const boss = await adminSession(test, 'super');
      await create(boss.headers, { loginId: 'secret-keeper', role: 'viewer' });

      /*
       * 줄 전체를 글자로 바꿔 훑는다. 어느 칸에 들어갈지 미리 짐작하고 그 칸만
       * 보면, 짐작하지 못한 칸으로 새는 것을 놓친다.
       */
      const { rows } = await test.pool.query<{ line: string }>(
        `SELECT d::text AS line FROM structured.decisions d WHERE workflow = 'admin_account'`
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]!.line).not.toContain(PASSWORD);
    });
  });

  describe('슈퍼 관리자는 스스로를 지킨다', () => {
    it('마지막 슈퍼 관리자는 자기 등급을 내릴 수 없다', async () => {
      const boss = await adminSession(test, 'super');

      const response = await test.app.inject({
        method: 'PATCH',
        url: `/v1/admin/accounts/${await accountId('admin-super')}/role`,
        headers: boss.headers,
        payload: { role: 'operator' },
      });

      expect(response.statusCode).toBe(409);

      /* 정말 그대로인가. 응답 코드만 보면 「막았다고 답하고 바꿨다」를 놓친다. */
      const { rows } = await test.pool.query<{ role: string }>(
        `SELECT role FROM structured.admin_accounts WHERE login_id = 'admin-super'`
      );
      expect(rows[0]!.role).toBe('super');
    });

    it('마지막 슈퍼 관리자는 자기를 끌 수도 없다', async () => {
      const boss = await adminSession(test, 'super');

      const response = await test.app.inject({
        method: 'PATCH',
        url: `/v1/admin/accounts/${await accountId('admin-super')}/disabled`,
        headers: boss.headers,
        payload: { disabled: true },
      });

      expect(response.statusCode).toBe(409);
    });

    it('슈퍼가 둘이면 자기를 내릴 수 있다', async () => {
      const boss = await adminSession(test, 'super');
      await create(boss.headers, { loginId: 'second-boss', role: 'super' });

      const response = await test.app.inject({
        method: 'PATCH',
        url: `/v1/admin/accounts/${await accountId('admin-super')}/role`,
        headers: boss.headers,
        payload: { role: 'viewer' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ role: 'viewer' });
    });

    it('남의 슈퍼 등급은 내릴 수 없다 — 먼저 누르는 쪽이 이기는 경주를 막는다', async () => {
      const boss = await adminSession(test, 'super');
      await create(boss.headers, { loginId: 'second-boss', role: 'super' });

      const response = await test.app.inject({
        method: 'PATCH',
        url: `/v1/admin/accounts/${await accountId('second-boss')}/role`,
        headers: boss.headers,
        payload: { role: 'viewer' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('남의 슈퍼 계정을 끌 수도 없다', async () => {
      const boss = await adminSession(test, 'super');
      await create(boss.headers, { loginId: 'second-boss', role: 'super' });

      const response = await test.app.inject({
        method: 'PATCH',
        url: `/v1/admin/accounts/${await accountId('second-boss')}/disabled`,
        headers: boss.headers,
        payload: { disabled: true },
      });

      expect(response.statusCode).toBe(403);
    });

    it('운영자는 자기를 슈퍼로 올릴 수 없다 — 계정 관리에 들어오지도 못한다', async () => {
      const boss = await adminSession(test, 'super');
      await create(boss.headers, { loginId: 'ambitious', role: 'operator' });

      const worker = await adminSession(test, null);
      /* 방금 만든 운영자 계정의 세션으로 바꿔 단다. */
      await test.pool.query(
        `UPDATE identity.sessions SET user_id =
           (SELECT user_id FROM structured.admin_accounts WHERE login_id = 'ambitious')
         WHERE user_id = $1`,
        [worker.userId]
      );

      const response = await test.app.inject({
        method: 'PATCH',
        url: `/v1/admin/accounts/${await accountId('ambitious')}/role`,
        headers: worker.headers,
        payload: { role: 'super' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('끈 계정은 등급이 있어도 관문을 지나지 못한다', async () => {
      const boss = await adminSession(test, 'super');
      await create(boss.headers, { loginId: 'shown-out', role: 'operator' });

      const gone = await adminSession(test, null);
      await test.pool.query(
        `UPDATE identity.sessions SET user_id =
           (SELECT user_id FROM structured.admin_accounts WHERE login_id = 'shown-out')
         WHERE user_id = $1`,
        [gone.userId]
      );

      await test.app.inject({
        method: 'PATCH',
        url: `/v1/admin/accounts/${await accountId('shown-out')}/disabled`,
        headers: boss.headers,
        payload: { disabled: true },
      });

      const response = await test.app.inject({
        method: 'GET',
        url: '/v1/admin/audit-log',
        headers: gone.headers,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('꺼진 계정은 다른 길로 되살아나지 않는다', () => {
    it('워크플로가 is_operator를 다시 켜도 꺼진 계정은 못 들어온다', async () => {
      const boss = await adminSession(test, 'super');
      await create(boss.headers, { loginId: 'shut-out', role: 'operator' });

      const shut = await adminSession(test, null);
      await test.pool.query(
        `UPDATE identity.sessions SET user_id =
           (SELECT user_id FROM structured.admin_accounts WHERE login_id = 'shut-out')
         WHERE user_id = $1`,
        [shut.userId]
      );

      await test.app.inject({
        method: 'PATCH',
        url: `/v1/admin/accounts/${await accountId('shut-out')}/disabled`,
        headers: boss.headers,
        payload: { disabled: true },
      });

      /*
       * `admin-operator.yml` · `retention-admin --operator`가 하는 일과 같다 —
       * 콘솔 밖에서 켜는 것이다. 끈 사람은 껐다고 믿고 있어야 한다.
       */
      await test.pool.query(
        `UPDATE structured.users SET is_operator = true WHERE id =
           (SELECT user_id FROM structured.admin_accounts WHERE login_id = 'shut-out')`
      );

      const response = await test.app.inject({
        method: 'GET',
        url: '/v1/admin/audit-log',
        headers: shut.headers,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('감사기록', () => {
    it('생성 · 등급 변경 · 비활성화가 누가 언제 누구에게인지 남는다', async () => {
      const boss = await adminSession(test, 'super');
      await create(boss.headers, { loginId: 'watched', role: 'viewer' });

      const id = await accountId('watched');

      await test.app.inject({
        method: 'PATCH',
        url: `/v1/admin/accounts/${id}/role`,
        headers: boss.headers,
        payload: { role: 'operator' },
      });

      await test.app.inject({
        method: 'PATCH',
        url: `/v1/admin/accounts/${id}/disabled`,
        headers: boss.headers,
        payload: { disabled: true },
      });

      const { rows } = await test.pool.query<{
        step: string;
        decision: string;
        subject_id: string;
        actor_user_id: string;
      }>(
        `SELECT step, decision, subject_id, actor_user_id FROM structured.decisions
         WHERE workflow = 'admin_account' ORDER BY created_at`
      );

      expect(rows).toEqual([
        { step: 'create', decision: 'viewer', subject_id: id, actor_user_id: boss.userId },
        { step: 'grade', decision: 'operator', subject_id: id, actor_user_id: boss.userId },
        { step: 'disable', decision: 'disable', subject_id: id, actor_user_id: boss.userId },
      ]);
    });

    it('감사 기록 화면이 그대로 읽는다 — 새 표를 만들지 않은 값어치가 여기 있다', async () => {
      const boss = await adminSession(test, 'super');
      await create(boss.headers, { loginId: 'watched', role: 'viewer' });

      const response = await test.app.inject({
        method: 'GET',
        url: '/v1/admin/audit-log?workflow=admin_account',
        headers: boss.headers,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json<{ items: unknown[] }>().items).toHaveLength(1);
    });
  });

  describe('환경변수 계정은 부트스트랩 전용', () => {
    beforeEach(() => {
      test.context.config.adminLoginId = 'bootstrap-id';
      test.context.config.adminPasswordHash = hashAdminPassword(PASSWORD);
    });

    async function bootstrapLogin() {
      return await test.app.inject({
        method: 'POST',
        url: '/v1/admin/login',
        payload: { id: 'bootstrap-id', password: PASSWORD },
      });
    }

    it('슈퍼 관리자가 하나도 없으면 들어갈 수 있고 슈퍼로 보인다', async () => {
      const response = await bootstrapLogin();

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ role: 'super' });
    });

    it('들어가도 표에 줄을 만들지 않는다 — 로그인은 권한을 주지 않는다', async () => {
      await bootstrapLogin();

      const { rows } = await test.pool.query('SELECT 1 FROM structured.admin_accounts');

      expect(rows).toHaveLength(0);
    });

    it('그 자리에서 진짜 슈퍼 관리자를 만들 수 있다', async () => {
      const headers = {
        authorization: `Bearer ${(await bootstrapLogin()).json<{ token: string }>().token}`,
      };

      const response = await create(headers, { loginId: 'real-boss', role: 'super' });

      expect(response.statusCode).toBe(201);
    });

    it('슈퍼 관리자가 생기면 환경변수 경로가 닫힌다', async () => {
      const headers = {
        authorization: `Bearer ${(await bootstrapLogin()).json<{ token: string }>().token}`,
      };
      await create(headers, { loginId: 'real-boss', role: 'super' });

      const response = await bootstrapLogin();

      /*
       * 401이다 — 「아이디 또는 비밀번호가 맞지 않아요」. 이 길이 닫혔다는 것을
       * 밖에서 알 수 없어야 한다.
       */
      expect(response.statusCode).toBe(401);
    });

    it('슈퍼 관리자를 전부 끄면 다시 열린다 — 되살릴 길을 남긴다', async () => {
      const headers = {
        authorization: `Bearer ${(await bootstrapLogin()).json<{ token: string }>().token}`,
      };
      await create(headers, { loginId: 'real-boss', role: 'super' });

      /*
       * 라우트로는 마지막 슈퍼를 끌 수 없다(그게 이 설계의 요점이다). 여기서 보는
       * 것은 그 상태에 **어떻게든** 빠졌을 때 되살아나는가이므로, 트리거를 잠시
       * 멈추고 표를 직접 비운다 — 계정을 잃어버린 날과 같은 상태를 만든다.
       */
      await test.pool.query('ALTER TABLE structured.admin_accounts DISABLE TRIGGER admin_accounts_keep_one_super');
      await test.pool.query(`UPDATE structured.admin_accounts SET disabled_at = now()`);
      await test.pool.query('ALTER TABLE structured.admin_accounts ENABLE TRIGGER admin_accounts_keep_one_super');

      const response = await bootstrapLogin();

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ role: 'super' });
    });

    it('환경변수가 없으면 그 길 자체가 없다', async () => {
      test.context.config.adminLoginId = undefined;
      test.context.config.adminPasswordHash = undefined;

      expect((await bootstrapLogin()).statusCode).toBe(401);
    });
  });
});
