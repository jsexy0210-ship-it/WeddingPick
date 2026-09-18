type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type KakaoStaticMap = {
  body: Buffer;
  contentType: string;
};

export type KakaoMapCoordinates = {
  lat: number;
  lng: number;
};

/**
 * 저장된 공식/허용 주소를 카카오 좌표로 잠깐 바꾼다.
 *
 * 통합정책 N-9 때문에 이 결과는 DB에 저장하지 않는다. 정적 지도 한 장을 만드는
 * 현재 요청 안에서만 사용한다.
 */
export async function geocodeKakaoAddress({
  restApiKey,
  address,
  fetchImpl = fetch,
}: {
  restApiKey: string;
  address: string;
  fetchImpl?: FetchLike;
}): Promise<KakaoMapCoordinates | null> {
  const url = new URL('https://dapi.kakao.com/v2/local/search/address.json');
  url.searchParams.set('query', address);

  const response = await fetchImpl(url, {
    headers: {
      authorization: `KakaoAK ${restApiKey}`,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Kakao address geocode failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    documents?: Array<{ x?: string; y?: string }>;
  };
  const first = payload.documents?.[0];
  if (!first?.x || !first.y) return null;

  const lng = Number(first.x);
  const lat = Number(first.y);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}

/**
 * 카카오 정적 지도 REST API를 서버에서 호출한다.
 *
 * 정적 지도 인증 헤더는 서버가 조립한다. 모바일/웹은 웨딩픽 API의 이미지 프록시만 본다.
 */
export async function fetchKakaoStaticMap({
  restApiKey,
  lat,
  lng,
  fetchImpl = fetch,
}: {
  restApiKey: string;
  lat: number;
  lng: number;
  fetchImpl?: FetchLike;
}): Promise<KakaoStaticMap> {
  const url = new URL('https://dapi.kakao.com/v2/maps/staticmap');
  url.searchParams.set('center', `${lng},${lat}`);
  url.searchParams.set('markers', `location:${lng},${lat}|option:false`);
  url.searchParams.set('size', '640x320');
  url.searchParams.set('format', 'jpg');
  url.searchParams.set('scale', '2');
  url.searchParams.set('lv', '3');

  const response = await fetchImpl(url, {
    headers: {
      authorization: `KakaoAK ${restApiKey}`,
      accept: 'image/jpeg,image/png',
    },
  });

  if (!response.ok) {
    throw new Error(`Kakao static map failed: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    throw new Error(`Kakao static map returned non-image content: ${contentType}`);
  }

  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType,
  };
}
