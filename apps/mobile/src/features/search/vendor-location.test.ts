/** 업체 위치 UI의 회귀 가드. 네이티브 UI를 띄우지 않고 실제 소스의 필수 경계를 확인한다. */

declare const require: (id: string) => unknown;
declare const __dirname: string;

const nodeRequire = require;
const { readFileSync } = nodeRequire('fs') as {
  readFileSync: (path: string, encoding: string) => string;
};
const { join } = nodeRequire('path') as { join: (...parts: string[]) => string };

const source = readFileSync(join(__dirname, 'vendor-location.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('업체 위치 UI', () => {
  it('정적 지도는 웨딩픽 API를 거치고 Kakao secret을 앱에 넣지 않는다', () => {
    expect(source).toContain('API_URL');
    expect(source).toContain('/v1/vendors/');
    expect(source).toContain('/static-map');
    expect(source).not.toContain('KakaoAK');
    expect(source).not.toContain('KAKAO_APP_KEY');
  });

  it('깨진 지도 이미지를 숨기고 로딩·실패 상태를 구분한다', () => {
    expect(source).toContain('onLoad={() => setMapLoaded(true)}');
    expect(source).toContain('onError={() => setMapFailed(true)}');
    expect(source).toContain('mapUri && !mapFailed');
    expect(source).toContain('지도를 불러오는 중이에요');
    expect(source).toContain('지도 이미지를 불러오지 못했어요');
  });

  it('위치가 없으면 임의 좌표 대신 빈 상태와 지도 검색을 쓴다', () => {
    expect(source).toContain('위치 정보가 아직 없어요');
    expect(source).toContain("hasMapSource ? '지도에서 보기' : '지도에서 검색'");
    expect(source).toContain('map.kakao.com/link/search/');
  });

  it('지도 handoff가 실패하면 HTTPS 웹 경로로 fallback한다', () => {
    expect(source).toContain("openExternal(mapUrl, { handOff: true })");
    expect(source).toContain("openExternal(mapUrl, { title: '지도' })");
  });

  it('주소는 줄임 없이 선택 가능하고 주소 복사를 제공한다', () => {
    expect(source).toContain('selectable');
    expect(source).toContain('Clipboard.setStringAsync(normalizedAddress)');
    expect(source).toContain('주소 복사');
    expect(source).toContain('복사됨');
    expect(source).not.toContain('numberOfLines=');
  });

  it('지도와 복사 동작에 접근성 라벨이 있다', () => {
    expect(source).toContain('accessibilityLabel={mapActionLabel}');
    expect(source).toContain('accessibilityLabel="주소 복사"');
    expect(source).toContain('accessibilityLiveRegion="polite"');
  });
});

export {};
