import { renderPrivacyPage, renderTermsPage } from './subpages';

describe('공개 법적 문서', () => {
  it('표의 각 값에 열 제목과 행 제목을 제공한다', () => {
    const html = renderPrivacyPage();
    expect(html.match(/class="sp-policy-table"/g)).toHaveLength(3);
    expect(html).toContain('<th scope="col">보유기간</th>');
    expect(html).toContain('<th scope="row">');
    expect(html).not.toContain('width:230px;flex:0 0 auto');
  });

  it.each([renderTermsPage, renderPrivacyPage])('목차 링크마다 본문 목적지가 있다', render => {
    const html = render();
    const links = [...html.matchAll(/href="#((?:article|ps)-\d+)"/g)];
    expect(links.length).toBeGreaterThan(10);
    for (const [, id] of links) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('<summary>목차 보기</summary>');
  });

  it('외부 사본의 보유기간과 기능별 거부 효과를 구분한다', () => {
    const html = renderPrivacyPage();
    expect(html).toContain('회사 저장소의 원본 삭제 일정과는 별도');
    expect(html).toContain('기본 서비스 이용을 제한하지 않습니다');
    expect(html).not.toContain('기관명·연락처는 시행 시점');
    expect(html).toContain('href="https://privacy.kisa.or.kr"');
  });
});
