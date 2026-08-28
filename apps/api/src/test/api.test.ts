import { createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL이 없어 API 테스트를 건너뛴다.');
}

describeWithDb('API', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  describe('인증', () => {
    it('토큰 없이 부르면 막는다', async () => {
      const response = await test.app.inject({ method: 'GET', url: '/v1/me' });

      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('unauthenticated');
    });

    it('같은 사람이 다시 로그인해도 계정이 하나다', async () => {
      const first = await signInAs(test, 'same-person');
      const second = await signInAs(test, 'same-person');

      expect(second.userId).toBe(first.userId);
      expect(second.token).not.toBe(first.token);
    });

    it('로그아웃하면 그 토큰은 더 쓸 수 없다', async () => {
      const { headers } = await signInAs(test);

      await test.app.inject({ method: 'DELETE', url: '/v1/auth/sessions', headers });

      const response = await test.app.inject({ method: 'GET', url: '/v1/me', headers });
      expect(response.statusCode).toBe(401);
    });

    it('설정되지 않은 제공자로는 로그인할 수 없다', async () => {
      delete test.context.providers.kakao;

      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/auth/sessions',
        payload: { provider: 'kakao', idToken: 'x' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('접근 권한', () => {
    it('남의 웨딩은 볼 수 없다', async () => {
      const owner = await signInAs(test, 'owner');
      const weddingId = await createWedding(test, owner.headers);

      const stranger = await signInAs(test, 'stranger');
      const response = await test.app.inject({
        method: 'GET',
        url: `/v1/weddings/${weddingId}`,
        headers: stranger.headers,
      });

      expect(response.statusCode).toBe(403);
    });

    it('내 웨딩은 볼 수 있고 배우자 개인정보는 담기지 않는다', async () => {
      const owner = await signInAs(test, 'owner');
      const weddingId = await createWedding(test, owner.headers);

      const response = await test.app.inject({
        method: 'GET',
        url: `/v1/weddings/${weddingId}`,
        headers: owner.headers,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ id: weddingId, partnerLinked: false });
      expect(JSON.stringify(response.json())).not.toContain('email');
    });
  });

  describe('업로드', () => {
    it('장마다 서명 URL을 하나씩 준다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);

      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/documents/uploads',
        headers,
        payload: {
          weddingId,
          pages: [
            { mimeType: 'image/jpeg', sizeBytes: 1000 },
            { mimeType: 'application/pdf', sizeBytes: 2000 },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().uploads).toHaveLength(2);
    });

    it('장이 없으면 거절한다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);

      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/documents/uploads',
        headers,
        payload: { weddingId, pages: [] },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('invalid_request');
    });

    it('같은 문서로 완료를 두 번 눌러도 분석은 하나만 만든다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);

      const upload = await test.app.inject({
        method: 'POST',
        url: '/v1/documents/uploads',
        headers,
        payload: { weddingId, pages: [{ mimeType: 'image/jpeg', sizeBytes: 1000 }] },
      });
      const { rawDocumentId } = upload.json();

      const complete = () =>
        test.app.inject({
          method: 'POST',
          url: `/v1/documents/${rawDocumentId}/complete`,
          headers,
          payload: { weddingId },
        });

      const first = await complete();
      const second = await complete();

      // AI 호출은 비용이다. 같은 문서를 두 번 분석하지 않는다.
      expect(first.json().analysisId).toBe(second.json().analysisId);
    });

    it('분석은 pending으로 시작한다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);

      const upload = await test.app.inject({
        method: 'POST',
        url: '/v1/documents/uploads',
        headers,
        payload: { weddingId, pages: [{ mimeType: 'image/jpeg', sizeBytes: 1000 }] },
      });

      const complete = await test.app.inject({
        method: 'POST',
        url: `/v1/documents/${upload.json().rawDocumentId}/complete`,
        headers,
        payload: { weddingId },
      });

      const analysis = await test.app.inject({
        method: 'GET',
        url: `/v1/analyses/${complete.json().analysisId}`,
        headers,
      });

      expect(analysis.json()).toMatchObject({ status: 'pending' });
    });
  });
});
