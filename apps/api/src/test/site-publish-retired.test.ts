import Fastify from 'fastify';
import type { AppContext } from '../context';
import { ApiError } from '../errors';
import { registerSiteMetaRoutes } from '../routes/site-meta';
import * as siteMeta from '../site-meta';

const mockAuthorize = jest.fn(async () => undefined);
jest.mock('../auth/plugin', () => ({
  requireOperatorUser: () => () => mockAuthorize(),
  currentUserId: () => '00000000-0000-4000-8000-000000000001',
}));
jest.mock('../site-meta', () => ({
  save: jest.fn(),
  markPublishRequested: jest.fn(),
}));

const pool = { query: jest.fn(), connect: jest.fn() };

function buildApp() {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) return reply.status(error.status).send(error.toResponse());
    throw error;
  });
  registerSiteMetaRoutes(app, { pool } as unknown as AppContext);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthorize.mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

test('폐기된 배포 요청은 외부 호출이나 DB 변경 없이 명시적으로 거부한다', async () => {
  const app = buildApp();
  const request = jest.spyOn(globalThis, 'fetch');
  try {
    const response = await app.inject({ method: 'POST', url: '/v1/admin/site-meta/publish' });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: { code: 'conflict', details: { reason: 'deployment_retired' } },
    });
    expect(request).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
    expect(siteMeta.markPublishRequested).not.toHaveBeenCalled();
  } finally {
    await app.close();
  }
});

test('폐기된 경로도 기존 관리자 인증을 거친다', async () => {
  const app = buildApp();
  mockAuthorize.mockRejectedValueOnce(new ApiError('unauthenticated', '로그인이 필요합니다.'));
  try {
    const response = await app.inject({ method: 'POST', url: '/v1/admin/site-meta/publish' });
    expect(response.statusCode).toBe(401);
    expect(siteMeta.markPublishRequested).not.toHaveBeenCalled();
  } finally {
    await app.close();
  }
});

test('배포 통로를 제거해도 설정 저장은 유지한다', async () => {
  const app = buildApp();
  jest.mocked(siteMeta.save).mockResolvedValueOnce({ updatedAt: '2026-09-18T00:00:00Z' } as Awaited<ReturnType<typeof siteMeta.save>>);
  try {
    const response = await app.inject({
      method: 'PUT', url: '/v1/admin/site-meta', payload: { ogTitle: '웨딩픽' },
    });
    expect(response.statusCode).toBe(200);
    expect(siteMeta.save).toHaveBeenCalledWith(pool, { ogTitle: '웨딩픽' }, expect.any(String), expect.any(String));
    expect(siteMeta.markPublishRequested).not.toHaveBeenCalled();
  } finally {
    await app.close();
  }
});
