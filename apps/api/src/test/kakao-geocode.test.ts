import { geocodeKakaoAddress } from '../kakao-static-map';

describe('geocodeKakaoAddress', () => {
  it('converts an allowed vendor address to coordinates without persisting the response', async () => {
    let seenUrl: URL | null = null;
    let seenAuthorization: string | null = null;

    const coordinates = await geocodeKakaoAddress({
      restApiKey: 'server-secret',
      address: '서울 강남구 도산대로 123',
      fetchImpl: async (input, init) => {
        seenUrl = new URL(String(input));
        seenAuthorization = new Headers(init?.headers).get('authorization');
        return new Response(
          JSON.stringify({
            documents: [{ x: '127.035', y: '37.523' }],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        );
      },
    });

    expect(seenUrl?.origin).toBe('https://dapi.kakao.com');
    expect(seenUrl?.pathname).toBe('/v2/local/search/address.json');
    expect(seenUrl?.searchParams.get('query')).toBe('서울 강남구 도산대로 123');
    expect(seenAuthorization).toBe('KakaoAK server-secret');
    expect(coordinates).toEqual({ lat: 37.523, lng: 127.035 });
  });

  it('returns null when Kakao has no matching address', async () => {
    const coordinates = await geocodeKakaoAddress({
      restApiKey: 'server-secret',
      address: '검색되지 않는 주소',
      fetchImpl: async () =>
        new Response(JSON.stringify({ documents: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    });

    expect(coordinates).toBeNull();
  });

  it('rejects an upstream HTTP failure', async () => {
    await expect(
      geocodeKakaoAddress({
        restApiKey: 'server-secret',
        address: '서울 강남구',
        fetchImpl: async () => new Response('rate limited', { status: 429 }),
      })
    ).rejects.toThrow('HTTP 429');
  });
});
