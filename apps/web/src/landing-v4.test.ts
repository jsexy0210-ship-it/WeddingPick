import { renderLandingV4 } from './landing-v4';
import { API_URL_ENV } from './site-data';
import { renderFaqPage, renderIntroPage, renderSupportPage } from './subpages';

/**
 * 랜딩은 검색으로 처음 들어온 사람이 보는 화면이다. 서버가 자거나 빌드 때
 * API 주소가 비어 있어도 «정보를 모으는 중»이 되면 안 된다 — 실제 업체 정보를
 * 받아 쓰는 화면(`search.html`·업체 상세)과 경로를 나눠 둔 이유가 이것이다.
 *
 * 그 분리는 코드를 읽어야만 알 수 있어서 쉽게 깨진다. 여기서 못 박는다.
 */
describe('서비스 웹 — 랜딩', () => {
  it('출시 전 다운로드를 약속하지 않고 예시와 실제 정보를 구분한다', () => {
    const html = renderLandingV4();
    expect(html).toContain('웨딩픽 출시 준비 중이에요');
    expect(html).not.toContain('App Store');
    expect(html).not.toContain('Google Play');
    expect(html.match(/실제 업체 정보가 아니에요/g)).toHaveLength(3);
    expect(html).toContain('현재 판매가격을 보장하지 않아요');
  });

  it('API 주소가 없어도 업체 정보가 그대로 나온다', () => {
    const before = process.env[API_URL_ENV];

    delete process.env[API_URL_ENV];

    try {
      const html = renderLandingV4();

      /* 기능 1 — 오늘의 Pick. 이름·구간·건수·추천 이유가 모두 있어야 한다. */
      expect(html).toContain('스튜디오 A');
      expect(html).toContain('152~184만원');
      expect(html).toContain('실 제보 12건 · 최근 12개월 · 기준금액 168만원');
      expect(html).toContain('고른 사진이랑 가장 비슷해요');

      /* 기능 2 — 3곳 비교. */
      expect(html).toContain('스튜디오 3곳 비교');
      expect(html).toContain('보정 장수');

      /* 기능 3 — 둘이 함께 고른 Pick. */
      expect(html).toContain('스튜디오 B');
      expect(html).toContain('스튜디오 C');
      expect(html).toContain('둘 다 고른 곳');

      /* 데이터가 없을 때 다른 화면이 쓰는 말이 랜딩에 새어 나오면 안 된다. */
      expect(html).not.toContain('정보를 모으는 중');
    } finally {
      if (before === undefined) delete process.env[API_URL_ENV];
      else process.env[API_URL_ENV] = before;
    }
  });

  it('모든 공개 소개 페이지가 동일한 출시 동선을 쓰고 가짜 제출 폼을 노출하지 않는다', () => {
    for (const html of [renderIntroPage(), renderFaqPage(), renderSupportPage()]) {
      expect(html).toContain('href="/#download"');
      expect(html).not.toContain('앱 다운로드');
      expect(html).not.toContain('action="mailto:');
      expect(html).not.toContain('27개');
    }
  });

  it('API 주소가 있든 없든 같은 화면을 만든다', () => {
    const before = process.env[API_URL_ENV];

    try {
      delete process.env[API_URL_ENV];
      const without = renderLandingV4();

      process.env[API_URL_ENV] = 'https://example.invalid';
      const with_ = renderLandingV4();

      expect(with_).toEqual(without);
    } finally {
      if (before === undefined) delete process.env[API_URL_ENV];
      else process.env[API_URL_ENV] = before;
    }
  });
});
