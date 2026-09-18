import { fetchKakaoStaticMap } from '../kakao-static-map';

describe('fetchKakaoStaticMap', () => {
  it('builds an authenticated request with a marker at the vendor coordinates', async () => {
    let seenUrl: URL | null = null;
    let seenAuthorization: string | null = null;

    const map = await fetchKakaoStaticMap({
      restApiKey: 'server-secret',
      lat: 37.3955,
      lng: 127.1105,
      fetchImpl: async (input, init) => {
        seenUrl = new URL(String(input));
        seenAuthorization = new Headers(init?.headers).get('authorization');
        return new Response(Uint8Array.from([1, 2, 3]), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        });
      },
    });

    expect(seenUrl?.origin).toBe('https://dapi.kakao.com');
    expect(seenUrl?.pathname).toBe('/v2/maps/staticmap');
    expect(seenUrl?.searchParams.get('center')).toBe('127.1105,37.3955');
    expect(seenUrl?.searchParams.get('markers')).toBe('location:127.1105,37.3955|option:false');
    expect(seenUrl?.searchParams.get('size')).toBe('640x320');
    expect(seenAuthorization).toBe('KakaoAK server-secret');
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
});
