import { SITE_ORIGIN } from '@weddingpick/domain';

import { isOurSite } from './our-site';

describe('앱 안의 껍데기로 감쌀 주소', () => {
  it('약관 전문은 우리 사이트다 — 껍데기로 감싼다', () => {
    expect(isOurSite(`${SITE_ORIGIN}/terms.html`)).toBe(true);
  });

  it('개인정보처리방침도 같다', () => {
    expect(isOurSite(`${SITE_ORIGIN}/privacy.html`)).toBe(true);
  });

  /*
   * 남의 사이트는 감싸지 않는다 — 거절당해도 알아낼 방법이 없어서 빈 칸만
   * 남는다(`our-site.ts`에 실측 근거). 새 탭으로 열고 알린다.
   */
  it('박람회 신청 페이지는 남의 사이트다', () => {
    expect(isOurSite('https://expo.example.co.kr/apply')).toBe(false);
  });

  it('카카오 지도는 남의 사이트다', () => {
    expect(isOurSite('https://map.kakao.com/?q=%EC%98%88%EC%8B%9D%EC%9E%A5')).toBe(false);
  });

  /** 호스트가 같아도 스킴이 다르면 다른 출처다 — 가로채기가 끼어들 자리다. */
  it('스킴이 다르면 우리 사이트가 아니다', () => {
    expect(isOurSite(SITE_ORIGIN.replace('https://', 'http://'))).toBe(false);
  });

  it('출처가 없는 스킴은 우리 사이트가 아니다', () => {
    expect(isOurSite('data:text/calendar;charset=utf-8,BEGIN')).toBe(false);
  });

  it('읽을 수 없는 주소는 우리 사이트가 아니다', () => {
    expect(isOurSite('/terms.html')).toBe(false);
  });
});
