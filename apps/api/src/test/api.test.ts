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

    it('본문 없는 로그아웃을 500으로 만들지 않는다', async () => {
      const { headers } = await signInAs(test);

      // 앱이 content-type만 붙이고 본문을 비워 보내던 자리다. 클라이언트 실수를
      // 500으로 답하면 진짜 장애와 구분되지 않는다.
      const response = await test.app.inject({
        method: 'DELETE',
        url: '/v1/auth/sessions',
        headers: { ...headers, 'content-type': 'application/json' },
      });

      expect(response.statusCode).toBeLessThan(500);
    });

    it('쓸 수 있는 로그인 방법을 토큰 없이 알려준다', async () => {
      const response = await test.app.inject({ method: 'GET', url: '/v1/auth/providers' });

      expect(response.statusCode).toBe(200);
      expect(response.json().providers).toEqual([
        { provider: 'apple', isDevelopmentStandIn: false },
        { provider: 'kakao', isDevelopmentStandIn: false },
      ]);
    });

    it('개발용 대체 경로는 그렇다고 밝힌다', async () => {
      const real = test.context.providers.apple!;
      test.context.providers.apple = { ...real, isDevelopmentStandIn: true };

      try {
        const response = await test.app.inject({ method: 'GET', url: '/v1/auth/providers' });
        const apple = response
          .json()
          .providers.find((entry: { provider: string }) => entry.provider === 'apple');

        // 개발용 문을 실제 애플 로그인인 척 그려두면 그 빌드가 어디까지 나가는지 모른다.
        expect(apple.isDevelopmentStandIn).toBe(true);
      } finally {
        test.context.providers.apple = real;
      }
    });

    it('설정되지 않은 제공자로는 로그인할 수 없다', async () => {
      const real = test.context.providers.kakao;
      delete test.context.providers.kakao;

      try {
        const response = await test.app.inject({
          method: 'POST',
          url: '/v1/auth/sessions',
          payload: {
            provider: 'kakao',
            authorizationCode: 'x',
            state: 'state',
            redirectUri: 'https://weddingpick-app-web.onrender.com/login',
          },
        });

        expect(response.statusCode).toBe(400);
      } finally {
        // 지운 채로 두면 뒤따르는 테스트가 없어진 제공자를 쓴다.
        test.context.providers.kakao = real;
      }
    });
  });

  describe('이메일 로그인', () => {
    const email = 'jisu@example.com';
    const password = 'Wedding!2026';

    it('없는 이메일은 lookup에서 exists:false, 계정을 만들면 true로 바뀐다', async () => {
      const before = await test.app.inject({ method: 'POST', url: '/v1/auth/email/lookup', payload: { email } });
      expect(before.json()).toEqual({ exists: false });

      await test.app.inject({ method: 'POST', url: '/v1/auth/email/accounts', payload: { email, password } });

      const after = await test.app.inject({ method: 'POST', url: '/v1/auth/email/lookup', payload: { email } });
      expect(after.json()).toEqual({ exists: true });
    });

    it('가입하면 바로 세션이 열리고, 같은 이메일로 다시 가입할 수 없다', async () => {
      const created = await test.app.inject({
        method: 'POST',
        url: '/v1/auth/email/accounts',
        payload: { email, password },
      });
      expect(created.statusCode).toBe(201);
      expect(created.json().token).toBeTruthy();

      // /v1/me는 가입(동의)을 마쳐야 열린다 — 토큰이 실제로 통하는지는 대기
      // 계정도 부를 수 있는 /v1/me/signup으로 확인한다.
      const signupState = await test.app.inject({
        method: 'GET',
        url: '/v1/me/signup',
        headers: { authorization: `Bearer ${created.json().token}` },
      });
      expect(signupState.statusCode).toBe(200);
      expect(signupState.json().activated).toBe(false);

      const duplicate = await test.app.inject({
        method: 'POST',
        url: '/v1/auth/email/accounts',
        payload: { email, password },
      });
      expect(duplicate.statusCode).toBe(409);
    });

    it('대소문자·앞뒤 공백이 달라도 같은 계정이다', async () => {
      await test.app.inject({ method: 'POST', url: '/v1/auth/email/accounts', payload: { email, password } });

      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/auth/sessions',
        payload: { provider: 'email', email: '  JiSu@Example.com  ', password },
      });

      expect(response.statusCode).toBe(201);
    });

    it('로그인 — 맞는 비밀번호는 성공, 틀린 비밀번호는 남은 시도 횟수를 말한다', async () => {
      await test.app.inject({ method: 'POST', url: '/v1/auth/email/accounts', payload: { email, password } });

      const wrong = await test.app.inject({
        method: 'POST',
        url: '/v1/auth/sessions',
        payload: { provider: 'email', email, password: 'wrong-password' },
      });
      expect(wrong.statusCode).toBe(401);
      expect(wrong.json().error.message).toContain('5번 더');

      const right = await test.app.inject({
        method: 'POST',
        url: '/v1/auth/sessions',
        payload: { provider: 'email', email, password },
      });
      expect(right.statusCode).toBe(201);
    });

    it('없는 계정도 있는 계정과 같은 401을 준다 — 등록 여부를 드러내지 않는다', async () => {
      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/auth/sessions',
        payload: { provider: 'email', email: 'nobody@example.com', password: 'whatever1!' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('여러 번 틀리면 맞는 비밀번호도 잠깐 막는다', async () => {
      // 시도 제한은 프로세스 메모리에 있어서 resetDatabase로 지워지지 않는다 —
      // 다른 시험과 겹치지 않게 이 시험만의 이메일을 쓴다.
      const lockoutEmail = 'lockout@example.com';
      await test.app.inject({
        method: 'POST',
        url: '/v1/auth/email/accounts',
        payload: { email: lockoutEmail, password },
      });

      for (let i = 0; i < 6; i += 1) {
        await test.app.inject({
          method: 'POST',
          url: '/v1/auth/sessions',
          payload: { provider: 'email', email: lockoutEmail, password: 'wrong-password' },
        });
      }

      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/auth/sessions',
        payload: { provider: 'email', email: lockoutEmail, password },
      });

      expect(response.statusCode).toBe(429);
    });

    it('비밀번호 찾기 — 메일로 받은 토큰으로 바꾸면 기존 세션이 끊긴다', async () => {
      const created = await test.app.inject({
        method: 'POST',
        url: '/v1/auth/email/accounts',
        payload: { email, password },
      });
      const oldToken = created.json().token;

      test.mails.length = 0;
      const requested = await test.app.inject({
        method: 'POST',
        url: '/v1/auth/email/password-reset',
        payload: { email },
      });
      expect(requested.statusCode).toBe(204);
      expect(test.mails).toHaveLength(1);

      const link = test.mails[0]!.text.match(/https?:\/\/\S+/)?.[0];
      const token = new URL(link!).searchParams.get('token');
      expect(token).toBeTruthy();

      const confirmed = await test.app.inject({
        method: 'POST',
        url: '/v1/auth/email/password-reset/confirm',
        payload: { token, password: 'NewPassword!9' },
      });
      expect(confirmed.statusCode).toBe(204);

      // 재설정 전 세션은 끊긴다.
      const staleSession = await test.app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: { authorization: `Bearer ${oldToken}` },
      });
      expect(staleSession.statusCode).toBe(401);

      // 같은 토큰을 다시 쓸 수 없다.
      const reused = await test.app.inject({
        method: 'POST',
        url: '/v1/auth/email/password-reset/confirm',
        payload: { token, password: 'AnotherPassword!1' },
      });
      expect(reused.statusCode).toBe(400);

      // 새 비밀번호로 로그인된다.
      const relogin = await test.app.inject({
        method: 'POST',
        url: '/v1/auth/sessions',
        payload: { provider: 'email', email, password: 'NewPassword!9' },
      });
      expect(relogin.statusCode).toBe(201);
    });

    it('없는 이메일로 찾기를 해도 204다 — 등록 여부를 드러내지 않는다', async () => {
      test.mails.length = 0;
      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/auth/email/password-reset',
        payload: { email: 'nobody@example.com' },
      });

      expect(response.statusCode).toBe(204);
      expect(test.mails).toHaveLength(0);
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
