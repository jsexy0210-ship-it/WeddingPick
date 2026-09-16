import { DISCLOSURE_THRESHOLDS } from '@weddingpick/domain';
import Fastify from 'fastify';
import type { Pool } from 'pg';

import type { AppContext } from '../context';
import { ApiError } from '../errors';
import * as faqAdmin from '../faq-admin';
import { registerAdminRoutes } from '../routes/admin';
import { registerSiteMetaRoutes } from '../routes/site-meta';

/**
 * FAQ와 카드 그림.
 *
 * **왜 이 시험이 있나.** FAQ 라우트 다섯은 전부터 등록돼 있었고 아무것도 하지
 * 않았다 — GET은 빈 배열 리터럴, POST는 임의 id, 나머지는 204. 화면은 멀쩡히
 * 그려지고 저장 단추도 눌렸다. 그래서 **응답이 200인지가 아니라 DB를 실제로
 * 건드리는지**를 본다.
 *
 * 권한은 기존 DB 통합시험이 본다. 여기서는 계약과 가드만 본다.
 */
jest.mock('../auth/plugin', () => ({
  requireOperatorUser: () => async () => undefined,
  currentUserId: () => '00000000-0000-4000-8000-000000000001',
}));

const pool = { query: jest.fn(), connect: jest.fn() };

function app(register: (app: ReturnType<typeof Fastify>, context: AppContext) => void, context?: Partial<AppContext>) {
  const instance = Fastify();

  instance.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) return reply.status(error.status).send(error.toResponse());
    throw error;
  });
  register(instance, { pool, ...context } as unknown as AppContext);

  return instance;
}

beforeEach(() => {
  pool.query.mockReset();
  pool.connect.mockReset();
});

describe('FAQ', () => {
  /**
   * 2026-09-16 대표 지시로 **코드 항목을 겹쳐 보여주던 것이 없어졌다** — 일곱이
   * 표로 내려와 전부 고치고 지울 수 있다. 목록은 표만 읽는다.
   */
  it('목록은 표만 읽고, 답은 채운 글과 고칠 원문을 함께 준다', async () => {
    pool.query.mockResolvedValue({
      rows: [
        {
          id: '00000000-0000-4000-8000-0000000000aa',
          key: null,
          category: '이용 안내',
          question: '운영자가 넣은 질문',
          answer: '실 제보가 {{limited}}건 모이면 보여드려요.',
          sort_order: 3,
          published: true,
        },
      ],
    });

    const data = await faqAdmin.list(pool as unknown as Pool);

    expect(pool.query).toHaveBeenCalled();
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({
      order: 3,
      published: true,
      key: null,
      /* 목록에 보여주는 것은 사용자가 읽을 문장이다. */
      answer: `실 제보가 ${DISCLOSURE_THRESHOLDS.limited}건 모이면 보여드려요.`,
      /* 고칠 때 여는 것은 채우기 전 글이다 — 채운 글을 되돌려 저장하면 수가 굳는다. */
      answerSource: '실 제보가 {{limited}}건 모이면 보여드려요.',
    });
  });

  it('등록은 표에 INSERT한다 — 성공 응답만 돌려주지 않는다', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: '00000000-0000-4000-8000-0000000000bb' }] });

    const response = await app(registerAdminRoutes).inject({
      method: 'POST',
      url: '/v1/admin/faq',
      payload: { category: '이용 안내', question: '질문', answer: '답', order: 1, published: true },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: '00000000-0000-4000-8000-0000000000bb' });
    expect(pool.query.mock.calls[0]?.[0]).toContain('INSERT INTO structured.faq_items');
  });

  it.each([
    { payload: { question: '질문', answer: '답' }, missing: '카테고리' },
    { payload: { category: '이용 안내', answer: '답' }, missing: '질문' },
    { payload: { category: '이용 안내', question: '질문' }, missing: '답변' },
  ])('$missing가 비면 DB를 건드리기 전에 거부한다', async ({ payload }) => {
    const response = await app(registerAdminRoutes).inject({
      method: 'POST',
      url: '/v1/admin/faq',
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  /**
   * **「코드에 있는 항목은 고칠 수 없다」가 없어진 자리다**(2026-09-16 대표 지시).
   * 전에는 `spec:price-source` 꼴의 id로 오는 쓰기를 400으로 막았다. 지금 남는 것은
   * 표의 행을 가리키지 않는 id를 거르는 일뿐이다 — 그대로 질의에 넣으면 PostgreSQL이
   * 22P02로 끊어 500이 되고, 운영자는 없는 것을 지운 것을 고장으로 읽는다.
   */
  it('표의 행이 아닌 id는 DB를 건드리기 전에 「찾지 못했어요」로 돌려준다', async () => {
    await expect(
      faqAdmin.update(
        pool as unknown as Pool,
        'spec:price-source',
        { category: '이용 안내', question: '질문', answer: '답', order: 0, published: true },
        null
      )
    ).rejects.toMatchObject({ code: 'not_found' });

    await expect(faqAdmin.remove(pool as unknown as Pool, 'spec:price-source')).rejects.toMatchObject({
      code: 'not_found',
    });

    expect(pool.query).not.toHaveBeenCalled();
  });

  /**
   * 채울 수 없는 자리표시자.
   *
   * **DB를 건드리기 전에 막는다.** 통과시키면 `{{limitedd}}`가 표에 담기고 그대로
   * 사용자 화면에 실린다 — 글자라서 아무도 고장으로 보지 않는다.
   */
  it('없는 자리표시자를 적으면 DB를 건드리기 전에 거부한다', async () => {
    const response = await app(registerAdminRoutes).inject({
      method: 'POST',
      url: '/v1/admin/faq',
      payload: {
        category: '이용 안내',
        question: '질문',
        answer: '실 제보가 {{limitedd}}건 모이면',
        order: 0,
        published: true,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('카드 그림', () => {
  const storage = {
    createUploadTarget: jest.fn(),
    download: jest.fn(),
    getPublicUrl: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(() => {
    storage.createUploadTarget.mockReset();
    storage.download.mockReset();
  });

  it('우리가 만든 열쇠가 아니면 받지 않는다', async () => {
    const response = await app(registerSiteMetaRoutes, { storage } as unknown as AppContext).inject({
      method: 'PUT',
      url: '/v1/admin/site-meta/og-image',
      payload: { storageKey: 'some-user-id/some-document/1.pdf' },
    });

    expect(response.statusCode).toBe(400);
    /* 남의 파일을 카드 그림으로 내보내지 않는다 — 저장소를 열어보기도 전에 막는다. */
    expect(storage.download).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('파일이 올라오지 않았으면 열쇠를 적지 않는다', async () => {
    storage.download.mockRejectedValue(new Error('없음'));

    const response = await app(registerSiteMetaRoutes, { storage } as unknown as AppContext).inject({
      method: 'PUT',
      url: '/v1/admin/site-meta/og-image',
      payload: { storageKey: 'site-meta/og-1757600000000.png' },
    });

    expect(response.statusCode).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('올릴 자리는 그림 형식만 받는다', async () => {
    const instance = app(registerSiteMetaRoutes, { storage } as unknown as AppContext);

    const rejected = await instance.inject({
      method: 'POST',
      url: '/v1/admin/site-meta/og-image/upload-target',
      payload: { mimeType: 'image/svg+xml' },
    });

    expect(rejected.statusCode).toBe(400);
    expect(storage.createUploadTarget).not.toHaveBeenCalled();

    storage.createUploadTarget.mockResolvedValue({
      storageKey: 'site-meta/og-1.png',
      uploadUrl: 'https://example.test/put',
      expiresAt: new Date(),
    });

    const allowed = await instance.inject({
      method: 'POST',
      url: '/v1/admin/site-meta/og-image/upload-target',
      payload: { mimeType: 'image/png' },
    });

    expect(allowed.statusCode).toBe(200);
    expect(storage.createUploadTarget.mock.calls[0]?.[0]).toMatchObject({
      storageKey: expect.stringMatching(/^site-meta\/og-\d+\.png$/),
    });
  });

  it('올려 둔 그림이 없으면 공개 조회가 404다 — 빈 그림을 내보내지 않는다', async () => {
    pool.query.mockResolvedValue({ rows: [{ og_image_key: null }] });

    const response = await app(registerSiteMetaRoutes, { storage } as unknown as AppContext).inject({
      method: 'GET',
      url: '/v1/site-meta/og-image',
    });

    expect(response.statusCode).toBe(404);
  });
});
