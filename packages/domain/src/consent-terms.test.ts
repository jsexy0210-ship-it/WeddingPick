import { PRIVACY_POLICY_TAB_KEY, TERMS_POPUP_TABS, TERM_DOCUMENTS } from './consent-terms';

describe('약관 상세 풀팝업 탭(WP-AUTH-011)', () => {
  it('정본 6탭을 순서 그대로 두고 «개인정보처리방침»을 이용약관 뒤에 더한다(2026-09-26)', () => {
    expect(TERMS_POPUP_TABS.map((tab) => tab.tab)).toEqual([
      '이용약관',
      '개인정보처리방침',
      '개인정보',
      'Pick인증',
      '상담녹음',
      '제3자제공',
      '혜택알림',
    ]);
    expect(TERMS_POPUP_TABS.filter((tab) => tab.key !== PRIVACY_POLICY_TAB_KEY).map((tab) => tab.key)).toEqual(
      TERM_DOCUMENTS.map((doc) => doc.key)
    );
  });

  it('개인정보처리방침 탭은 조문 사본을 들지 않는다', () => {
    expect(TERM_DOCUMENTS.some((doc) => (doc.key as string) === PRIVACY_POLICY_TAB_KEY)).toBe(false);
    expect(TERM_DOCUMENTS[0]?.title).toBe('서비스이용약관');
  });
});
