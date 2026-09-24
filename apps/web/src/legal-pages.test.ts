import { renderPrivacyPage, renderTermsPage } from './subpages';
import type { LegalDocument } from './legal-data';

/**
 * **그리는 법**을 보는 자리다. 무엇이 적혀 있는가는 여기서 보지 않는다.
 *
 * 2026-09-16 대표 지시로 본문이 코드를 떠나 표로 갔다(0422). 그전까지 이 파일은
 * 두 가지를 한꺼번에 봤다 — 표가 제대로 그려지는가와, 방침이 국외 이전을 제대로
 * 적는가. **둘은 이제 사는 곳이 다르다.**
 *
 *     그리는 법   이 파일. 어떤 내용이 와도 표·목차·행 제목이 제대로 나오는가
 *     적힌 내용   apps/api/src/test/admin-ops-routes.test.ts 「심어 둔 방침」
 *
 * 내용 쪽을 여기 두면 대표님이 한 글자를 고칠 때마다 이 시험이 빨개진다 —
 * 고치라고 연 편집을 시험이 도로 막는 꼴이 된다. 내용은 표에 있으니 표에서 본다.
 */

const doc = (sections: LegalDocument['sections']): LegalDocument => ({
  version: 'v1.0',
  effectiveOn: '2026-10-01',
  sections,
});

const listSection = (t: string, lines: string[]) => ({ t, l: lines });

const tableSection = (t: string) => ({
  t,
  table: true,
  lead: '표 앞에 붙는 설명.',
  cols: [{ label: '이전받는 자' }, { label: '국가·목적' }, { label: '보유기간' }],
  rows: [
    ['어느 회사 · privacy@example.com', '미국 · 분석', '목적 달성 시까지'],
    ['다른 회사', '싱가포르 · 저장', '계약 종료 시까지'],
  ],
});

const manySections = (prefix: string) =>
  Array.from({ length: 12 }, (_, i) => listSection(`${prefix} ${i + 1}`, [`${i + 1}번 내용`]));

describe('공개 법적 문서', () => {
  it('표의 각 값에 열 제목과 행 제목을 제공한다', () => {
    const html = renderPrivacyPage(doc([tableSection('4. 처리위탁'), tableSection('5. 국외 이전')]));

    expect(html.match(/class="sp-policy-table"/g)).toHaveLength(2);
    expect(html).toContain('<th scope="col">보유기간</th>');
    expect(html).toContain('<th scope="row">');
    // 열 제목을 화면 폭이 좁을 때 각 칸 안에 다시 적는다 — 표가 세로로 접히기 때문이다.
    expect(html).toContain('<span class="sp-cell-label" aria-hidden="true">국가·목적</span>');
    expect(html).not.toContain('width:230px;flex:0 0 auto');
  });

  /*
   * **약관에도 표를 넣을 수 있다.** 지금 약관에는 없지만 넣는 것은 이제 대표님이
   * 고르실 수 있는 일이고, 그리는 쪽이 갈라져 있으면 그날 넣은 표가 조용히 빈 칸으로
   * 나간다 — 아무 오류도 나지 않는다.
   */
  it('약관 쪽도 표를 그린다', () => {
    const html = renderTermsPage(doc([tableSection('제9조 위탁')]));

    expect(html).toContain('class="sp-policy-table"');
    expect(html).toContain('<th scope="row">');
  });

  it.each([
    ['이용약관', renderTermsPage, manySections('제')],
    ['개인정보처리방침', renderPrivacyPage, manySections('항목')],
  ] as const)('%s의 목차 링크마다 본문 목적지가 있다', (_label, render, sections) => {
    const html = render(doc([...sections]));
    const links = [...html.matchAll(/href="#((?:article|ps)-\d+)"/g)];

    expect(links.length).toBeGreaterThan(10);
    for (const [, id] of links) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('<summary>목차 보기</summary>');
  });

  /*
   * 본문의 주소는 눌리는 링크가 된다(`legalText`). 방침의 권익침해 구제 항목이
   * 그것에 기대고 있어서, 이 변환이 빠지면 신고 창구가 글자로만 남는다.
   */
  it('본문의 주소를 링크로 만든다', () => {
    const html = renderPrivacyPage(
      doc([listSection('12. 권익침해 구제', ['개인정보침해 신고센터: https://privacy.kisa.or.kr'])])
    );

    expect(html).toContain('href="https://privacy.kisa.or.kr"');
  });

  it('이용자에게 시행일과 버전을 표시하지 않는다', () => {
    const terms = renderTermsPage({
      version: 'v2.0',
      effectiveOn: '2026-10-01',
      sections: [listSection('제1조 목적', ['내용'])],
    });
    const privacy = renderPrivacyPage(doc([listSection('수집 항목', ['내용'])]));

    for (const html of [terms, privacy]) {
      expect(html).not.toContain('시행일 2026년 10월 1일');
      expect(html).not.toContain('v2.0');
    }
  });
});
