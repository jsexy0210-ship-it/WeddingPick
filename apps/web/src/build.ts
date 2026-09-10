import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderHomePage } from './home-page';
import { renderLandingV4 } from './landing-v4';
import { renderLandingPage } from './page';
import { apiBase, loadSiteData, loadVendor, vendorIdsToBuild } from './site-data';
import { renderFaqPage, renderIntroPage, renderPrivacyPage, renderSupportPage, renderTermsPage } from './subpages';
import { STYLES } from './styles';
import { validateLegalDates } from './legal-config';
import { renderVendorPage } from './vendor-page';

/**
 * 웹을 만든다.
 *
 * 프레임워크도 런타임 자바스크립트도 없다. 검색으로 들어온 사람에게 필요한 것은
 * 글과 링크와 검색칸뿐이고, 자바스크립트를 켜지 않아도 읽히고 눌려야 한다.
 * CSS는 한 파일에 담아 인라인으로 넣는다.
 *
 * | 나오는 것 | 무엇 |
 * |---|---|
 * | `index.html` | 랜딩 v4. 서비스 마케팅 메인 |
 * | `search.html` | WP-WEB-001 홈. 검색과 제보 금액 |
 * | `intro.html` | 서비스 소개 |
 * | `faq.html` | 자주 묻는 질문 |
 * | `support.html` | 고객지원 |
 * | `terms.html` | 이용약관 |
 * | `privacy.html` | 개인정보처리방침 |
 * | `v/<업체 id>.html` | WP-WEB-003 업체 상세 |
 * | `about.html` | 서비스 소개 한 장. 약관·출처·분석 안내가 여기 있다 |
 *
 * **소개 한 장을 지우지 않고 `about.html`로 남긴다.** `POLICY_DOCUMENTS`의 분석
 * 안내가 그 문서 안(`#analysis-notice`)을 가리키고, 앱 정책 화면도 같은 것을
 * 본다 — 없애면 앱에서 여는 링크가 끊긴다.
 *
 * 업체·금액은 API에서 온다. `WEDDINGPICK_API_URL`이 없으면 홈은 «정보를 모으는
 * 중이에요»로 나오고 업체 상세는 아예 만들어지지 않는다 — 예시 숫자를 채운 화면을
 * 내보내는 것보다 낫다.
 */
export async function build(outDir: string): Promise<string> {
  // 잘못된 시행일이면 기존 산출물을 지우기 전에 중단한다.
  validateLegalDates();
  /*
   * 먼저 비운다. 안 비우면 **지운 페이지가 계속 서빙된다** — 이 함수는 쓰기만 하고
   * 지우지 않아서, 예전 빌드가 남긴 파일이 그대로 남는다. 2026-09-09에 `admin.html`을
   * 없앴는데 `dist/admin.html`이 남아 테스트가 그것을 집어 든 것이 그 증상이다.
   * 빌드 산출물 전용 디렉터리라 통째로 지워도 잃을 것이 없다.
   */
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  // Copy public assets (favicons, manifest, etc.)
  const publicDir = join(__dirname, '..', 'public');
  cpSync(publicDir, outDir, { recursive: true, force: true });

  // Landing v4 is the new root
  const indexPath = join(outDir, 'index.html');
  writeFileSync(indexPath, renderLandingV4(), 'utf8');

  // Home/search page moved to search.html
  writeFileSync(join(outDir, 'search.html'), renderHomePage(await loadSiteData()), 'utf8');

  // Sub-pages
  writeFileSync(join(outDir, 'intro.html'), renderIntroPage(), 'utf8');
  writeFileSync(join(outDir, 'faq.html'), renderFaqPage(), 'utf8');
  writeFileSync(join(outDir, 'support.html'), renderSupportPage(), 'utf8');
  writeFileSync(join(outDir, 'terms.html'), renderTermsPage(), 'utf8');
  writeFileSync(join(outDir, 'privacy.html'), renderPrivacyPage(), 'utf8');

  writeFileSync(join(outDir, 'about.html'), renderLandingPage(STYLES), 'utf8');

  const ids = vendorIdsToBuild();

  if (ids.length > 0) {
    const vendorDir = join(outDir, 'v');

    mkdirSync(vendorDir, { recursive: true });

    for (const id of ids) {
      const vendor = await loadVendor(id);

      /*
       * 못 읽은 업체는 넘어간다. 이름 없는 상세 화면을 만들어두면 검색엔진이
       * 그것을 먼저 읽고, 사람이 들어와서 볼 것이 없다.
       */
      if (!vendor) {
        console.warn(`업체 ${id}: 읽지 못해 상세를 만들지 않았다`);
        continue;
      }

      writeFileSync(join(vendorDir, `${id}.html`), renderVendorPage(vendor), 'utf8');
    }
  }

  return indexPath;
}
