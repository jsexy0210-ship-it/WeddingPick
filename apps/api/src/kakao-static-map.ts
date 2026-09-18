type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type KakaoStaticMap = {
  body: Buffer;
  contentType: string;
};

/**
 * 카카오 정적 지도 REST API를 서버에서 호출한다.
 *
 * REST API 키는 앱으로 내보내지 않는다. 모바일/웹은 웨딩픽 API의 이미지 프록시만 본다.
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
