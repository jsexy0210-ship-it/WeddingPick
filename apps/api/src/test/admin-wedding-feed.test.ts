import Fastify from 'fastify';
import type { Pool } from 'pg';

import type { AppContext } from '../context';
import { ApiError } from '../errors';
import { registerAdminRoutes } from '../routes/admin';
import * as weddingFeed from '../wedding-feed';
import * as weddingFeedWriter from '../analysis/wedding-feed-writer';
import * as weddingFeedImage from '../analysis/wedding-feed-image';

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);

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
const originalGeminiApiKey = process.env.GEMINI_API_KEY;

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
  delete process.env.GEMINI_API_KEY;
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  if (originalGeminiApiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalGeminiApiKey;
});

describe('웨딩피드 관리자 라우트', () => {
  it('목록은 글·실행 기록과 자동 작성 준비 상태를 함께 준다', async () => {
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
            body_image_key: null,
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
    const body = response.json<{
      posts: unknown[];
      runs: unknown[];
      remainingTopics: number;
      nextSortOrder: number;
      automation: { manualReady: boolean; scheduledEnabled: boolean };
    }>();

    expect(Array.isArray(body.posts)).toBe(true);
    expect(body.posts).toHaveLength(1);
    expect(body.posts[0]).toMatchObject({ title: '스드메 예산 짜는 법', status: 'draft' });
    expect(Array.isArray(body.runs)).toBe(true);
    expect(typeof body.remainingTopics).toBe('number');
    expect(body.nextSortOrder).toBe(1);
    expect(body.automation).toEqual({ manualReady: false, scheduledEnabled: false });
  });

  it('등록은 표에 INSERT한다', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: '00000000-0000-4000-8000-0000000000bb', sort_order: 3 }],
    });

    const response = await app().inject({
      method: 'POST',
      url: '/v1/admin/wedding-feed',
      payload: {
        categoryLabel: '예산',
        title: '제목',
        summary: '',
        body: '',
        imageKey: 'wedding-feed/thumbnail/a.jpg',
        bodyImageKey: 'wedding-feed/body/b.jpg',
        status: 'draft',
        sortOrder: 99,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: '00000000-0000-4000-8000-0000000000bb',
      sortOrder: 3,
    });
    expect(pool.query.mock.calls[0]?.[0]).toContain('INSERT INTO structured.wedding_feed_posts');
    expect(pool.query.mock.calls[0]?.[0]).toContain('COALESCE(MAX(sort_order), 0) + 1');
    expect(pool.query.mock.calls[0]?.[1]).not.toContain(99);
  });

  it('Gemini 초안을 저장하면 generated 출처와 실제 모델을 함께 남긴다', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: '00000000-0000-4000-8000-0000000000bc', sort_order: 4 }],
    });

    const response = await app({
      config: { geminiModel: '시험용-모델' },
    } as Partial<AppContext>).inject({
      method: 'POST',
      url: '/v1/admin/wedding-feed',
      payload: {
        categoryLabel: '예산',
        title: '자동 제목',
        summary: '자동 요약',
        body: '자동 본문',
        generated: true,
        status: 'draft',
        sortOrder: 4,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(String(pool.query.mock.calls[0]?.[0])).toContain("THEN 'manual' ELSE 'generated'");
    expect(pool.query.mock.calls[0]?.[1]).toContain('시험용-모델');
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

  it('구버전 PUT이 bodyImageKey를 생략하면 기존 본문 이미지를 보존한다', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });

    const response = await app().inject({
      method: 'PUT',
      url: '/v1/admin/wedding-feed/00000000-0000-4000-8000-0000000000aa',
      payload: { categoryLabel: '예산', title: '제목', summary: '', body: '', status: 'draft', sortOrder: 1 },
    });

    expect(response.statusCode).toBe(204);
    expect(String(pool.query.mock.calls[0]?.[0])).toContain(
      'body_image_key = CASE WHEN $10 THEN $7 ELSE body_image_key END'
    );
    expect(pool.query.mock.calls[0]?.[1]?.[9]).toBe(false);
  });

  it('PUT이 bodyImageKey null을 명시하면 본문 이미지를 지울 수 있다', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });

    const response = await app().inject({
      method: 'PUT',
      url: '/v1/admin/wedding-feed/00000000-0000-4000-8000-0000000000aa',
      payload: {
        categoryLabel: '예산',
        title: '제목',
        summary: '',
        body: '',
        bodyImageKey: null,
        status: 'draft',
        sortOrder: 1,
      },
    });

    expect(response.statusCode).toBe(204);
    expect(pool.query.mock.calls[0]?.[1]?.[6]).toBeNull();
    expect(pool.query.mock.calls[0]?.[1]?.[9]).toBe(true);
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

  it('새 글 자동 작성은 선택한 카테고리 초안만 돌려주고 DB 글은 만들지 않는다', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    pool.query.mockResolvedValueOnce({ rows: [] });

    const write = jest.fn().mockResolvedValue({
      draft: { title: '자동 제목', summary: '자동 요약', body: '자동 본문' },
      usage: { inputTokens: 10, outputTokens: 20 },
    });
    jest.spyOn(weddingFeedWriter, 'createGeminiFeedWriter').mockReturnValue({ write });

    const response = await app({
      config: { geminiModel: '시험용-모델' },
    } as Partial<AppContext>).inject({
      method: 'POST',
      url: '/v1/admin/wedding-feed/draft',
      payload: { categoryLabel: '예산' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ title: '자동 제목', summary: '자동 요약', body: '자동 본문' });
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({ categoryLabel: '예산' }),
      [],
      { covered: [], avoidTitles: [] }
    );
    // 목록은 domain 상수라 표를 묻지 않는다(2026-09-26). 묻는 것은 같은 카테고리의 최근 글 SELECT 하나 — INSERT는 없다.
    expect(String(pool.query.mock.calls[0]?.[0])).toContain('FROM structured.wedding_feed_posts');
    expect(pool.query.mock.calls[0]?.[1]).toEqual(['예산', 30]);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  /*
   * 2026-09-26 대표 지시 — 「같은 카테고리 이전 내용을 분석해서 중첩되지 않는 내용으로
   * 생성한다」. 이전 글을 넘기고, 받은 초안이 이전 글과 겹치면 버리고 다시 쓴다.
   */
  it('자동 작성은 같은 카테고리 최근 글을 넘기고, 겹친 초안은 버리고 다시 쓴다', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const recent = {
      title: '웨딩홀 투어에서 꼭 물어볼 것',
      summary: '보증인원과 식대 인상 조건을 먼저 확인하세요.',
      body: '투어 전에 질문을 적어 가요.',
    };
    pool.query.mockResolvedValueOnce({ rows: [recent] });

    const write = jest
      .fn()
      .mockResolvedValueOnce({
        draft: { title: '웨딩홀 투어 때 꼭 물어봐야 할 질문', summary: '식대 인상 조건과 보증인원부터 확인하세요.', body: '겹친 본문' },
        usage: { inputTokens: 10, outputTokens: 20 },
      })
      .mockResolvedValueOnce({
        draft: { title: '보증인원이 무엇이고 어떻게 정하나', summary: '하객 수를 가늠해 보증인원을 정하는 순서예요.', body: '새 본문' },
        usage: { inputTokens: 10, outputTokens: 20 },
      });
    jest.spyOn(weddingFeedWriter, 'createGeminiFeedWriter').mockReturnValue({ write });

    const response = await app({ config: { geminiModel: 'm' } } as Partial<AppContext>).inject({
      method: 'POST',
      url: '/v1/admin/wedding-feed/draft',
      payload: { categoryLabel: '웨딩홀', avoidTitles: ['웨딩홀 투어 체크'] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().title).toBe('보증인원이 무엇이고 어떻게 정하나');
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[0]?.[2]).toEqual({ covered: [recent], avoidTitles: ['웨딩홀 투어 체크'] });
    /* 둘째 부름은 방금 버린 제목까지 피한다. */
    expect(write.mock.calls[1]?.[2].avoidTitles).toEqual([
      '웨딩홀 투어 체크',
      '웨딩홀 투어 때 꼭 물어봐야 할 질문',
    ]);
  });

  it('몇 번을 써도 겹치면 초안을 내주지 않고 409로 알린다', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const recent = { title: '허니문 일정을 짜는 순서', summary: '항공권과 숙소를 먼저 정하고 일정을 채워요.', body: '' };
    pool.query.mockResolvedValueOnce({ rows: [recent] });
    const write = jest.fn().mockResolvedValue({
      draft: { title: '허니문 일정 짜는 순서 정리', summary: '숙소와 항공권부터 정한 뒤 일정을 채워요.', body: '본문' },
      usage: { inputTokens: 1, outputTokens: 1 },
    });
    jest.spyOn(weddingFeedWriter, 'createGeminiFeedWriter').mockReturnValue({ write });

    const response = await app({ config: { geminiModel: 'm' } } as Partial<AppContext>).inject({
      method: 'POST',
      url: '/v1/admin/wedding-feed/draft',
      payload: { categoryLabel: '허니문' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.message).toBe('이 카테고리의 이전 글과 겹치는 초안만 나왔어요. 다시 눌러주세요.');
    expect(write).toHaveBeenCalledTimes(3);
  });

  it('목록 밖 카테고리로는 초안을 쓰지 않는다 — 결정사 · 옛 이름 · 뒤 공백', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const writer = jest.spyOn(weddingFeedWriter, 'createGeminiFeedWriter');

    for (const categoryLabel of ['결정사', '준비 순서', '업체·서비스']) {
      const response = await app({
        config: { geminiModel: '시험용-모델' },
      } as Partial<AppContext>).inject({
        method: 'POST',
        url: '/v1/admin/wedding-feed/draft',
        payload: { categoryLabel },
      });

      expect(response.statusCode).toBe(400);
    }
    expect(writer).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('목록 밖 카테고리로 쓴 글은 DB를 건드리기 전에 거부한다', async () => {
    /*
     * 관리자 화면만 막으면 화면을 안 거치는 길(옛 화면 · 직접 호출)이 목록 밖 이름을
     * 넣는다. 그 글은 앱 어느 칩에도 안 뜨는데 관리자 표에서는 멀쩡해 보인다.
     */
    const response = await app().inject({
      method: 'POST',
      url: '/v1/admin/wedding-feed',
      payload: { categoryLabel: '준비·예산', title: '제목', status: 'draft', sortOrder: 0 },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { message: string } }>().error.message).toContain(
      '목록에 없는 카테고리예요'
    );
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('카테고리 없이 자동 작성하면 Gemini를 부르지 않는다', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const writer = jest.spyOn(weddingFeedWriter, 'createGeminiFeedWriter');

    const response = await app({
      config: { geminiModel: '시험용-모델' },
    } as Partial<AppContext>).inject({
      method: 'POST',
      url: '/v1/admin/wedding-feed/draft',
      payload: { categoryLabel: '' },
    });

    expect(response.statusCode).toBe(400);
    expect(writer).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('웨딩피드 이미지 업로드 자리는 썸네일과 본문을 별도 키로 만든다', async () => {
    const createUploadTarget = jest.fn().mockResolvedValue({
      storageKey: 'wedding-feed/thumbnail/test.png',
      uploadUrl: 'https://upload.example/test',
    });

    const response = await app({
      storage: { createUploadTarget } as unknown as AppContext['storage'],
    } as Partial<AppContext>).inject({
      method: 'POST',
      url: '/v1/admin/wedding-feed/image/upload-target',
      payload: { mimeType: 'image/png', kind: 'thumbnail' },
    });

    expect(response.statusCode).toBe(200);
    expect(createUploadTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        storageKey: expect.stringMatching(/^wedding-feed\/thumbnail\/.+\.png$/),
        mimeType: 'image/png',
      })
    );
  });

  /*
   * 관리자가 고른 그림은 같은 origin으로 받는다(2026-09-26). 서명 URL로 브라우저가 저장소에
   * 직접 PUT하던 길은 운영 저장소가 CORS로 막는다(e66dec7e · docs/deployment.md 「파일 저장소」).
   */
  it('관리자가 고른 그림은 이 서버를 거쳐 저장소에 올리고 열쇠와 주소를 돌려준다', async () => {
    const upload = jest.fn().mockResolvedValue(undefined);
    const getPublicUrl = jest.fn().mockResolvedValue('https://image.example/uploaded');

    const response = await app({
      storage: { upload, getPublicUrl } as unknown as AppContext['storage'],
    }).inject({
      method: 'PUT',
      url: '/v1/admin/wedding-feed/image/file?kind=body',
      headers: { 'content-type': 'image/png' },
      payload: PNG,
    });

    expect(response.statusCode).toBe(200);
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^wedding-feed\/body\/.+\.png$/), PNG, 'image/png');
    expect(response.json()).toEqual({
      storageKey: upload.mock.calls[0]![0],
      imageUrl: 'https://image.example/uploaded',
    });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('이름표와 내용이 다른 파일 · 종류가 없는 요청 · 빈 파일은 받지 않는다', async () => {
    const upload = jest.fn();
    const instance = app({ storage: { upload } as unknown as AppContext['storage'] });

    const mismatched = await instance.inject({
      method: 'PUT', url: '/v1/admin/wedding-feed/image/file?kind=thumbnail',
      headers: { 'content-type': 'image/jpeg' }, payload: PNG,
    });
    const noKind = await instance.inject({
      method: 'PUT', url: '/v1/admin/wedding-feed/image/file',
      headers: { 'content-type': 'image/png' }, payload: PNG,
    });
    const empty = await instance.inject({
      method: 'PUT', url: '/v1/admin/wedding-feed/image/file?kind=body',
      headers: { 'content-type': 'image/png' }, payload: Buffer.alloc(0),
    });

    expect(mismatched.statusCode).toBe(400);
    expect(mismatched.json().error.message).toBe('PNG · JPG · WebP 이미지만 올릴 수 있어요.');
    expect(noKind.statusCode).toBe(400);
    expect(empty.statusCode).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  /*
   * 링크 미리보기(`site-meta.ts`)가 같은 그림 형식의 받는 틀을 먼저 등록하는 브랜치가 있다
   * (fix-og-card). 같은 형식을 두 번 등록하면 Fastify가 서버를 띄우지 않는다 — 있으면 쓴다.
   */
  it('다른 라우트가 그림 형식을 먼저 등록해도 서버가 뜨고 받는다', async () => {
    const instance = Fastify();
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      instance.addContentTypeParser(type, { parseAs: 'buffer' }, (_request, body, done) => done(null, body));
    }
    const upload = jest.fn().mockResolvedValue(undefined);
    const getPublicUrl = jest.fn().mockResolvedValue('https://image.example/x');
    registerAdminRoutes(instance, {
      pool, storage: { upload, getPublicUrl },
    } as unknown as AppContext);

    const response = await instance.inject({
      method: 'PUT', url: '/v1/admin/wedding-feed/image/file?kind=thumbnail',
      headers: { 'content-type': 'image/png' }, payload: PNG,
    });

    expect(response.statusCode).toBe(200);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('서버 상한(5MB)을 넘는 그림은 413이다', async () => {
    const upload = jest.fn();
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);

    const response = await app({ storage: { upload } as unknown as AppContext['storage'] }).inject({
      method: 'PUT', url: '/v1/admin/wedding-feed/image/file?kind=body',
      headers: { 'content-type': 'image/png' }, payload: big,
    });

    expect(response.statusCode).toBe(413);
    expect(upload).not.toHaveBeenCalled();
  });

  it('관리자 이미지 생성은 웨딩피드 저장소에 쓰고 계획을 남기며 글은 저장하지 않는다', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const generate = jest.spyOn(weddingFeedWriter, 'generateWeddingFeedImage').mockResolvedValue({
      bytes: PNG, mimeType: 'image/png', extension: 'png',
    });
    const upload = jest.fn().mockResolvedValue(undefined);
    const getPublicUrl = jest.fn().mockResolvedValue('https://image.example/preview');

    const response = await app({
      storage: { upload, getPublicUrl } as unknown as AppContext['storage'],
    }).inject({
      method: 'POST',
      url: '/v1/admin/wedding-feed/image/generate',
      payload: { kind: 'thumbnail', title: '계약서 확인', summary: '견적 항목', categoryLabel: '계약' },
    });

    expect(response.statusCode).toBe(200);
    expect(generate).toHaveBeenCalledWith(
      'test-key',
      expect.objectContaining({ kind: 'thumbnail', title: '계약서 확인', categoryLabel: '계약' }),
      expect.objectContaining({ scene: expect.any(String), people: expect.any(String) }),
      expect.objectContaining({ timeoutMs: expect.any(Number) })
    );
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^wedding-feed\/thumbnail\/.+\.png$/), PNG, 'image/png'
    );
    expect(response.json()).toMatchObject({ imageUrl: 'https://image.example/preview' });
    /* 첫째는 최근 그림 기록을 읽고, 둘째는 이번 그림의 계획을 남긴다. 글 표는 건드리지 않는다. */
    expect(String(pool.query.mock.calls[0]?.[0])).toContain('wedding_feed_generated_images');
    expect(pool.query.mock.calls[0]?.[1]).toEqual(['계약', 30]);
    expect(String(pool.query.mock.calls[1]?.[0])).toContain('INSERT INTO structured.wedding_feed_generated_images');
    expect(pool.query.mock.calls.some(([sql]) => String(sql).includes('wedding_feed_posts'))).toBe(false);
  });

  it('그림 기록 표가 아직 없으면(0443 전) 기록 없이 그림을 준다', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    pool.query.mockRejectedValueOnce(Object.assign(new Error('relation does not exist'), { code: '42P01' }));
    jest.spyOn(weddingFeedWriter, 'generateWeddingFeedImage').mockResolvedValue({
      bytes: PNG, mimeType: 'image/png', extension: 'png',
    });
    const upload = jest.fn().mockResolvedValue(undefined);
    const getPublicUrl = jest.fn().mockResolvedValue('https://image.example/preview');

    const response = await app({
      storage: { upload, getPublicUrl } as unknown as AppContext['storage'],
    }).inject({
      method: 'POST',
      url: '/v1/admin/wedding-feed/image/generate',
      payload: { kind: 'body', title: '제목' },
    });

    expect(response.statusCode).toBe(200);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('제목이나 Gemini 연결이 없으면 이미지 생성 비용을 쓰지 않는다', async () => {
    const generate = jest.spyOn(weddingFeedWriter, 'generateWeddingFeedImage');
    const invalid = await app().inject({
      method: 'POST', url: '/v1/admin/wedding-feed/image/generate',
      payload: { kind: 'thumbnail', title: '' },
    });
    const unconfigured = await app().inject({
      method: 'POST', url: '/v1/admin/wedding-feed/image/generate',
      payload: { kind: 'body', title: '제목' },
    });
    expect(invalid.statusCode).toBe(400);
    expect(unconfigured.statusCode).toBe(500);
    expect(generate).not.toHaveBeenCalled();
  });

  it('이미지 모델 거절 원인을 관리자 화면에 안전한 코드로 알린다', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    pool.query.mockResolvedValue({ rows: [] });
    jest.spyOn(weddingFeedWriter, 'generateWeddingFeedImage').mockRejectedValue(
      new weddingFeedImage.WeddingFeedImageError('provider', 404, 'NOT_FOUND')
    );
    const response = await app().inject({
      method: 'POST', url: '/v1/admin/wedding-feed/image/generate',
      payload: { kind: 'thumbnail', title: '제목' },
    });
    expect(response.statusCode).toBe(500);
    expect(response.json().error.message).toBe('Gemini 이미지 요청이 거절됐어요 (404 NOT_FOUND).');
  });

  /*
   * 2026-09-15에 이 자리가 두 번 뒤집혔다 — 제미나이 → 클로드 → 제미나이.
   * 마지막이 「클로드 API는 싹다 전면 폐기하고 제미나이로 명시해」다. 모델은
   * `context.config.geminiModel` 하나에서 온다.
   *
   * 여기서는 라우트가 그 값을 그대로 넘기는지만 본다 — 실제로 부르지 않는다.
   */
  it('지금 쓰기는 config.geminiModel로 제미나이 작성기를 부른다', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
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
    delete process.env.GEMINI_API_KEY;
  });

  it('Gemini 연결이 없으면 실행 기록을 만들기 전에 원인을 알려준다', async () => {
    delete process.env.GEMINI_API_KEY;

    const response = await app({ config: { geminiModel: '시험용-모델' } } as Partial<AppContext>).inject({
      method: 'POST',
      url: '/v1/admin/wedding-feed/generate',
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      error: { message: expect.stringContaining('자동 작성 서버 설정') },
    });
    expect(pool.query).not.toHaveBeenCalled();
  });
});

/**
 * 탭 · 카테고리 편집 라우트는 걷었다(2026-09-26 대표 지적 — 「관리자 웨딩피드 카테고리와
 * 앱웹 카테고리와 정보가 전혀 다르다」). 관리자가 고친 탭을 그리는 앱 화면이 없었다 —
 * 목록은 이제 domain 상수 하나다. 걷은 주소가 조용히 살아 있지 않은지 본다.
 */
describe('웨딩피드 탭·카테고리 편집 — 걷었다', () => {
  it.each([
    ['GET', '/v1/admin/wedding-feed/taxonomy'],
    ['POST', '/v1/admin/wedding-feed/groups'],
    ['PUT', '/v1/admin/wedding-feed/groups/g1'],
    ['DELETE', '/v1/admin/wedding-feed/groups/g1'],
    ['POST', '/v1/admin/wedding-feed/categories'],
    ['PUT', '/v1/admin/wedding-feed/categories/c1'],
    ['DELETE', '/v1/admin/wedding-feed/categories/c1'],
  ] as const)('%s %s는 없다', async (method, url) => {
    const response = await app().inject({ method, url, payload: method === 'GET' || method === 'DELETE' ? undefined : {} });

    expect(response.statusCode).toBe(404);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
