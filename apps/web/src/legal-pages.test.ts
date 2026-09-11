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

  /**
   * 국외 이전 표의 「국가」는 **서버 리전**이다.
   *
   * 2026-09-11까지 이 표는 Neon을 「미국」으로 적고 있었다. Neon, Inc.는 미국 사업자지만
   * 서비스 정보는 AWS 싱가포르에 있다(`docs/INFRA_ACCESS_AUDIT_2026-09-10.md`). 법이 묻는
   * 것은 회사가 어디에 있느냐가 아니라 정보가 어디로 가느냐다.
   *
   * 이 시험은 다음 사람이 「회사가 미국이니까」로 조용히 되돌리지 못하게 막는다. 리전을
   * 실제로 옮길 때에는 이 값과 방침을 함께 고친다.
   */
  it('국외 이전 표에 수탁자별 서버 리전을 적는다', () => {
    const html = renderPrivacyPage();
    const table = html.match(/<table class="sp-policy-table" aria-label="5\. 개인정보의 국외 이전">[\s\S]*?<\/table>/)?.[0];
    expect(table).toBeDefined();
    const row = (needle: string) =>
      table!.split('</tr>').find(part => part.includes(needle)) ?? '';

    expect(row('neon.tech')).toContain('싱가포르');
    expect(row('neon.tech')).not.toContain('미국 ·');
    expect(row('privacy@render.com')).toContain('미국');
    expect(html).toContain('이전받는 자의 사업자 소재지와 다를 수 있습니다');
  });
});
