import { createKakaoProvider, createNaverProvider } from './identity-provider';

describe('createKakaoProvider', () => {
  it('인가 코드를 REST API 키로 교환하고 응답의 id_token을 검증한다', async () => {
    // id_token이 없으면 공개키 검증 전에 멈춘다 — 여기서는 교환 요청의 모양만 본다.
    const fetchImpl = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'a' }) });
    const provider = createKakaoProvider({
      appKey: 'rest-api-key',
      clientSecret: 'server-only-secret',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    if (provider.flow !== 'authorization_code') throw new Error('잘못된 provider flow');
    await expect(
      provider.verify({
        authorizationCode: 'one-time-code',
        state: 'state-value',
        redirectUri: 'https://weddingpick-app-web.onrender.com/login',
        codeVerifier: 'v'.repeat(43),
      })
    ).rejects.toThrow('id_token이 없다');

    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://kauth.kakao.com/oauth/token');
    const tokenBody = fetchImpl.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(tokenBody.get('grant_type')).toBe('authorization_code');
    expect(tokenBody.get('client_id')).toBe('rest-api-key');
    expect(tokenBody.get('client_secret')).toBe('server-only-secret');
    expect(tokenBody.get('redirect_uri')).toBe('https://weddingpick-app-web.onrender.com/login');
    expect(tokenBody.get('code')).toBe('one-time-code');
    expect(tokenBody.get('code_verifier')).toBe('v'.repeat(43));
  });

  it('카카오가 거부하면 그 이유를 오류에 담는다 — 서버 로그에서 원인을 찾을 수 있어야 한다', async () => {
    const provider = createKakaoProvider({
      appKey: 'app-key',
      fetchImpl: (async () =>
        new Response('{"error":"invalid_client","error_code":"KOE010"}', { status: 401 })) as typeof fetch,
    });

    if (provider.flow !== 'authorization_code') throw new Error('잘못된 provider flow');
    await expect(
      provider.verify({ authorizationCode: 'code', state: 'state', redirectUri: 'https://example.test/login' })
    ).rejects.toThrow(/KOE010/);
  });

  it('Client Secret을 켜지 않은 앱은 client_secret을 보내지 않는다', async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce({ ok: false });
    const provider = createKakaoProvider({ appKey: 'rest-api-key', fetchImpl: fetchImpl as unknown as typeof fetch });

    if (provider.flow !== 'authorization_code') throw new Error('잘못된 provider flow');
    await expect(
      provider.verify({ authorizationCode: 'code', state: 'state', redirectUri: 'kakaokey://oauth' })
    ).rejects.toThrow('토큰 교환에 실패');

    const tokenBody = fetchImpl.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(tokenBody.has('client_secret')).toBe(false);
    expect(tokenBody.has('code_verifier')).toBe(false);
  });
});

describe('createNaverProvider', () => {
  it('인가 코드를 서버에서 교환하고 앱별 네이버 ID를 검증한다', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'access-token' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultcode: '00',
          response: {
            id: 'naver-user', email: 'user@example.com', name: '웨딩픽', nickname: '웨픽',
            profile_image: 'https://example.com/profile.png', gender: 'F', birthday: '01-02',
            age: '20-29', birthyear: '2000', mobile: '010-0000-0000',
          },
        }),
      });
    const provider = createNaverProvider({
      clientId: 'client-id',
      clientSecret: 'server-only-secret',
      allowedRedirectUris: ['https://weddingpickl.onrender.com/v1/auth/naver/callback'],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    if (provider.flow !== 'authorization_code') throw new Error('잘못된 provider flow');
    await expect(
      provider.verify({
        authorizationCode: 'one-time-code',
        state: 'state-value',
        redirectUri: 'https://weddingpickl.onrender.com/v1/auth/naver/callback',
        codeVerifier: 'v'.repeat(43),
      })
    ).resolves.toMatchObject({
      provider: 'naver', subject: 'naver-user', email: 'user@example.com',
      profile: { name: '웨딩픽', nickname: '웨픽', gender: 'F', birthYear: '2000' },
    });

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
      allowedRedirectUris: ['https://weddingpickl.onrender.com/v1/auth/naver/callback'],
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
