import Fastify from 'fastify';
import type { AppContext } from '../context';
import { ApiError } from '../errors';
import { resolveAdmin, type ResolvedAdmin } from '../auth/admin-role';
import { requireOperatorUser } from '../auth/plugin';
import { resolveSession } from '../auth/sessions';

jest.mock('../auth/sessions', () => ({ resolveSession: jest.fn() }));
jest.mock('../auth/admin-role', () => ({ ...jest.requireActual('../auth/admin-role'), resolveAdmin: jest.fn() }));

describe('관리자 개별 권한과 인코딩 경로', () => {
  const app = Fastify();
  const reached = jest.fn();
  const headers = { authorization: 'Bearer test-admin' };
  const destructive = ['withdraw', 'delete', 'remove', 'dispose', 'redact', 'sweep', 'collect-unreachable'];

  beforeAll(async () => {
    app.setErrorHandler((error, _request, reply) => error instanceof ApiError
      ? reply.code(error.status).send(error.toResponse()) : reply.send(error));
    const preHandler = requireOperatorUser({} as AppContext);
    for (const route of [...destructive.map((action) => `/v1/admin/users/:id/${action}`),
      '/v1/admin/users/:id/suspend', '/v1/admin/withdrawals/:id/retry', '/v1/admin/inquiries/:id/answer']) {
      app.post(route, { preHandler }, async () => { reached(); return { ok: true }; });
    }
    app.get('/v1/admin/users', { preHandler }, async () => ({ ok: true }));
    app.delete('/v1/admin/faq/:id', { preHandler }, async () => { reached(); return { ok: true }; });
    await app.ready();
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    jest.mocked(resolveSession).mockResolvedValue({ userId: 'test-user', activated: true });
    jest.mocked(resolveAdmin).mockResolvedValue({ role: 'operator', stored: true, canEdit: true, canDelete: false });
  });

  it.each(destructive)('삭제권한 없이는 %s의 인코딩 URL도 실행되지 않는다', async (action) => {
    for (const part of [action, `%${action.charCodeAt(0).toString(16)}${action.slice(1)}`]) {
      expect((await app.inject({ method: 'POST', url: `/v1/admin/users/target/${part}?test=1`, headers })).statusCode).toBe(403);
    }
    expect(reached).not.toHaveBeenCalled();
  });

  it('재파기와 문의 답변 안의 플래너 삭제에도 삭제 권한이 필요하다', async () => {
    expect((await app.inject({ method: 'POST', url: '/v1/admin/withdrawals/target/%72etry', headers })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/v1/admin/inquiries/target/%61nswer', headers, payload: { withdrawPlanner: true } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'DELETE', url: '/v1/admin/faq/target', headers })).statusCode).toBe(403);
    expect(reached).not.toHaveBeenCalled();
  });

  it.each([
    [{ role: 'viewer', canEdit: true, canDelete: true }, 403, 403],
    [{ role: 'operator', canEdit: true, canDelete: false }, 200, 403],
    [{ role: 'operator', canEdit: false, canDelete: true }, 403, 200],
    [{ role: 'operator', canEdit: false, canDelete: false }, 403, 403],
    [{ role: 'super', canEdit: false, canDelete: false }, 200, 200],
  ] as const)('역할과 개별 권한 %j', async (permissions, editStatus, deleteStatus) => {
    jest.mocked(resolveAdmin).mockResolvedValue({ ...permissions, stored: true } as ResolvedAdmin);
    expect((await app.inject({ method: 'GET', url: '/v1/admin/users', headers })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/v1/admin/users/target/suspend', headers })).statusCode).toBe(editStatus);
    expect((await app.inject({ method: 'POST', url: '/v1/admin/users/target/%77ithdraw', headers })).statusCode).toBe(deleteStatus);
  });
});
