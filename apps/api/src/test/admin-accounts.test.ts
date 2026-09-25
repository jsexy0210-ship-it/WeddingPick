import { hashAdminPassword } from '../auth/admin-password';
import { adminSession, createTestApp, resetDatabase, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/* 시험이 끝나면 되돌린다 — 전역을 건드리므로 다음 파일에 새어 나가면 안 된다. */
const savedEnv = { id: process.env.ADMIN_LOGIN_ID, hash: process.env.ADMIN_PASSWORD_HASH };

/** 4자 이상이어야 한다(라우트 규칙). 시험용 값이고 어디에도 저장되지 않는다. */
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
    process.env.ADMIN_LOGIN_ID = savedEnv.id;
    process.env.ADMIN_PASSWORD_HASH = savedEnv.hash;
  });

  beforeEach(async () => {
    await resetDatabase();
    delete process.env.ADMIN_LOGIN_ID;
    delete process.env.ADMIN_PASSWORD_HASH;
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
        password: 'abc',
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
      process.env.ADMIN_LOGIN_ID = 'bootstrap-id';
      process.env.ADMIN_PASSWORD_HASH = hashAdminPassword(PASSWORD);
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
      delete process.env.ADMIN_LOGIN_ID;
      delete process.env.ADMIN_PASSWORD_HASH;

      expect((await bootstrapLogin()).statusCode).toBe(401);
    });
  });

  /*
   * 2026-09-15 대표 지시 — 부트스트랩 계정(`jsexy0210` 등)이 「진짜 저장된 슈퍼」가
   * 되는 길. 같은 아이디로 이미 로그인한 적이 있으면 `identity.identities`에
   * (provider='admin', subject=그 아이디) 줄이 이미 있다 — 그 신원을 무시하고 새
   * 사람을 만들면 유일 키에 걸려 죽는다.
   */
  describe('이미 로그인한 적 있는 아이디로 진짜 계정을 만들 때', () => {
    it('있는 신원을 그대로 쓴다 — 새 사람을 만들지 않는다', async () => {
      const boss = await adminSession(test, 'super');

      /* 부트스트랩으로 이미 한 번 로그인해 신원만 생긴 상태를 흉내낸다. */
      const { rows: existing } = await test.pool.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );
      const existingUserId = existing[0]!.id;
      await test.pool.query(
        `INSERT INTO identity.identities (user_id, provider, subject) VALUES ($1, 'admin', 'already-seen')`,
        [existingUserId]
      );

      const response = await create(boss.headers, { loginId: 'already-seen', role: 'super' });

      expect(response.statusCode).toBe(201);

      const { rows } = await test.pool.query<{ user_id: string }>(
        `SELECT user_id FROM structured.admin_accounts WHERE login_id = 'already-seen'`
      );
      expect(rows[0]!.user_id).toBe(existingUserId);

      /* identities에 중복 줄이 생기지 않았다 — 유일 키를 두 번 건드리지 않는다. */
      const { rows: identities } = await test.pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM identity.identities
         WHERE provider = 'admin' AND subject = 'already-seen'`
      );
      expect(identities[0]!.n).toBe('1');
    });

    it('그 신원으로 진짜 슈퍼 관리자를 만든 뒤 실제로 로그인된다', async () => {
      const boss = await adminSession(test, 'super');

      const { rows: existing } = await test.pool.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );
      await test.pool.query(
        `INSERT INTO identity.identities (user_id, provider, subject) VALUES ($1, 'admin', 'promoted-boss')`,
        [existing[0]!.id]
      );
      await create(boss.headers, { loginId: 'promoted-boss', role: 'super' });

      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/admin/login',
        payload: { id: 'promoted-boss', password: PASSWORD },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ role: 'super' });
    });

    it('그 아이디가 이미 다른 관리자 계정과 연결돼 있으면 거절한다', async () => {
      const boss = await adminSession(test, 'super');
      await create(boss.headers, { loginId: 'has-account', role: 'operator' });

      const { rows: acc } = await test.pool.query<{ user_id: string }>(
        `SELECT user_id FROM structured.admin_accounts WHERE login_id = 'has-account'`
      );
      /* 같은 사람에게 다른 아이디로도 로그인 신원이 하나 더 붙은 상태를 만든다. */
      await test.pool.query(
        `INSERT INTO identity.identities (user_id, provider, subject) VALUES ($1, 'admin', 'second-name')`,
        [acc[0]!.user_id]
      );

      const response = await create(boss.headers, { loginId: 'second-name', role: 'viewer' });

      expect(response.statusCode).toBe(409);
    });
  });

  /*
   * 2026-09-15 대표 지시 — 「나머지 계정은 싹다 테스트(조회만 가능)으로 변경해」.
   * 한 번에 여러 계정을 뷰어로 내리는 길.
   */
  describe('나머지 전체를 뷰어로', () => {
    async function demoteOthers(headers: Record<string, string>) {
      return await test.app.inject({ method: 'POST', url: '/v1/admin/accounts/demote-others', headers });
    }

    it('내 계정만 남기고 나머지를 뷰어로 내린다', async () => {
      const boss = await adminSession(test, 'super');
      await create(boss.headers, { loginId: 'other-super', role: 'super' });
      await create(boss.headers, { loginId: 'op-1', role: 'operator' });
      await create(boss.headers, { loginId: 'viewer-1', role: 'viewer' });

      const response = await demoteOthers(boss.headers);

      expect(response.statusCode).toBe(200);
      expect(response.json<{ changed: string[] }>().changed.sort()).toEqual(['op-1', 'other-super']);

      const { rows } = await test.pool.query<{ login_id: string; role: string }>(
        `SELECT login_id, role FROM structured.admin_accounts ORDER BY login_id`
      );
      expect(rows).toEqual([
        { login_id: 'admin-super', role: 'super' },
        { login_id: 'op-1', role: 'viewer' },
        { login_id: 'other-super', role: 'viewer' },
        { login_id: 'viewer-1', role: 'viewer' },
      ]);
    });

    it('꺼진 계정과 이미 뷰어인 계정은 건드리지 않는다', async () => {
      const boss = await adminSession(test, 'super');
      await create(boss.headers, { loginId: 'op-2', role: 'operator' });
      await test.app.inject({
        method: 'PATCH',
        url: `/v1/admin/accounts/${await accountId('op-2')}/disabled`,
        headers: boss.headers,
        payload: { disabled: true },
      });

      const response = await demoteOthers(boss.headers);

      expect(response.statusCode).toBe(200);
      expect(response.json<{ changed: string[] }>().changed).toEqual([]);

      const { rows } = await test.pool.query<{ role: string; disabled_at: Date | null }>(
        `SELECT role, disabled_at FROM structured.admin_accounts WHERE login_id = 'op-2'`
      );
      expect(rows[0]!.role).toBe('operator');
      expect(rows[0]!.disabled_at).not.toBeNull();
    });

    it('감사 기록에 남는다', async () => {
      const boss = await adminSession(test, 'super');
      await create(boss.headers, { loginId: 'op-3', role: 'operator' });

      await demoteOthers(boss.headers);

      const { rows } = await test.pool.query<{ step: string; decision: string }>(
        `SELECT step, decision FROM structured.decisions
         WHERE workflow = 'admin_account' AND subject_id = (SELECT id FROM structured.admin_accounts WHERE login_id = 'op-3')
         ORDER BY created_at DESC LIMIT 1`
      );
      expect(rows[0]).toEqual({ step: 'grade', decision: 'viewer' });
    });

    it('부트스트랩 계정(표에 저장된 슈퍼가 없음)은 친절하게 막는다', async () => {
      process.env.ADMIN_LOGIN_ID = 'bootstrap-id';
      process.env.ADMIN_PASSWORD_HASH = hashAdminPassword(PASSWORD);

      const login = await test.app.inject({
        method: 'POST',
        url: '/v1/admin/login',
        payload: { id: 'bootstrap-id', password: PASSWORD },
      });
      const headers = { authorization: `Bearer ${login.json<{ token: string }>().token}` };

      const response = await demoteOthers(headers);

      expect(response.statusCode).toBe(409);
      expect(response.json<{ error: { message: string } }>().error.message).toContain('관리자 추가');
    });
  });

  describe('계정 지우기', () => {
    async function remove(headers: Record<string, string>, id: string) {
      return await test.app.inject({ method: 'DELETE', url: `/v1/admin/accounts/${id}`, headers });
    }

    it('슈퍼 관리자가 뷰어 계정을 지우면 그 아이디로 더는 로그인되지 않는다', async () => {
      const boss = await adminSession(test, 'super');
      await create(boss.headers, { loginId: 'to-remove', role: 'viewer' });

      const response = await remove(boss.headers, await accountId('to-remove'));

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ deleted: 'to-remove' });

      const login = await test.app.inject({
        method: 'POST',
        url: '/v1/admin/login',
        payload: { id: 'to-remove', password: PASSWORD },
      });
      expect(login.statusCode).not.toBe(201);

      const { rows } = await test.pool.query<{ step: string }>(
        `SELECT step FROM structured.decisions WHERE workflow = 'admin_account' AND step = 'delete'`
      );
      expect(rows).toHaveLength(1);
    });

    it('슈퍼 관리자 계정은 지울 수 없다', async () => {
      const boss = await adminSession(test, 'super');
      await create(boss.headers, { loginId: 'other-boss', role: 'super' });

      const response = await remove(boss.headers, await accountId('other-boss'));

      expect(response.statusCode).toBe(403);
    });

    it('표에 저장된 슈퍼가 없어도(부트스트랩) 뷰어 계정은 지울 수 있다 — 0434', async () => {
      process.env.ADMIN_LOGIN_ID = 'bootstrap-id';
      process.env.ADMIN_PASSWORD_HASH = hashAdminPassword(PASSWORD);
      const login = await test.app.inject({
        method: 'POST',
        url: '/v1/admin/login',
        payload: { id: 'bootstrap-id', password: PASSWORD },
      });
      const headers = { authorization: `Bearer ${login.json<{ token: string }>().token}` };
      await create(headers, { loginId: 'old-viewer', role: 'viewer' });

      const response = await remove(headers, await accountId('old-viewer'));

      expect(response.statusCode).toBe(200);
    });
  });
});
