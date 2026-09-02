import type { IdentityProvider } from '../auth/identity-provider';
import { createTestApp, resetDatabase, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 네이버 로그인 라우트 배선. 실제 code↔토큰 교환 규칙은
 * `auth/identity-provider.test.ts`가 이미 본다 — 여기서는 `/v1/auth/sessions`가
 * `state`를 제공자에게 그대로 넘기고, 결과로 세션을 만드는지만 본다.
 */
describeWithDb('네이버 로그인 라우트', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('네이버가 설정돼 있으면 제공자 목록에 나온다', async () => {
    test.context.providers.naver = { verify: async () => ({ provider: 'naver', subject: 'x' }) };

    try {
      const response = await test.app.inject({ method: 'GET', url: '/v1/auth/providers' });

      expect(
        response.json<{ providers: { provider: string }[] }>().providers.map((p) => p.provider)
      ).toContain('naver');
    } finally {
      delete test.context.providers.naver;
    }
  });

  it('code와 state를 그대로 제공자에게 넘겨 세션을 만든다', async () => {
    let received: { token: string; state: string | undefined } | undefined;

    const spy: IdentityProvider = {
      async verify(token, extra) {
        received = { token, state: extra?.state };

        return { provider: 'naver', subject: 'naver-user-1' };
      },
    };
    test.context.providers.naver = spy;

    try {
      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/auth/sessions',
        payload: { provider: 'naver', idToken: 'auth-code', state: 'csrf-state' },
      });

      expect(response.statusCode).toBe(201);
      expect(received).toEqual({ token: 'auth-code', state: 'csrf-state' });
      expect(response.json<{ userId: string }>().userId).toBeTruthy();
    } finally {
      delete test.context.providers.naver;
    }
  });

  it('네이버가 설정 안 돼 있으면 로그인할 수 없다', async () => {
    delete test.context.providers.naver;

    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/auth/sessions',
      payload: { provider: 'naver', idToken: 'auth-code', state: 'csrf-state' },
    });

    expect(response.statusCode).toBe(400);
  });
});
