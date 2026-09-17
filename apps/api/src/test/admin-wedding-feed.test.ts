import Fastify from 'fastify';
import type { Pool } from 'pg';

import type { AppContext } from '../context';
import { ApiError } from '../errors';
import { registerAdminRoutes } from '../routes/admin';
import * as weddingFeed from '../wedding-feed';
import * as weddingFeedWriter from '../analysis/wedding-feed-writer';

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

  /*
   * 2026-09-15에 이 자리가 두 번 뒤집혔다 — 제미나이 → 클로드 → 제미나이.
   * 마지막이 「클로드 API는 싹다 전면 폐기하고 제미나이로 명시해」다. 모델은
   * `context.config.geminiModel` 하나에서 온다.
   *
   * 여기서는 라우트가 그 값을 그대로 넘기는지만 본다 — 실제로 부르지 않는다.
   */
  it('지금 쓰기는 config.geminiModel로 제미나이 작성기를 부른다', async () => {
    const runGeneration = jest
      .spyOn(weddingFeed, 'runGeneration')
      .mockResolvedValue({ created: 1, skipped: null });
    /*
     * 작성기를 가짜로 바꾼다 — 진짜는 열쇠가 없으면 만들 때 던지고, 이 시험에는
     * 열쇠가 없다. `runGeneration` 자체를 위에서 이미 가짜로 바꿨으니 `writer`는
     * 아무것도 하지 않아도 된다.
     */
    jest.spyOn(weddingFeedWriter, 'createGeminiFeedWriter').mockReturnValue({
      write: jest.fn(),
    });

    const response = await app({ config: { geminiModel: '시험용-모델' } } as Partial<AppContext>).inject({
      method: 'POST',
      url: '/v1/admin/wedding-feed/generate',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ created: 1, skipped: null });
    expect(runGeneration.mock.calls[0]?.[0]).toMatchObject({ model: '시험용-모델', trigger: 'manual' });
  });
});

/**
 * 탭과 카테고리 라우트 — 2026-09-16 대표 지시 「탭별 카테고리별로 다 설정 가능해야한다」.
 *
 * **지우기를 막는 자리를 본다.** 쓰는 카테고리를 지우면 그 글들이 어느 탭에도 안 뜨는데
 * 화면은 멀쩡해 보인다 — 이 기능이 없애려던 바로 그 상태다. 화면이 한 번 막고 서버가
 * 한 번 더 막는다. 글로 적은 규칙은 깨지지만 세는 시험은 안 깨진다.
 */
describe('웨딩피드 탭·카테고리 라우트', () => {
  it('어느 탭에도 안 든 카테고리를 세어서 준다', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 'g1', name: '준비·예산', sort_order: 1, active: true }],
      })
      .mockResolvedValueOnce({
        rows: [
          { id: 'c1', name: '예산', group_id: 'g1', sort_order: 1, active: true, post_count: '2' },
          { id: 'c2', name: '하객', group_id: null, sort_order: 2, active: true, post_count: '0' },
          // 꺼 둔 것은 안 센다 — 애초에 앱에 안 나간다.
          { id: 'c3', name: '계약', group_id: null, sort_order: 3, active: false, post_count: '1' },
        ],
      });

    const response = await app().inject({
      method: 'GET',
      url: '/v1/admin/wedding-feed/taxonomy',
    });
    const body = response.json<{ ungrouped: string[]; categories: { postCount: number }[] }>();

    expect(response.statusCode).toBe(200);
    expect(body.ungrouped).toEqual(['하객']);
    expect(body.categories[0]).toMatchObject({ name: '예산', postCount: 2 });
  });

  it('쓰는 카테고리는 지우지 못하고 몇 편인지 말해 준다', async () => {
    // 세는 질의 하나만 간다 — 딸린 글이 있으면 DELETE까지 가지 않는다.
    pool.query.mockResolvedValueOnce({ rows: [{ n: '12' }] });

    const response = await app().inject({
      method: 'DELETE',
      url: '/v1/admin/wedding-feed/categories/c1',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: { message: string } }>().error.message).toContain('12편');
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('딸린 글이 없으면 지운다', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ n: '0' }] })
      .mockResolvedValueOnce({ rowCount: 1 });

    const response = await app().inject({
      method: 'DELETE',
      url: '/v1/admin/wedding-feed/categories/c1',
    });

    expect(response.statusCode).toBe(204);
  });

  /*
   * 탭을 지우면 딸린 카테고리는 **남는다**(`ON DELETE SET NULL`). 함께 지우면 그
   * 카테고리로 쌓인 글이 가리키던 값이 사라진다. 몇 개가 떨어져 나왔는지 돌려줘서
   * 화면이 그대로 말할 수 있게 한다.
   */
  it('탭을 지우면 떨어져 나온 카테고리 수를 돌려준다', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ n: '2' }] })
      .mockResolvedValueOnce({ rowCount: 1 });

    const response = await app().inject({
      method: 'DELETE',
      url: '/v1/admin/wedding-feed/groups/g1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ orphaned: 2 });
  });

  /**
   * **이름을 고치면 글의 `category_label`도 따라간다.**
   *
   * 글은 id로 붙어 있어서 이름만 바꿔도 연결은 안 끊어지지만, 카드 위 작은 줄은
   * `category_label` 문자열을 그대로 그린다 — 안 맞추면 관리자 표에는 새 이름,
   * 앱 화면에는 옛 이름이 나란히 남는다.
   */
  it('카테고리 이름을 고치면 그 글들의 표시 이름도 한 트랜잭션에서 바꾼다', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // 이름 겹침 확인
    const client = { query: jest.fn().mockResolvedValue({ rowCount: 1 }), release: jest.fn() };

    pool.connect.mockResolvedValue(client);

    const response = await app().inject({
      method: 'PUT',
      url: '/v1/admin/wedding-feed/categories/c1',
      payload: { name: '예산 관리', groupId: null, sortOrder: 1, active: true },
    });

    expect(response.statusCode).toBe(204);

    const sql = client.query.mock.calls.map((call) => String(call[0]));

    expect(sql[0]).toBe('BEGIN');
    expect(sql[sql.length - 1]).toBe('COMMIT');
    expect(sql.some((q) => q.includes('wedding_feed_posts') && q.includes('category_label'))).toBe(
      true
    );
    expect(client.release).toHaveBeenCalled();
  });
});
