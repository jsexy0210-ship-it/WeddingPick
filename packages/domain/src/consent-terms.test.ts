import { POLICY_DOCUMENTS } from './policies';
import { PRIVACY_POLICY_TAB_KEY, TERMS_POPUP_TABS, TERM_DOCUMENTS } from './consent-terms';

describe('약관 상세 풀팝업 탭(WP-AUTH-011)', () => {
  it('정본 6탭을 순서 그대로 두고 «개인정보처리방침»을 이용약관 뒤에 더한다(2026-09-26)', () => {
    expect(TERMS_POPUP_TABS.map((tab) => tab.tab)).toEqual([
      '이용약관',
      '개인정보처리방침',
      '개인정보',
      'Pick 인증',
      '상담 녹음',
      '제3자 제공',
      '혜택 알림',
    ]);
    expect(TERMS_POPUP_TABS.filter((tab) => tab.key !== PRIVACY_POLICY_TAB_KEY).map((tab) => tab.key)).toEqual(
      TERM_DOCUMENTS.map((doc) => doc.key)
    );
  });

  it('개인정보처리방침 탭은 조문 사본을 들지 않는다 — 웹사이트 원문 주소가 있다', () => {
    expect(TERM_DOCUMENTS.some((doc) => (doc.key as string) === PRIVACY_POLICY_TAB_KEY)).toBe(false);
    expect(POLICY_DOCUMENTS.find((doc) => doc.id === 'privacy')?.url).toMatch(/\/privacy\.html$/);
  });
});
