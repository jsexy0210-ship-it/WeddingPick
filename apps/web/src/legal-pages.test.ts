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
   * 상담 녹음을 받기 전에 방침이 먼저 말해야 하는 것.
   *
   * **고지가 이전보다 먼저다**(개인정보보호법 제28조의8). 국외 이전 자체가 위법이 아니라
   * 고지 없이 이전하는 것이 위법이라, 이 문장들이 시행되기 전에 첫 호출을 내보내면 그
   * 구간이 통째로 미고지 이전이 된다.
   *
   * 사용자에게 한 약속도 여기서 지켜진다 — **녹취록을 만들지 않는다**와 **원본을 바로
   * 지운다**는 화면 동의문에도 적히는 말이고, 방침과 어긋나면 어느 쪽이 맞는지 알 수 없다.
   */
  it('상담 녹음의 위탁·수집·파기를 방침이 먼저 적는다', () => {
    const html = renderPrivacyPage();

    // 수탁자 — 누가 읽어내는지
    expect(html).toContain('Google LLC');
    expect(html).toContain('음성 인식·상담내용 분석');

    // 수집 항목 — 무엇을 받는지
    expect(html).toContain('상담 녹음 파일');

    // 파기 — 언제 지우는지. 「끝나면 지운다」만 적으면 안 끝난 파일이 영원히 남는다.
    expect(html).toContain('읽어내기가 끝나는 즉시 삭제');
    expect(html).toContain('업로드 시점부터 24시간을 넘겨 보관하지 않습니다');

    // 녹취록을 만들지 않는다 — 담을 칸 자체가 없다는 약속
    expect(html).toContain('녹취록은 만들지');
    expect(html).toContain('전화번호·계좌번호·카드번호·주민등록번호를 담는 항목 자체를 두지 않습니다');
  });

  /**
   * 국외 이전 표의 「국가」는 **서버 리전**이다.
   *
   * 2026-09-11까지 이 표는 Neon을 「미국」으로 적고 있었다. Neon, Inc.는 미국 사업자지만
   * 서비스 정보는 AWS 싱가포르에 있다(`docs/INFRA_ACCESS_AUDIT_2026-09-10.md`). 법이 묻는
   * 것은 회사가 어디에 있느냐가 아니라 정보가 어디로 가느냐다.
   *
   * 2026-09-13 콘솔 확인에서는 기존 API가 Ohio, 백그라운드 워커가 Oregon이었고 방침도 그렇게
   * 적었다. **2026-09-14에 그 둘이 없어졌다** — 미국 서비스를 지웠고, 워커 프로세스는 배포된
   * 적이 없어 루프가 운영 API 프로세스 안에서 돈다(`apps/api/src/index.ts` startWorkerLoops).
   * 그래서 Render 쪽에 남은 미국 리전은 정적 웹 전송망뿐이다.
   *
   * **낡은 문장을 지키던 시험이라 같이 고쳤다.** 방침이 사실과 어긋나면 그것이 곧 미고지다 —
   * 시험이 거짓을 지키고 있으면 고치려 할 때마다 빨개져서 되돌리게 된다.
   *
   * 회사 소재지와 실제 처리 리전은 계속 구분한다.
   *
   * 리전을 다시 옮길 때에는 이 값과 방침과 `docs/render-region-move.md`를 함께 고친다.
   */
  it('국외 이전 표에 수탁자별 서버 리전을 적는다', () => {
    const html = renderPrivacyPage();
    const table = html.match(/<table class="sp-policy-table" aria-label="5\. 개인정보의 국외 이전">[\s\S]*?<\/table>/)?.[0];
    expect(table).toBeDefined();
    const row = (needle: string) =>
      table!.split('</tr>').find(part => part.includes(needle)) ?? '';

    for (const vendor of ['neon.tech', 'privacy@render.com']) {
      expect(row(vendor)).toContain('싱가포르');
      expect(row(vendor)).not.toContain('미국 ·');
    }
    expect(row('privacy@render.com')).toContain('싱가포르(운영 API 및 백그라운드 처리)');
    expect(row('privacy@render.com')).toContain('전 세계(정적 웹 전송망');
    // 미국에 남은 API·워커는 없다. 지운 것을 방침이 계속 적고 있으면 그것도 틀린 고지다.
    expect(row('privacy@render.com')).not.toContain('기존 API');

    // 자료 분석과 푸시 중계는 그대로 미국이다. 전부 싱가포르로 뭉뚱그리지 않는다.
    expect(row('privacy@anthropic.com')).toContain('미국 ·');
    expect(row('650 Industries')).toContain('미국 ·');

    /*
     * 상담 녹음을 읽어내는 이전. **이 행이 없으면 첫 호출이 곧 미고지 이전이다**
     * (개인정보보호법 제28조의8 — 고지가 이전보다 먼저다).
     */
    expect(row('Google LLC')).toContain('미국 ·');
    expect(row('Google LLC')).toContain('상담 녹음');

    expect(html).toContain('이전받는 자의 사업자 소재지와 다를 수 있습니다');
    expect(html).toContain('이 처리방침 시행일부터 Render의 운영 API와 Neon의 정보 저장소는 싱가포르 리전을 사용하며');
  });
});
