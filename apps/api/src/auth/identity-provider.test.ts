import { createNaverProvider } from './identity-provider';

/**
 * 네이버는 OIDC가 아니다. `verify`가 실제로는 authorization code를 받아
 * 서버가 직접 토큰과 교환하고, 그 토큰으로 프로필까지 불러온다는 것을
 * 실제 네이버 서버 없이 확인한다 — `fetchImpl`을 가짜로 끼운다.
 */
describe('네이버 로그인', () => {
  function fakeFetch(responses: {
    token?: unknown;
    tokenOk?: boolean;
    profile?: unknown;
  }): typeof fetch {
    const calls: string[] = [];

    const impl = (async (input: unknown) => {
      const url = input instanceof URL ? input.toString() : String(input);
      calls.push(url);

      if (url.startsWith('https://nid.naver.com/oauth2.0/token')) {
        return {
          ok: responses.tokenOk ?? true,
          json: async () => responses.token ?? { access_token: 'a-token' },
        } as Response;
      }

      return {
        ok: true,
        json: async () =>
          responses.profile ?? {
            resultcode: '00',
            message: 'success',
            response: { id: 'naver-user-1', email: 'user@example.com' },
          },
      } as Response;
    }) as typeof fetch;

    (impl as unknown as { calls: string[] }).calls = calls;

    return impl;
  }

  it('code와 state로 토큰을 교환하고 프로필을 신원으로 바꾼다', async () => {
    const fetchImpl = fakeFetch({});
    const provider = createNaverProvider('client-id', 'client-secret', fetchImpl);

    const identity = await provider.verify('auth-code', { state: 'csrf-state' });

    expect(identity).toEqual({
      provider: 'naver',
      subject: 'naver-user-1',
      email: 'user@example.com',
    });
  });

  it('토큰 요청에 client_secret과 code와 state를 실어 보낸다', async () => {
    const fetchImpl = fakeFetch({});
    const provider = createNaverProvider('client-id', 'client-secret', fetchImpl);

    await provider.verify('auth-code', { state: 'csrf-state' });

    const [tokenUrl] = (fetchImpl as unknown as { calls: string[] }).calls;
    const parsed = new URL(tokenUrl!);

    expect(parsed.searchParams.get('client_id')).toBe('client-id');
    expect(parsed.searchParams.get('client_secret')).toBe('client-secret');
    expect(parsed.searchParams.get('code')).toBe('auth-code');
    expect(parsed.searchParams.get('state')).toBe('csrf-state');
    expect(parsed.searchParams.get('grant_type')).toBe('authorization_code');
  });

  it('state 없이는 교환을 시도하지 않는다 — CSRF 검증 없는 로그인을 막는다', async () => {
    const fetchImpl = fakeFetch({});
    const provider = createNaverProvider('client-id', 'client-secret', fetchImpl);

    await expect(provider.verify('auth-code')).rejects.toThrow('state');
    expect((fetchImpl as unknown as { calls: string[] }).calls).toHaveLength(0);
  });

  it('토큰 교환이 실패하면 이유를 그대로 전달한다', async () => {
    const fetchImpl = fakeFetch({
      token: { error: 'invalid_grant', error_description: '이미 쓴 code다' },
    });
    const provider = createNaverProvider('client-id', 'client-secret', fetchImpl);

    await expect(provider.verify('auth-code', { state: 's' })).rejects.toThrow('이미 쓴 code다');
  });

  it('프로필 조회가 실패하면 신원을 만들지 않는다', async () => {
    const fetchImpl = fakeFetch({
      profile: { resultcode: '024', message: '인증 실패했어요' },
    });
    const provider = createNaverProvider('client-id', 'client-secret', fetchImpl);

    await expect(provider.verify('auth-code', { state: 's' })).rejects.toThrow('인증 실패했어요');
  });
});
