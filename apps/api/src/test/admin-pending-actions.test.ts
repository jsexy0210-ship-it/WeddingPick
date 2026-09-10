import Fastify from 'fastify';
import type { Pool } from 'pg';
import { DISCLOSURE_THRESHOLDS } from '@weddingpick/domain';
import { policyRules, setPolicyRules } from '../admin-ops';
import type { AppContext } from '../context';
import { ApiError } from '../errors';
import { registerAdminRoutes } from '../routes/admin';

// 권한은 기존 DB 통합시험에서 검사한다. 여기서는 운영자도 미연결 기능을 쓸 수 없는지 본다.
jest.mock('../auth/plugin', () => ({
  requireOperatorUser: () => async () => undefined,
  currentUserId: () => '00000000-0000-4000-8000-000000000001',
}));

const pool = { query: jest.fn(), connect: jest.fn() };

it.each(['public_stage.stage1_min', 'public_stage.stage2_min', 'public_stage.stage3_min'])(
  '%s는 일반 규칙과 섞어 보내도 DB 쓰기 전에 거부한다', async (key) => {
    await expect(setPolicyRules(pool as unknown as Pool, [
      { key: 'automation.dlq_alert_size', value: '20' }, { key, value: '99' },
    ], 'operator')).rejects.toMatchObject({ code: 'invalid_request' });
    expect(pool.connect).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  },
);

it('공개 규칙은 DB에 다른 값이 남아 있어도 실제 공개 기준과 조회 제한을 표시한다', async () => {
  pool.query.mockResolvedValue({ rows: [{
    id: 'public_stage.stage1_min', key: 'public_stage.stage1_min', label: '공개 기준',
    description: '공개 기준', category: '공개', kind: 'number', value: '99', default_value: '99',
    last_changed_at: null, changed_by_name: null,
  }] });
  const data = await policyRules(pool as unknown as Pool);
  expect(data.policies[0]).toMatchObject({
    value: String(DISCLOSURE_THRESHOLDS.limited), readOnlyReason: expect.any(String),
  });
});

it.each([
  { method: 'POST' as const, url: '/v1/admin/terms' },
  { method: 'PUT' as const, url: '/v1/admin/terms/terms/clauses/00000000-0000-4000-8000-000000000002' },
  { method: 'POST' as const, url: '/v1/admin/terms/terms/publish' },
])('$method $url은 약관 연결 전 성공 응답이나 DB 변경을 만들지 않는다', async (request) => {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) return reply.status(error.status).send(error.toResponse());
    throw error;
  });
  registerAdminRoutes(app, { pool } as unknown as AppContext);
  try {
    const response = await app.inject(request);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { message: expect.stringContaining('연결 전') } });
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.connect).not.toHaveBeenCalled();
  } finally {
    await app.close();
  }
});
