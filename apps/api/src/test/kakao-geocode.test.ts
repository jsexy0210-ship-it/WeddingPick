import { geocodeKakaoAddress } from '../kakao-static-map';

describe('geocodeKakaoAddress', () => {
  it('converts an allowed vendor address to coordinates without persisting the response', async () => {
    const seenRequests: Array<{ url: URL; authorization: string | null }> = [];

    const coordinates = await geocodeKakaoAddress({
      restApiKey: 'server-secret',
      address: '서울 강남구 도산대로 123',
      fetchImpl: async (input, init) => {
        seenRequests.push({
          url: new URL(String(input)),
          authorization: new Headers(init?.headers).get('authorization'),
        });
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

    expect(seenRequests).toHaveLength(1);
    const seen = seenRequests[0]!;
    expect(seen.url.origin).toBe('https://dapi.kakao.com');
    expect(seen.url.pathname).toBe('/v2/local/search/address.json');
    expect(seen.url.searchParams.get('query')).toBe('서울 강남구 도산대로 123');
    expect(seen.authorization).toBe('KakaoAK server-secret');
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
