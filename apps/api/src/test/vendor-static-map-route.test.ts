import { createTestApp, resetDatabase, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const originalFetch = global.fetch;

async function createVendor(input: {
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}) {
  const { rows } = await test.pool.query<{ id: string }>(
    `INSERT INTO structured.vendors (category, name, region, source, address, lat, lng)
     VALUES ('hall', $1, '서울 강남구', 'public_data', $2, $3, $4)
     RETURNING id`,
    [input.name, input.address ?? null, input.lat ?? null, input.lng ?? null]
  );

  return rows[0]!.id;
}

describeWithDb('업체 정적 지도 라우트', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await test?.close();
  });

  beforeEach(async () => {
    await resetDatabase();
    test.context.config.kakaoAppKey = undefined;
    global.fetch = originalFetch;
  });

  afterEach(() => {
    test.context.config.kakaoAppKey = undefined;
    global.fetch = originalFetch;
  });

  it('주소와 좌표가 모두 없으면 외부 API를 부르지 않고 404다', async () => {
    const vendorId = await createVendor({ name: '위치없는홀' });
    let called = false;
    global.fetch = (async () => {
      called = true;
      throw new Error('외부 API를 부르면 안 된다');
    }) as typeof fetch;

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}/static-map`,
    });

    expect(response.statusCode).toBe(404);
    expect(called).toBe(false);
  });

  it('저장 좌표가 있으면 지오코딩 없이 정적 지도만 호출한다', async () => {
    const vendorId = await createVendor({
      name: '좌표있는홀',
      lat: 37.523,
      lng: 127.035,
    });
    test.context.config.kakaoAppKey = 'server-secret';

    const paths: string[] = [];
    global.fetch = (async (input: string | URL) => {
      const url = new URL(String(input));
      paths.push(url.pathname);

      return new Response(Uint8Array.from([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      });
    }) as typeof fetch;

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}/static-map`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('image/jpeg');
    expect(response.headers['cache-control']).toBe(
      'public, max-age=86400, stale-while-revalidate=604800'
    );
    expect(paths).toEqual(['/v2/maps/staticmap']);
  });

  it('좌표 없이 주소만 있으면 요청 중에만 지오코딩하고 DB에는 저장하지 않는다', async () => {
    const vendorId = await createVendor({
      name: '주소만있는홀',
      address: '서울 강남구 도산대로 123',
    });
    test.context.config.kakaoAppKey = 'server-secret';

    const paths: string[] = [];
    global.fetch = (async (input: string | URL) => {
      const url = new URL(String(input));
      paths.push(url.pathname);

      if (url.pathname === '/v2/local/search/address.json') {
        return new Response(
          JSON.stringify({ documents: [{ x: '127.035', y: '37.523' }] }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (url.pathname === '/v2/maps/staticmap') {
        return new Response(Uint8Array.from([4, 5, 6]), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        });
      }

      throw new Error(`예상하지 못한 Kakao 경로: ${url.pathname}`);
    }) as typeof fetch;

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}/static-map`,
    });

    expect(response.statusCode).toBe(200);
    expect(paths).toEqual(['/v2/local/search/address.json', '/v2/maps/staticmap']);

    const stored = await test.pool.query<{ lat: number | null; lng: number | null }>(
      'SELECT lat, lng FROM structured.vendors WHERE id = $1',
      [vendorId]
    );
    expect(stored.rows[0]).toEqual({ lat: null, lng: null });
  });

  it('주소 지오코딩 upstream 오류는 500이 아니라 502다', async () => {
    const vendorId = await createVendor({
      name: '지도장애홀',
      address: '서울 강남구 도산대로 123',
    });
    test.context.config.kakaoAppKey = 'server-secret';

    global.fetch = (async () => new Response('rate limited', { status: 429 })) as typeof fetch;

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/vendors/${vendorId}/static-map`,
    });

    expect(response.statusCode).toBe(502);
  });
});
