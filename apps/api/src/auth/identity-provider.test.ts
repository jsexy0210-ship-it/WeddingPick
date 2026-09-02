import { createNaverProvider } from './identity-provider';

describe('createNaverProvider', () => {
  it('인가 코드를 서버에서 교환하고 앱별 네이버 ID를 검증한다', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'access-token' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ resultcode: '00', response: { id: 'naver-user', email: 'user@example.com' } }),
      });
    const provider = createNaverProvider({
      clientId: 'client-id',
      clientSecret: 'server-only-secret',
      allowedRedirectUris: ['weddingpick://auth/naver'],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    if (provider.flow !== 'authorization_code') throw new Error('잘못된 provider flow');
    await expect(
      provider.verify({
        authorizationCode: 'one-time-code',
        state: 'state-value',
        redirectUri: 'weddingpick://auth/naver',
        codeVerifier: 'v'.repeat(43),
      })
    ).resolves.toEqual({ provider: 'naver', subject: 'naver-user', email: 'user@example.com' });

    const tokenBody = fetchImpl.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(tokenBody.get('client_secret')).toBe('server-only-secret');
    expect(tokenBody.get('code_verifier')).toBe('v'.repeat(43));
    expect(fetchImpl.mock.calls[1]?.[1]?.headers).toEqual({ authorization: 'Bearer access-token' });
  });

  it('허용목록 밖의 redirect URI는 네이버에 요청하기 전에 거부한다', async () => {
    const fetchImpl = jest.fn();
    const provider = createNaverProvider({
      clientId: 'client-id',
      clientSecret: 'server-only-secret',
      allowedRedirectUris: ['weddingpick://auth/naver'],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    if (provider.flow !== 'authorization_code') throw new Error('잘못된 provider flow');
    await expect(
      provider.verify({
        authorizationCode: 'code',
        state: 'state',
        redirectUri: 'https://attacker.example/callback',
      })
    ).rejects.toThrow('허용되지 않은');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
