import { hashAdminPassword } from '../auth/admin-password';

import { createTestApp, resetDatabase, type TestApp } from './helpers';

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

const ID = 'admin-test-id';
const PASSWORD = '열글자넘는비밀번호1234';

/*
 * **환경을 모듈 맨 위에서 심는다.** 로그인은 `context.config`에서 부트스트랩 자격을
 * 읽고, 그 config는 앱을 만들 때 한 번 굳는다(#173 관리자 등급). 훅 안에서 심으면
 * 이미 늦어서 아이디가 비고, 로그인이 401로 떨어진다 — 「비밀번호가 틀렸다」와 같은
 * 응답이라 원인이 안 보인다.
 */
process.env.ADMIN_LOGIN_ID = ID;
process.env.ADMIN_PASSWORD_HASH = hashAdminPassword(PASSWORD);

/**
 * 관리자 로그인.
 *
 * **들어갔다가 튕겨 나오던 것을 막는다.** `requireOperatorUser`는 권한을 보기 전에
 * `activated`를 먼저 보고, 그 값은 `structured.active_users` 뷰가 정한다. 뷰는
 * `activated_at IS NOT NULL`인 사람만 담는데 그 시각은 **소비자가 가입 동의를 끝낼 때**
 * 찍힌다. 관리자는 그 절차를 거치지 않는다.
 *
 * 그래서 로그인은 되고(로그인은 `is_operator`만 본다) 관리자 API는 전부 403이 됐다.
 * 화면은 그 403을 「다시 로그인」으로 읽어 로그인으로 되돌렸다 — 사용자에게는
 * 「진입했다가 다시 돌아온다」로 보였다(2026-09-10).
 *
 * 로그인이 활성 표시를 남기는지, 그리고 그 상태로 관리자 API가 실제로 열리는지를
 * 함께 본다. 앞의 것만 보면 뷰나 제약이 바뀌었을 때 조용히 통과한다.
 */
describeWithDb('관리자 로그인', () => {
  let test: TestApp;
  const saved = { id: process.env.ADMIN_LOGIN_ID, hash: process.env.ADMIN_PASSWORD_HASH };

  /*
   * **앱을 만들기 전에 환경을 심는다.** 로그인은 이제 `context.config`에서 부트스트랩
   * 자격을 읽고, 그 config는 앱을 만들 때 한 번 굳는다(#173 관리자 등급). 예전처럼
   * 매 요청 `process.env`를 읽지 않으므로, `beforeEach`에서 심으면 이미 늦다 —
   * 아이디가 비어 있어 로그인이 401로 떨어진다.
   */
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
    process.env.ADMIN_LOGIN_ID = saved.id;
    process.env.ADMIN_PASSWORD_HASH = saved.hash;
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  async function login() {
    return await test.app.inject({
      method: 'POST',
      url: '/v1/admin/login',
      payload: { id: ID, password: PASSWORD },
    });
  }

  it('첫 로그인은 계정을 만들고 활성으로 표시한다', async () => {
    /*
     * **0102 전에는 여기가 403이었다.** 첫 로그인이 계정만 만들고 돌아왔고, 운영
     * 권한은 CLI로만 켤 수 있었다. 그러면 **서버 셸에 못 들어가는 사람은 만들어 놓은
     * 콘솔에 영영 못 들어간다.**
     *
     * 이제 `structured.admin_accounts`에 켜져 있는 슈퍼 관리자가 하나도 없는 동안에만
     * 이 환경변수 계정이 슈퍼 관리자로 보인다(부트스트랩 전용 · 2026-09-10 결정 · #173).
     * 하나 생기면 곧바로 닫히고(`bootstrapCandidate`), `admin-accounts.test.ts`가
     * 그것을 본다.
     *
     * **이 시험이 지키는 것은 그대로다** — 활성 표시가 남는가. 그것이 없으면 관문이
     * 「가입이 끝나지 않았다」며 돌려보내 콘솔에 아무도 못 들어간다(#175).
     */
    const first = await login();

    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ role: 'super' });

    const { rows } = await test.pool.query<{ activated: boolean }>(
      `SELECT (a.id IS NOT NULL) AS activated
         FROM structured.users u
         LEFT JOIN structured.active_users a ON a.id = u.id
        WHERE u.id = (SELECT user_id FROM identity.identities WHERE provider = 'admin')`
    );

    expect(rows[0]?.activated).toBe(true);
  });

  it('운영 권한을 켠 뒤에는 관리자 API가 열린다', async () => {
    await login();

    await test.pool.query(
      `UPDATE structured.users SET is_operator = true
        WHERE id = (SELECT user_id FROM identity.identities WHERE provider = 'admin')`
    );

    const second = await login();

    expect(second.statusCode).toBe(201);

    const token = (second.json() as { token: string }).token;

    /*
     * 여기가 실제로 막혔던 자리다. 로그인만 보고 「됐다」로 적으면 이 시험은
     * 통과하면서 화면은 계속 튕겨 나온다.
     */
    const listed = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/verifications',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(listed.statusCode).toBe(200);
  });

  it('다시 로그인해도 가입 시각이 밀리지 않는다', async () => {
    await login();

    const before = await test.pool.query<{ activated_at: Date }>(
      `SELECT activated_at FROM structured.users
        WHERE id = (SELECT user_id FROM identity.identities WHERE provider = 'admin')`
    );

    await login();

    const after = await test.pool.query<{ activated_at: Date }>(
      `SELECT activated_at FROM structured.users
        WHERE id = (SELECT user_id FROM identity.identities WHERE provider = 'admin')`
    );

    expect(after.rows[0]?.activated_at).toEqual(before.rows[0]?.activated_at);
  });
});
