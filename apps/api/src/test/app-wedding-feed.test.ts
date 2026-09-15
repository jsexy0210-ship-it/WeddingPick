import Fastify from 'fastify';
import type { Pool } from 'pg';

import type { AppContext } from '../context';
import { registerAppRoutes } from '../routes/app';

/**
 * 홈이 부르는 공개 웨딩피드 라우트.
 *
 * MASTER 지시(2026-09-15) — 홈은 있는데 `listPublished`를 부르는 라우트가
 * 어디에도 없었다. 여기서 실제로 표를 읽는지, 공개된 것만 나가는지, 로그인
 * 없이도 되는지를 본다. 권한·부팅 통합은 `app-bootstrap.test.ts`가 DB로 본다.
 */
const pool = { query: jest.fn(), connect: jest.fn() };

function app() {
  const instance = Fastify();

  registerAppRoutes(instance, { pool, storage: null } as unknown as AppContext);

  return instance;
}

beforeEach(() => {
  pool.query.mockReset();
});

describe('공개 웨딩피드', () => {
  it('로그인 없이 공개된 글만 받는다', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: '00000000-0000-4000-8000-0000000000f1',
          category_label: '예산',
          title: '스드메 예산 짜는 법',
          summary: '요약',
          body: '본문',
          image_key: null,
          status: 'published',
          source: 'manual',
          model: null,
          topic: null,
          sort_order: 0,
          published_at: new Date('2026-09-14T00:00:00Z'),
          created_at: new Date('2026-09-14T00:00:00Z'),
          updated_at: new Date('2026-09-14T00:00:00Z'),
        },
      ],
    });

    const response = await app().inject({ method: 'GET', url: '/v1/wedding-feed' });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ items: { id: string; title: string }[] }>();

    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ title: '스드메 예산 짜는 법' });
    expect(pool.query.mock.calls[0]?.[0]).toContain("status = 'published'");
  });

  it('limit을 물으면 표에 그대로 넘긴다', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const response = await app().inject({ method: 'GET', url: '/v1/wedding-feed?limit=2' });

    expect(response.statusCode).toBe(200);
    expect(pool.query.mock.calls[0]?.[1]).toEqual([2]);
  });

  it('이상한 limit은 기본값(8)으로 대신한다', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const response = await app().inject({ method: 'GET', url: '/v1/wedding-feed?limit=abc' });

    expect(response.statusCode).toBe(200);
    expect(pool.query.mock.calls[0]?.[1]).toEqual([8]);
  });
});
