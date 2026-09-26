import Fastify from 'fastify';
import type { Pool } from 'pg';

import { WEDDING_FEED_TABS } from '@weddingpick/domain';

import type { AppContext } from '../context';
import { ApiError } from '../errors';
import { registerAppRoutes } from '../routes/app';

/**
 * 홈이 부르는 공개 웨딩피드 라우트.
 *
 * MASTER 지시(2026-09-15) — 홈은 있는데 `listPublished`를 부르는 라우트가
 * 어디에도 없었다. 여기서 실제로 표를 읽는지, 공개된 것만 나가는지, 로그인
 * 없이도 되는지를 본다. 권한·부팅 통합은 `app-bootstrap.test.ts`가 DB로 본다.
 *
 * **탭(칩 줄)도 같은 응답으로 나간다.** 2026-09-16~26에는 관리자 탭 표에서 읽었는데
 * 그 탭을 그리는 앱 화면이 없었다(2026-09-26 대표 지적 — 관리자와 앱의 카테고리가 전혀
 * 달랐다). 이제 domain `WEDDING_FEED_TABS`(정본 my.js `cats`)를 그대로 싣고 표를 묻지 않는다.
 */
const pool = { query: jest.fn(), connect: jest.fn() };

function app() {
  const instance = Fastify();

  /* 서버의 것과 같은 자리(`server.ts`) — 없으면 404가 500으로 나가 시험이 거짓말한다. */
  instance.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) return reply.status(error.status).send(error.toResponse());
    throw error;
  });
  registerAppRoutes(instance, { pool, storage: null } as unknown as AppContext);

  return instance;
}

/** 표에서 읽히는 글 한 줄. 필요한 칸만 바꿔 쓴다. */
function row(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

beforeEach(() => {
  pool.query.mockReset();
  pool.query.mockResolvedValue({ rows: [] });
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

  it('칩 줄을 같은 응답으로 준다 — 정본 칩 그대로이고 표를 묻지 않는다', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const response = await app().inject({ method: 'GET', url: '/v1/wedding-feed' });
    const body = response.json<{ tabs: { key: string; label: string; categories: string[] }[] }>();

    expect(body.tabs).toEqual(WEDDING_FEED_TABS);
    expect(body.tabs.map((t) => t.label)).toEqual(['전체', '웨딩홀', '스드메', '본식', '예물 · 신혼', '예산']);
    expect(body.tabs[0]).toEqual({ key: 'all', label: '전체', categories: [] });
    // 글 질의 하나뿐이다 — 옛 탭 · 카테고리 표를 읽지 않는다.
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(String(pool.query.mock.calls[0]?.[0])).not.toContain('wedding_feed_groups');
  });

  it('limit을 물으면 표에 그대로 넘긴다', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const response = await app().inject({ method: 'GET', url: '/v1/wedding-feed?limit=2' });

    expect(response.statusCode).toBe(200);
    expect(pool.query.mock.calls[0]?.[1]).toEqual([2]);
  });

  describe('글 하나', () => {
    const id = '00000000-0000-4000-8000-0000000000f1';

    it('본문과 공개 시각을 준다 — 목록에 없는 값이다', async () => {
      pool.query.mockResolvedValueOnce({ rows: [row()] });

      const response = await app().inject({ method: 'GET', url: `/v1/wedding-feed/${id}` });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        id,
        categoryLabel: '예산',
        title: '스드메 예산 짜는 법',
        summary: '요약',
        body: '본문',
        imageUrl: null,
        bodyImageUrl: null,
        publishedAt: '2026-09-14T00:00:00.000Z',
      });
    });

    it('공개된 것만 찾는다', async () => {
      // 목록과 같은 조건이라야 「목록에 없는데 주소로는 열리는 글」이 안 생긴다.
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await app().inject({ method: 'GET', url: `/v1/wedding-feed/${id}` });

      expect(response.statusCode).toBe(404);
      expect(pool.query.mock.calls[0]?.[0]).toContain("status = 'published'");
    });

    it('UUID가 아닌 주소는 404다 — 표를 묻지 않는다', async () => {
      // 물으면 Postgres가 22P02로 죽고 그것은 500으로 나간다. 500은 서버 고장이라는 말이다.
      const response = await app().inject({ method: 'GET', url: '/v1/wedding-feed/abc' });

      expect(response.statusCode).toBe(404);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  it('준비 단계 순서(order=stage)도 로그인 없이는 원래 목록 그대로다', async () => {
    // 단계를 모르면 고를 기준이 없다 — 표에 넘기는 수도, 첫 질의도 순서를 안 물을 때와 같다.
    pool.query.mockResolvedValueOnce({
      rows: [row({ id: '00000000-0000-4000-8000-0000000000f1' }), row({ id: '00000000-0000-4000-8000-0000000000f2' })],
    });

    const response = await app().inject({ method: 'GET', url: '/v1/wedding-feed?limit=2&order=stage' });

    expect(response.statusCode).toBe(200);
    expect(pool.query.mock.calls[0]?.[1]).toEqual([2]);
    expect(response.json<{ items: { id: string }[] }>().items.map((item) => item.id)).toEqual([
      '00000000-0000-4000-8000-0000000000f1',
      '00000000-0000-4000-8000-0000000000f2',
    ]);
  });

  it('목록은 본문을 읽지 않는다 — 카드에 없는 칸이다', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await app().inject({ method: 'GET', url: '/v1/wedding-feed' });

    expect(pool.query.mock.calls[0]?.[0]).not.toMatch(/\bbody\b/);
  });

  it('이상한 limit은 기본값(8)으로 대신한다', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const response = await app().inject({ method: 'GET', url: '/v1/wedding-feed?limit=abc' });

    expect(response.statusCode).toBe(200);
    expect(pool.query.mock.calls[0]?.[1]).toEqual([8]);
  });
});
