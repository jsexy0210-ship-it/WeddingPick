import { renderLandingV4 } from './landing-v4';
import { API_URL_ENV } from './site-data';

/**
 * 랜딩은 검색으로 처음 들어온 사람이 보는 화면이다. 서버가 자거나 빌드 때
 * API 주소가 비어 있어도 «정보를 모으는 중»이 되면 안 된다 — 실제 업체 정보를
 * 받아 쓰는 화면(`search.html`·업체 상세)과 경로를 나눠 둔 이유가 이것이다.
 *
 * 그 분리는 코드를 읽어야만 알 수 있어서 쉽게 깨진다. 여기서 못 박는다.
 */
describe('서비스 웹 — 랜딩', () => {
  it('API 주소가 없어도 업체 정보가 그대로 나온다', () => {
    const before = process.env[API_URL_ENV];

    delete process.env[API_URL_ENV];

    try {
      const html = renderLandingV4();

      /* 기능 1 — 오늘의 Pick. 이름·구간·건수·추천 이유가 모두 있어야 한다. */
      expect(html).toContain('강남 A 스튜디오');
      expect(html).toContain('152~184만원');
      expect(html).toContain('확인된 정보 12건 · 최근 12개월 · 기준금액 168만원');
      expect(html).toContain('고른 사진이랑 가장 비슷해요');

      /* 기능 2 — 3곳 비교. */
      expect(html).toContain('스튜디오 3곳 비교');
      expect(html).toContain('보정 장수');

      /* 기능 3 — 둘이 함께 고른 Pick. */
      expect(html).toContain('서촌 B 스튜디오');
      expect(html).toContain('청담 C 스튜디오');
      expect(html).toContain('둘 다 고른 곳');

      /* 데이터가 없을 때 다른 화면이 쓰는 말이 랜딩에 새어 나오면 안 된다. */
      expect(html).not.toContain('정보를 모으는 중');
    } finally {
      if (before === undefined) delete process.env[API_URL_ENV];
      else process.env[API_URL_ENV] = before;
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
