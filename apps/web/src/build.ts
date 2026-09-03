import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderAdminPage } from './admin-page';
import { renderLandingPage } from './page';
import { STYLES } from './styles';

/**
 * 랜딩 한 장을 만든다.
 *
 * 프레임워크도 런타임 자바스크립트도 없다. 소개 한 장에 필요한 것은 글과 링크뿐이고,
 * 자바스크립트를 켜지 않아도 읽을 수 있어야 한다.
 */
export function build(outDir: string): string {
  mkdirSync(outDir, { recursive: true });

  const indexPath = join(outDir, 'index.html');
  writeFileSync(indexPath, renderLandingPage(STYLES), 'utf8');

  const adminPath = join(outDir, 'admin.html');
  writeFileSync(adminPath, renderAdminPage(), 'utf8');

  return indexPath;
}
