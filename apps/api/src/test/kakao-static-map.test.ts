import { fetchKakaoStaticMap, geocodeKakaoAddress } from '../kakao-static-map';

describe('geocodeKakaoAddress', () => {
  it('uses the address API and returns transient coordinates', async () => {
    let seenUrl: URL | null = null;
    let seenAuthorization: string | null = null;

    const coordinates = await geocodeKakaoAddress({
      restApiKey: 'server-key',
      address: '경기 성남시 분당구 판교역로 166',
      fetchImpl: async (input, init) => {
        seenUrl = new URL(String(input));
        seenAuthorization = new Headers(init?.headers).get('authorization');
        return new Response(
          JSON.stringify({ documents: [{ x: '127.1105', y: '37.3955' }] }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      },
    });

    expect(seenUrl?.pathname).toBe('/v2/local/search/address.json');
    expect(seenUrl?.searchParams.get('query')).toBe('경기 성남시 분당구 판교역로 166');
    expect(seenAuthorization).toBe('KakaoAK server-key');
    expect(coordinates).toEqual({ lat: 37.3955, lng: 127.1105 });
  });

  it('returns null when Kakao cannot resolve the address', async () => {
    await expect(
      geocodeKakaoAddress({
        restApiKey: 'server-key',
        address: '찾을 수 없는 주소',
        fetchImpl: async () =>
          new Response(JSON.stringify({ documents: [] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      })
    ).resolves.toBeNull();
  });
});

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
