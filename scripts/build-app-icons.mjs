/*
 * 앱 아이콘·스플래시·파비콘을 **웨딩픽 심볼 하나에서** 뽑는다.
 *
 *   node scripts/build-app-icons.mjs
 *
 * 심볼의 원본은 `packages/ui/src/wedding-mark.tsx`다. 여기서 경로를 다시 적지 않고
 * 그 파일에서 읽어 온다 — 두 벌이 되면 심볼을 고칠 때 한쪽이 남는다.
 *
 * 그리기는 Chromium에 맡긴다(playwright). 이 저장소의 의존성이 아니라서,
 * 브라우저가 없는 곳에서는 돌지 않는다. 결과 PNG는 커밋돼 있으므로 심볼을
 * 고칠 때만 돌리면 된다. 브라우저 경로는 PLAYWRIGHT_CHROMIUM으로 넘긴다.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'packages/ui/src/wedding-mark.tsx'), 'utf8');

/** 컴포넌트에서 상수 하나를 꺼낸다. 못 찾으면 조용히 넘어가지 않고 멈춘다. */
function constant(name) {
  const match = source.match(new RegExp(`export const ${name} =([\\s\\S]*?);\\n`));
  if (!match) throw new Error(`wedding-mark.tsx에서 ${name}을 찾지 못했다`);
  const literals = [...match[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
  return literals.length > 0 ? literals.join('') : Number(match[1].trim());
}

const HEART = constant('MARK_HEART_PATH');
const CHECK = constant('MARK_CHECK_PATH');
const STROKE = constant('MARK_STROKE');
const VIEWBOX = constant('MARK_VIEWBOX');
const CORAL = '#ff6f61';

/**
 * `ratio`는 캔버스 한 변 대비 심볼 격자(64)가 차지할 비율이다.
 * 심볼의 실제 폭은 격자보다 좁아서(53/64) 눈에 보이는 크기는 이보다 작다.
 */
function markup({ size, color, background, ratio }) {
  const grid = size * ratio;
  const off = (size - grid) / 2;
  const bg = background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : '';
  const mark =
    ratio === 0
      ? ''
      : `<g transform="translate(${off} ${off}) scale(${grid / VIEWBOX})" fill="none"
       stroke="${color}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round">
       <path d="${HEART}"/><path d="${CHECK}"/>
     </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${bg}${mark}</svg>`;
}

/*
 * 안드로이드 어댑티브 아이콘은 바깥을 잘라낸다. 안전 영역이 가운데 66%뿐이라
 * 전경 마크를 그 안에 둔다 — 안 그러면 둥근 런처에서 하트 봉우리가 잘린다.
 * 모노크롬은 테마 아이콘용이고, 안드로이드가 알파만 읽으므로 검정으로 그린다.
 */
const TARGETS = [
  { file: 'icon.png', size: 1024, color: '#ffffff', background: CORAL, ratio: 0.72 },
  { file: 'android-icon-background.png', size: 512, color: CORAL, background: CORAL, ratio: 0 },
  { file: 'android-icon-foreground.png', size: 512, color: '#ffffff', background: null, ratio: 0.62 },
  { file: 'android-icon-monochrome.png', size: 432, color: '#000000', background: null, ratio: 0.62 },
  { file: 'favicon.png', size: 48, color: CORAL, background: null, ratio: 0.96 },
  { file: 'splash-icon.png', size: 512, color: '#ffffff', background: null, ratio: 0.96 },
];

const { chromium } = await import('playwright');
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM });
const out = join(root, 'apps/mobile/assets/images');
for (const target of TARGETS) {
  const page = await browser.newPage({
    viewport: { width: target.size, height: target.size },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<body style="margin:0">${markup(target)}</body>`);
  await page.screenshot({ path: join(out, target.file), omitBackground: !target.background });
  await page.close();
  console.log(`${target.file} ${target.size}x${target.size}`);
}
await browser.close();
