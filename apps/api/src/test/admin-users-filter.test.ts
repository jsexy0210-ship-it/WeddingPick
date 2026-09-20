import Fastify from 'fastify';

import type { AppContext } from '../context';
import { registerAdminRoutes } from '../routes/admin';

jest.mock('../auth/plugin', () => ({
  requireOperatorUser: () => async () => undefined,
  currentUserId: () => '00000000-0000-4000-8000-000000000001',
}));

const pool = { query: jest.fn(), connect: jest.fn() };

describe('관리자 앱 회원 목록', () => {
  beforeEach(() => {
    pool.query.mockReset();
    pool.connect.mockReset();
  });

  it('카카오 일반 회원 조건을 합계와 목록에 똑같이 적용한다', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '00000000-0000-4000-8000-000000000002',
            display_name: '카카오회원',
            activated_at: new Date('2026-09-20T00:00:00Z'),
            created_at: new Date('2026-09-20T00:00:00Z'),
            deleted_at: null,
            is_operator: false,
            pick_verified: false,
            provider: 'kakao',
            email: null,
            nickname: '웨픽',
            last_login_at: new Date('2026-09-20T00:00:00Z'),
            withdrawal_status: null,
            failure_message: null,
            failure_attempts: null,
          },
        ],
      });

    const app = Fastify();
    registerAdminRoutes(app, { pool, storage: null } as unknown as AppContext);

    const response = await app.inject({ method: 'GET', url: '/v1/admin/users' });
    const countSql = String(pool.query.mock.calls[0]?.[0]);
    const listSql = String(pool.query.mock.calls[1]?.[0]);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      total: 1,
      users: [{ provider: 'kakao', displayName: '카카오회원', isOperator: false }],
    });

    for (const sql of [countSql, listSql]) {
      expect(sql).toContain('u.is_operator = false');
      expect(sql).toContain('u.deleted_at IS NULL');
      expect(sql).toContain('structured.admin_accounts');
      expect(sql).toContain("app_identity.provider = 'kakao'");
    }
    expect(listSql).toContain("provider = 'kakao'");

    await app.close();
  });
});
