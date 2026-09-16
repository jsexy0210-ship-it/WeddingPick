import { adminSession, createTestApp, fakeProvider, resetDatabase, signInAs, type TestApp } from './helpers';
import { signIn } from '../auth/sessions';

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
describeWithDb('관리자 개별 권한·삭제와 회원 정지', () => {
  let test: TestApp;
  let owner: Awaited<ReturnType<typeof adminSession>>;
  beforeAll(async () => { await resetDatabase(); test = await createTestApp(); });
  beforeEach(async () => { await resetDatabase(); owner = await adminSession(test, 'super'); });
  afterAll(async () => { await test?.close(); });

  async function createOperator(canEdit = true, canDelete = false) {
    const response = await test.app.inject({ method: 'POST', url: '/v1/admin/accounts', headers: owner.headers,
      payload: { loginId: 'permissions-test', password: 'test-password-long', role: 'operator', canEdit, canDelete } });
    expect(response.statusCode).toBe(201);
    const login = await test.app.inject({ method: 'POST', url: '/v1/admin/login', payload: { id: 'permissions-test', password: 'test-password-long' } });
    expect(login.statusCode).toBe(201);
    return { id: response.json().id as string, headers: { authorization: `Bearer ${login.json().token}` } };
  }

  it('삭제권한 없는 운영자는 회원 탈퇴가 막히고 권한 변경은 기존 세션에 반영된다', async () => {
    const editor = await createOperator();
    const member = await signInAs(test);
    const url = `/v1/admin/users/${member.userId}/%77ithdraw`;
    expect((await test.app.inject({ method: 'POST', url, headers: editor.headers, payload: { reason: '검증' } })).statusCode).toBe(403);
    expect((await test.app.inject({ method: 'PATCH', url: `/v1/admin/accounts/${editor.id}/permissions`, headers: owner.headers, payload: { canEdit: false, canDelete: true } })).statusCode).toBe(200);
    const access = await test.app.inject({ method: 'GET', url: '/v1/admin/access', headers: editor.headers });
    expect(access.json()).toMatchObject({ canEdit: false, canDelete: true });
    expect((await test.app.inject({ method: 'POST', url: `/v1/admin/users/${member.userId}/suspend`, headers: editor.headers, payload: { reason: '검증' } })).statusCode).toBe(403);
    expect((await test.app.inject({ method: 'POST', url, headers: editor.headers, payload: { reason: '검증' } })).statusCode).toBe(200);
  });

  it('관리자 정지는 세션과 로그인을 막고 해제 후 다시 로그인할 수 있다', async () => {
    const editor = await createOperator();
    expect((await test.app.inject({ method: 'PATCH', url: `/v1/admin/accounts/${editor.id}/disabled`, headers: owner.headers, payload: { disabled: true } })).statusCode).toBe(200);
    expect((await test.app.inject({ method: 'GET', url: '/v1/admin/access', headers: editor.headers })).statusCode).toBe(401);
    expect((await test.app.inject({ method: 'POST', url: '/v1/admin/login', payload: { id: 'permissions-test', password: 'test-password-long' } })).statusCode).toBe(401);
    expect((await test.app.inject({ method: 'PATCH', url: `/v1/admin/accounts/${editor.id}/disabled`, headers: owner.headers, payload: { disabled: false } })).statusCode).toBe(200);
    expect((await test.app.inject({ method: 'POST', url: '/v1/admin/login', payload: { id: 'permissions-test', password: 'test-password-long' } })).statusCode).toBe(201);
  });

  it('관리자 삭제는 되돌릴 수 없고 목록·세션·로그인에서 제외된다', async () => {
    const editor = await createOperator();
    expect((await test.app.inject({ method: 'DELETE', url: `/v1/admin/accounts/${editor.id}`, headers: owner.headers })).statusCode).toBe(200);
    const list = await test.app.inject({ method: 'GET', url: '/v1/admin/accounts', headers: owner.headers });
    expect(list.json().accounts.some((row: { id: string }) => row.id === editor.id)).toBe(false);
    expect((await test.app.inject({ method: 'GET', url: '/v1/admin/access', headers: editor.headers })).statusCode).toBe(401);
    expect((await test.app.inject({ method: 'POST', url: '/v1/admin/login', payload: { id: 'permissions-test', password: 'test-password-long' } })).statusCode).toBe(401);
    expect((await test.app.inject({ method: 'PATCH', url: `/v1/admin/accounts/${editor.id}/disabled`, headers: owner.headers, payload: { disabled: false } })).statusCode).toBe(404);
    expect((await test.pool.query('SELECT 1 FROM structured.decisions WHERE subject_id = $1 AND step = $2', [editor.id, 'delete'])).rowCount).toBe(1);
  });

  it('슈퍼 관리자의 삭제와 개별 권한 변경은 거부한다', async () => {
    const listed = await test.app.inject({ method: 'GET', url: '/v1/admin/accounts', headers: owner.headers });
    const id = listed.json().accounts.find((row: { role: string }) => row.role === 'super').id;
    expect((await test.app.inject({ method: 'DELETE', url: `/v1/admin/accounts/${id}`, headers: owner.headers })).statusCode).toBe(403);
    expect((await test.app.inject({ method: 'PATCH', url: `/v1/admin/accounts/${id}/permissions`, headers: owner.headers, payload: { canEdit: false, canDelete: false } })).statusCode).toBe(403);
  });

  it.each(['apple', 'kakao'] as const)('%s 회원 정지는 기존 세션·재로그인을 막고 해제하면 새 로그인만 허용한다', async (provider) => {
    const member = await signInAs(test, 'suspended-member');
    if (provider === 'kakao') {
      await test.pool.query("INSERT INTO identity.identities (user_id, provider, subject) VALUES ($1, 'kakao', 'suspended-member')", [member.userId]);
    }
    test.context.providers[provider] = provider === 'kakao'
      ? { flow: 'authorization_code', verify: async () => ({ provider, subject: 'suspended-member', profile: { ageRange: '30~39' } }) }
      : fakeProvider({ provider, subject: 'suspended-member' });
    const loginPayload = provider === 'kakao'
      ? { provider, authorizationCode: 'test-auth-code', state: 'test-state', redirectUri: 'weddingpick://auth/callback', codeVerifier: 'x'.repeat(43) }
      : { provider, idToken: 'test-identity-token' };
    expect((await test.app.inject({ method: 'POST', url: `/v1/admin/users/${member.userId}/suspend`, headers: owner.headers, payload: { reason: '운영 확인' } })).statusCode).toBe(200);
    expect((await test.app.inject({ method: 'GET', url: '/v1/me/settings', headers: member.headers })).statusCode).toBe(401);
    await expect(signIn(test.pool, { provider, subject: 'suspended-member' }, 1)).rejects.toThrow('정지');
    expect((await test.app.inject({ method: 'POST', url: '/v1/auth/sessions', payload: loginPayload })).statusCode).toBe(403);
    expect((await test.app.inject({ method: 'POST', url: `/v1/admin/users/${member.userId}/resume`, headers: owner.headers, payload: { reason: '확인 완료' } })).statusCode).toBe(200);
    expect((await test.app.inject({ method: 'GET', url: '/v1/me/settings', headers: member.headers })).statusCode).toBe(401);
    await expect(signIn(test.pool, { provider, subject: 'suspended-member' }, 1)).resolves.toHaveProperty('token');
    expect((await test.app.inject({ method: 'POST', url: '/v1/auth/sessions', payload: loginPayload })).statusCode).toBe(201);
  });

  it('회원 경로를 통한 관리자 정지 우회를 차단한다', async () => {
    const viewer = await adminSession(test, 'viewer');
    expect((await test.app.inject({ method: 'POST', url: `/v1/admin/users/${viewer.userId}/suspend`, headers: owner.headers, payload: { reason: '우회' } })).statusCode).toBe(403);
  });
});
