import { fetchKakaoStaticMap } from '../kakao-static-map';

describe('fetchKakaoStaticMap', () => {
  it('builds an authenticated request with a marker at the vendor coordinates', async () => {
    const seenRequests: Array<{ url: URL; authorization: string | null }> = [];

    const map = await fetchKakaoStaticMap({
      restApiKey: 'server-secret',
      lat: 37.3955,
      lng: 127.1105,
      fetchImpl: async (input, init) => {
        seenRequests.push({
          url: new URL(String(input)),
          authorization: new Headers(init?.headers).get('authorization'),
        });
        return new Response(Uint8Array.from([1, 2, 3]), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        });
      },
    });

    expect(seenRequests).toHaveLength(1);
    const seen = seenRequests[0]!;
    expect(seen.url.origin).toBe('https://dapi.kakao.com');
    expect(seen.url.pathname).toBe('/v2/maps/staticmap');
    expect(seen.url.searchParams.get('center')).toBe('127.1105,37.3955');
    expect(seen.url.searchParams.get('markers')).toBe('location:127.1105,37.3955|option:false');
    expect(seen.url.searchParams.get('size')).toBe('640x320');
    expect(seen.authorization).toBe('KakaoAK server-secret');
    expect(map.contentType).toBe('image/jpeg');
    expect([...map.body]).toEqual([1, 2, 3]);
  });

  it('rejects non-image responses', async () => {
    await expect(
      fetchKakaoStaticMap({
        restApiKey: 'server-secret',
        lat: 37.3955,
        lng: 127.1105,
        fetchImpl: async () =>
          new Response('oops', {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      })
    ).rejects.toThrow('non-image');
  });
  it('aborts a slow static map request at the configured timeout', async () => {
    await expect(
      fetchKakaoStaticMap({
        restApiKey: 'server-secret',
        lat: 37.3955,
        lng: 127.1105,
        timeoutMs: 1,
        fetchImpl: async (_input, init) =>
          await new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal;
            if (!signal) {
              reject(new Error('missing timeout signal'));
              return;
            }
            if (signal.aborted) {
              reject(signal.reason);
              return;
            }
            signal.addEventListener('abort', () => reject(signal.reason), { once: true });
          }),
      })
    ).rejects.toMatchObject({ name: 'TimeoutError' });
  });

});
