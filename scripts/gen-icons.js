#!/usr/bin/env node
// 앱 아이콘 생성 스크립트
// 사용: node scripts/gen-icons.js
// 요구사항: npx playwright install chromium (또는 /opt/pw-browsers/chromium 존재)
//
// 마크 크기 조정: ICONS 배열의 scale 값 변경 (0.0~1.0)

const { chromium } = require('playwright');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../apps/mobile/assets/images');

const ICONS = [
  { file: 'icon.png',                    size: 1024, scale: 0.60, bg: '#FF6F61', fg: '#FFFFFF', transparent: false },
  { file: 'splash-icon.png',             size: 512,  scale: 0.60, bg: '#FF6F61', fg: '#FFFFFF', transparent: false },
  { file: 'android-icon-foreground.png', size: 1024, scale: 0.55, bg: 'transparent', fg: '#FFFFFF', transparent: true },
  { file: 'android-icon-background.png', size: 1024, scale: 1,    bg: '#FF6F61', fg: '#FF6F61', transparent: false },
  { file: 'android-icon-monochrome.png', size: 432,  scale: 0.55, bg: '#FFFFFF', fg: '#000000', transparent: false },
  { file: 'favicon.png',                 size: 48,   scale: 0.60, bg: '#FF6F61', fg: '#FFFFFF', transparent: false },
];

function makeHTML(size, scale, bg, fg, transparent) {
  const markPx = Math.round(size * scale);
  const offset = Math.round((size - markPx) / 2);
  const bgStyle = transparent ? 'transparent' : bg;

  return `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; }
  html, body { width: ${size}px; height: ${size}px; background: ${bgStyle}; overflow: hidden; }
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${!transparent ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}
  <g transform="translate(${offset}, ${offset})">
    <svg width="${markPx}" height="${markPx}" viewBox="0 0 24 24">
      <path
        d="M12 20.5S3.5 15.2 3.5 9.9A4.4 4.4 0 0 1 12 8.1a4.4 4.4 0 0 1 8.5 1.8c0 5.3-8.5 10.6-8.5 10.6Z"
        fill="none" stroke="${fg}" stroke-width="1.9"
        stroke-linecap="round" stroke-linejoin="round"
      />
      <path
        d="M9.4 11.9l1.7 1.7 3.4-3.4"
        fill="none" stroke="${fg}" stroke-width="1.9"
        stroke-linecap="round" stroke-linejoin="round"
      />
    </svg>
  </g>
</svg>
</body>
</html>`;
}

(async () => {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium';
  const browser = await chromium.launch({ executablePath });

  for (const cfg of ICONS) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: cfg.size, height: cfg.size });
    await page.setContent(makeHTML(cfg.size, cfg.scale, cfg.bg, cfg.fg, cfg.transparent));
    await page.waitForTimeout(100);

    const outPath = path.join(OUT_DIR, cfg.file);
    await page.screenshot({
      path: outPath,
      clip: { x: 0, y: 0, width: cfg.size, height: cfg.size },
      omitBackground: cfg.transparent,
    });
    await page.close();
    console.log(`✓ ${cfg.file}`);
  }

  await browser.close();
  console.log('아이콘 생성 완료');
})();
