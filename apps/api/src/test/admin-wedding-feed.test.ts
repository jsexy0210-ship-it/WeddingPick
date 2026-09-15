import Fastify from 'fastify';
import type { Pool } from 'pg';

import type { AppContext } from '../context';
import { ApiError } from '../errors';
import { registerAdminRoutes } from '../routes/admin';

/**
 * 웨딩피드 관리자 라우트.
 *
 * **왜 이 시험이 있나.** GET 핸들러가 한동안 `weddingFeed.listForAdmin`이 이미
 * 돌려주는 `{ posts, runs, remainingTopics }`를 `posts` 키 하나에 다시 감싸서
 * 내보냈다 — 실제 글 배열이 `posts.posts`에 들어 있었다. 화면이 아직 없어서
 * 아무도 겪지 않은 버그였다. 응답 모양을 계약(`adminWeddingFeedResponseSchema`)
 * 대로 그대로 본다 — 200인지가 아니라 무엇을 돌려주는지를 본다.
 */
jest.mock('../auth/plugin', () => ({
  requireOperatorUser: () => async () => undefined,
  currentUserId: () => '00000000-0000-4000-8000-000000000001',
}));

const pool = { query: jest.fn(), connect: jest.fn() };

function app(context?: Partial<AppContext>) {
  const instance = Fastify();

  instance.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) return reply.status(error.status).send(error.toResponse());
    throw error;
  });
  registerAdminRoutes(instance, { pool, storage: null, ...context } as unknown as AppContext);

  return instance;
}

beforeEach(() => {
  pool.query.mockReset();
  pool.connect.mockReset();
});

describe('웨딩피드 관리자 라우트', () => {
  it('목록은 posts · runs · remainingTopics를 그대로 준다 — posts 안에 다시 감싸지 않는다', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: '00000000-0000-4000-8000-0000000000aa',
            category_label: '예산',
            title: '스드메 예산 짜는 법',
            summary: '요약',
            body: '본문',
            image_key: null,
            status: 'draft',
            source: 'manual',
            model: null,
            topic: null,
            sort_order: 0,
            published_at: null,
            created_at: new Date('2026-09-15T00:00:00Z'),
            updated_at: new Date('2026-09-15T00:00:00Z'),
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const response = await app().inject({ method: 'GET', url: '/v1/admin/wedding-feed' });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ posts: unknown[]; runs: unknown[]; remainingTopics: number }>();

    expect(Array.isArray(body.posts)).toBe(true);
    expect(body.posts).toHaveLength(1);
    expect(body.posts[0]).toMatchObject({ title: '스드메 예산 짜는 법', status: 'draft' });
    expect(Array.isArray(body.runs)).toBe(true);
    expect(typeof body.remainingTopics).toBe('number');
  });

  it('등록은 표에 INSERT한다', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: '00000000-0000-4000-8000-0000000000bb' }] });

    const response = await app().inject({
      method: 'POST',
      url: '/v1/admin/wedding-feed',
      payload: { categoryLabel: '예산', title: '제목', summary: '', body: '', status: 'draft', sortOrder: 0 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: '00000000-0000-4000-8000-0000000000bb' });
    expect(pool.query.mock.calls[0]?.[0]).toContain('INSERT INTO structured.wedding_feed_posts');
  });

  it('제목이 비면 DB를 건드리기 전에 거부한다', async () => {
    const response = await app().inject({
      method: 'POST',
      url: '/v1/admin/wedding-feed',
      payload: { categoryLabel: '예산', title: '', summary: '', body: '', status: 'draft', sortOrder: 0 },
    });

    expect(response.statusCode).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('수정은 표를 UPDATE한다', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });

    const response = await app().inject({
      method: 'PUT',
      url: '/v1/admin/wedding-feed/00000000-0000-4000-8000-0000000000aa',
      payload: { categoryLabel: '예산', title: '제목', summary: '', body: '', status: 'published', sortOrder: 1 },
    });

    expect(response.statusCode).toBe(204);
    expect(pool.query.mock.calls[0]?.[0]).toContain('UPDATE structured.wedding_feed_posts');
  });

  it('삭제는 표에서 지운다', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });

    const response = await app().inject({
      method: 'DELETE',
      url: '/v1/admin/wedding-feed/00000000-0000-4000-8000-0000000000aa',
    });

    expect(response.statusCode).toBe(204);
    expect(pool.query.mock.calls[0]?.[0]).toContain('DELETE FROM structured.wedding_feed_posts');
  });

  it('없는 글을 고치거나 지우면 404다', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 });

    const response = await app().inject({
      method: 'DELETE',
      url: '/v1/admin/wedding-feed/00000000-0000-4000-8000-000000000000',
    });

    expect(response.statusCode).toBe(404);
  });

  it('GEMINI_MODEL이 없으면 지금 쓰기가 막힌다', async () => {
    const original = process.env.GEMINI_MODEL;
    delete process.env.GEMINI_MODEL;

    try {
      const response = await app().inject({ method: 'POST', url: '/v1/admin/wedding-feed/generate' });

      expect(response.statusCode).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
    } finally {
      if (original) process.env.GEMINI_MODEL = original;
    }
  });
});
