import { loungeReviewListResponseSchema } from '@weddingpick/api-contract';

import type { LocalStorage } from '../storage/local';
import {
  adminSession,
  createTestApp,
  resetDatabase,
  signInAs,
  type TestApp,
} from './helpers';

let test: TestApp;
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const BODY =
  '음식이 따뜻하게 나왔고 직원분들이 동선을 잘 안내해 주셨습니다. 주차도 안내를 받아 이용하기 편했습니다.';

describeWithDb('후기 미디어와 상호작용', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function createVendor() {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ('상호작용 예식홀', 'hall', '서울', 'public_data')
       RETURNING id`
    );
    return rows[0]!.id;
  }

  async function createReview(subject = 'review-author') {
    const vendorId = await createVendor();
    const author = await signInAs(test, subject);
    const response = await test.app.inject({
      method: 'POST',
      url: `/v1/vendors/${vendorId}/reviews`,
      headers: author.headers,
      payload: {
        role: 'contractor',
        overall: 4,
        title: '실제 이용 후기',
        body: BODY,
        aspects: [{ key: 'food_taste', rating: 4 }],
      },
    });
    expect(response.statusCode).toBe(201);
    return {
      vendorId,
      author,
      reviewId: response.json<{ reviewId: string }>().reviewId,
    };
  }

  it('권리 확인한 실제 업로드만 후기 사진으로 묶고 공개 응답은 storageKey 필드를 내보내지 않는다', async () => {
    const vendorId = await createVendor();
    const author = await signInAs(test, 'media-author');

    const target = await test.app.inject({
      method: 'POST',
      url: '/v1/reviews/media/upload-target',
      headers: author.headers,
      payload: { mimeType: 'image/png' },
    });
    expect(target.statusCode).toBe(200);

    const upload = target.json<{ storageKey: string; uploadUrl: string }>();
    expect(upload.storageKey).toMatch(new RegExp(`^reviews/${author.userId}/`));

    const storage = test.context.storage as LocalStorage;
    storage.put(
      upload.storageKey,
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
    );

    const written = await test.app.inject({
      method: 'POST',
      url: `/v1/vendors/${vendorId}/reviews`,
      headers: author.headers,
      payload: {
        role: 'contractor',
        overall: 4,
        title: '사진이 있는 후기',
        body: BODY,
        aspects: [{ key: 'food_taste', rating: 4 }],
        media: [{ storageKey: upload.storageKey, mimeType: 'image/png', rightsConfirmed: true }],
      },
    });
    expect(written.statusCode).toBe(201);

    const listed = await test.app.inject({
      method: 'GET',
      url: '/v1/reviews',
      headers: author.headers,
    });
    expect(listed.statusCode).toBe(200);
    const parsed = loungeReviewListResponseSchema.parse(listed.json());
    expect(parsed.reviews[0]?.media).toHaveLength(1);
    expect(parsed.reviews[0]?.media[0]?.mimeType).toBe('image/png');
    expect(parsed.reviews[0]).not.toHaveProperty('storageKey');
    expect(parsed.reviews[0]?.media[0]).not.toHaveProperty('storageKey');
  });

  it('도움돼요 PUT/DELETE는 중복 요청에도 사용자당 한 번만 센다', async () => {
    const { reviewId } = await createReview('help-author');
    const member = await signInAs(test, 'help-member');

    const put = () =>
      test.app.inject({
        method: 'PUT',
        url: `/v1/reviews/${reviewId}/helpful`,
        headers: member.headers,
      });
    expect((await put()).json()).toEqual({ count: 1, mine: true });
    expect((await put()).json()).toEqual({ count: 1, mine: true });

    const del = () =>
      test.app.inject({
        method: 'DELETE',
        url: `/v1/reviews/${reviewId}/helpful`,
        headers: member.headers,
      });
    expect((await del()).json()).toEqual({ count: 0, mine: false });
    expect((await del()).json()).toEqual({ count: 0, mine: false });
  });

  it('댓글은 회원이 만들고 자기 것만 지우며 작성자 식별자는 공개하지 않는다', async () => {
    const { reviewId } = await createReview('comment-review-author');
    const commenter = await signInAs(test, 'commenter');
    const other = await signInAs(test, 'comment-other');

    const created = await test.app.inject({
      method: 'POST',
      url: `/v1/reviews/${reviewId}/comments`,
      headers: commenter.headers,
      payload: { body: '상담 일정은 어느 정도 여유를 두고 잡으셨나요?' },
    });
    expect(created.statusCode).toBe(201);
    const commentId = created.json<{ id: string }>().id;

    const mine = await test.app.inject({
      method: 'GET',
      url: `/v1/reviews/${reviewId}/comments`,
      headers: commenter.headers,
    });
    expect(mine.json()).toMatchObject({
      count: 1,
      comments: [{ id: commentId, mine: true }],
    });
    expect(mine.body).not.toContain(commenter.userId);

    const forbiddenDelete = await test.app.inject({
      method: 'DELETE',
      url: `/v1/review-comments/${commentId}`,
      headers: other.headers,
    });
    expect(forbiddenDelete.statusCode).toBe(404);

    const removed = await test.app.inject({
      method: 'DELETE',
      url: `/v1/review-comments/${commentId}`,
      headers: commenter.headers,
    });
    expect(removed.statusCode).toBe(204);
  });

  it('댓글 신고는 즉시 가리지 않고 운영자 판단 뒤에만 공개 목록에서 사라진다', async () => {
    const { reviewId } = await createReview('moderation-author');
    const commenter = await signInAs(test, 'moderation-commenter');
    const reporter = await signInAs(test, 'moderation-reporter');

    const created = await test.app.inject({
      method: 'POST',
      url: `/v1/reviews/${reviewId}/comments`,
      headers: commenter.headers,
      payload: { body: '방문 전에 주차 가능 시간을 확인해보시는 편이 좋아요.' },
    });
    const commentId = created.json<{ id: string }>().id;

    const reported = await test.app.inject({
      method: 'POST',
      url: `/v1/review-comments/${commentId}/reports`,
      headers: reporter.headers,
      payload: { reason: 'other' },
    });
    expect(reported.statusCode).toBe(201);

    const stillVisible = await test.app.inject({
      method: 'GET',
      url: `/v1/reviews/${reviewId}/comments`,
    });
    expect(stillVisible.json<{ count: number }>().count).toBe(1);

    const operator = await adminSession(test, 'operator', 'review-comment-operator');
    const hidden = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/review-comments/${commentId}/hide`,
      headers: operator.headers,
    });
    expect(hidden.statusCode).toBe(204);

    const after = await test.app.inject({
      method: 'GET',
      url: `/v1/reviews/${reviewId}/comments`,
    });
    expect(after.json<{ count: number }>().count).toBe(0);
  });
});
