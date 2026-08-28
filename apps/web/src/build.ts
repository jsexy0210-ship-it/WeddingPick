import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderLandingPage } from './page';
import { STYLES } from './styles';

/**
 * 랜딩 한 장을 만든다.
 *
 * 프레임워크도 런타임 자바스크립트도 없다. 소개 한 장에 필요한 것은 글과 링크뿐이고,
 * 자바스크립트를 켜지 않아도 읽을 수 있어야 한다.
 */
export function build(outDir: string): string {
  const html = renderLandingPage(STYLES);
  const path = join(outDir, 'index.html');

  mkdirSync(outDir, { recursive: true });
  writeFileSync(path, html, 'utf8');

  return path;
}
