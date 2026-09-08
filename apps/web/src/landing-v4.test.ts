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
  it('출시 전 다운로드나 가상의 업체 정보를 약속하지 않는다', () => {
    const html = renderLandingV4();
    expect(html).toContain('웨딩픽 출시 준비 중이에요');
    expect(html).not.toContain('App Store');
    expect(html).not.toContain('Google Play');
    expect(html).not.toMatch(/서비스 사용 예시|실제 업체 정보가 아니에요|설명을 위한 예시|이용 요금|요금제/);
    expect(html).toContain('시기와 포함 항목에 따라 달라질 수 있어요');
    expect(html).not.toMatch(/스튜디오 [ABC]|152~184|실 제보 12건|5월 16일/);
  });

  it('API 주소가 없어도 데이터 대신 기능 안내를 보여준다', () => {
    const before = process.env[API_URL_ENV];

    delete process.env[API_URL_ENV];

    try {
      const html = renderLandingV4();

      expect(html).toContain('마음에 드는 스튜디오');
      expect(html).toContain('금액과 포함 항목');
      expect(html).toContain('제보 건수와 기준 기간도 함께 확인해요');

      /* 기능 2 — 3곳 비교. */
      expect(html).toContain('한눈에 살펴볼 비교 항목');
      expect(html).toContain('계약 조건');

      /* 기능 3 — 둘이 함께 고른 Pick. */
      expect(html).toContain('함께 마음에 든 곳');
      expect(html).toContain('내가 관심 있는 곳');
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
