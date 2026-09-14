import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ogImageSvg } from './og-image';

/**
 * 링크 미리보기 이미지의 SVG 원본을 다시 만든다 — `npm run og --workspace @weddingpick/web`.
 *
 * PNG는 이 명령이 만들지 않는다. 굽는 방법은 `apps/web/README.md`에 있다.
 */
const target = join(__dirname, '..', 'public', 'assets', 'weddingpick-og.svg');

writeFileSync(target, ogImageSvg(), 'utf8');
console.log(`링크 미리보기 SVG를 다시 만들었다 — ${target}`);
console.log('PNG도 함께 구워야 반영된다. apps/web/README.md 「링크 미리보기 이미지」 참고.');
