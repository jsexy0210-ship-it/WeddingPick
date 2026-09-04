#!/usr/bin/env node
// 스토어 스크린샷 생성 스크립트
// 사용: node scripts/gen-store-screenshots.js
// 출력: docs/store-assets/ios/ 및 docs/store-assets/android/
//
// 스크린 소스: docs/screenshots/design-reference-*.png
// 마케팅 카피 수정: 아래 SCREENS 배열

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.join(__dirname, '..');

const IOS_DIR = path.join(REPO_ROOT, 'docs/store-assets/ios');
const AOS_DIR = path.join(REPO_ROOT, 'docs/store-assets/android');
fs.mkdirSync(IOS_DIR, { recursive: true });
fs.mkdirSync(AOS_DIR, { recursive: true });

// 스크린샷 사양
const SIZES = {
  ios: { w: 1290, h: 2796 },     // iPhone 6.9" (App Store 필수)
  android: { w: 1080, h: 1920 }, // Phone 9:16
};

// 레퍼런스 이미지 → base64
function imgBase64(relPath) {
  const buf = fs.readFileSync(path.join(REPO_ROOT, relPath));
  return 'data:image/png;base64,' + buf.toString('base64');
}

const GUEST_HOME  = imgBase64('docs/screenshots/design-reference-guest-home.png');
const MEMBER_HOME = imgBase64('docs/screenshots/design-reference-member-home.png');

// ─── 스크린 정의 ────────────────────────────────────────────────────────────
// headline: 상단 마케팅 문구 (1줄)
// sub:      부제 (1줄, 선택)
// img:      base64 데이터 URL
// bg:       배경색
const SCREENS = [
  {
    id: '01-hero',
    headline: '웨딩픽이 먼저 골라요',
    sub: '비교하고 Pick만 하면 돼요',
    img: GUEST_HOME,
    bg: '#FFF5F4',
  },
  {
    id: '02-recommend',
    headline: '내 상황에 딱 맞는 추천',
    sub: '확인된 정보 기준으로 골라드려요',
    img: MEMBER_HOME,
    bg: '#FFFFFF',
  },
];
// ────────────────────────────────────────────────────────────────────────────

function makeScreenHTML(w, h, screen) {
  // 폰 목업 영역: 전체 높이의 70%, 가로는 w 기준으로 맞춤
  const mockupH = Math.round(h * 0.68);
  const mockupW = Math.round(mockupH * 0.48); // 약 9:19 비율

  // 타이포 스케일: iOS 기준으로 설계, Android는 w/1290 비율로 축소
  const scale = w / 1290;
  const headlineSize = Math.round(72 * scale);
  const subSize = Math.round(40 * scale);
  const brandSize = Math.round(36 * scale);
  const topPad = Math.round(160 * scale);

  return `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${w}px; height: ${h}px;
    background: ${screen.bg};
    overflow: hidden;
    font-family: -apple-system, 'Noto Sans KR', sans-serif;
  }
  .wrap {
    width: ${w}px; height: ${h}px;
    display: flex; flex-direction: column;
    align-items: center;
  }
  .brand {
    margin-top: ${topPad}px;
    font-size: ${brandSize}px;
    font-weight: 700;
    color: #FF6F61;
    letter-spacing: -0.01em;
  }
  .headline {
    margin-top: ${Math.round(32 * scale)}px;
    font-size: ${headlineSize}px;
    font-weight: 800;
    color: #212124;
    text-align: center;
    line-height: 1.25;
    letter-spacing: -0.03em;
    white-space: pre-line;
    padding: 0 ${Math.round(60 * scale)}px;
  }
  .sub {
    margin-top: ${Math.round(20 * scale)}px;
    font-size: ${subSize}px;
    font-weight: 400;
    color: #4D5159;
    text-align: center;
  }
  .mockup-wrap {
    flex: 1;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: ${Math.round(60 * scale)}px;
  }
  .mockup {
    width: ${mockupW}px;
    height: ${mockupH}px;
    object-fit: contain;
    object-position: top center;
    border-radius: ${Math.round(40 * scale)}px;
    box-shadow: 0 ${Math.round(24 * scale)}px ${Math.round(80 * scale)}px rgba(0,0,0,0.18);
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="brand">웨딩픽</div>
  <div class="headline">${screen.headline}</div>
  ${screen.sub ? `<div class="sub">${screen.sub}</div>` : ''}
  <div class="mockup-wrap">
    <img class="mockup" src="${screen.img}" />
  </div>
</div>
</body>
</html>`;
}

(async () => {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium';
  const browser = await chromium.launch({ executablePath });

  for (const [platform, size] of Object.entries(SIZES)) {
    const outDir = platform === 'ios' ? IOS_DIR : AOS_DIR;
    let idx = 1;

    for (const screen of SCREENS) {
      const page = await browser.newPage();
      await page.setViewportSize({ width: size.w, height: size.h });
      await page.setContent(makeScreenHTML(size.w, size.h, screen));
      await page.waitForTimeout(300); // 이미지 로드 대기

      const filename = `${String(idx).padStart(2, '0')}-${screen.id.replace(/^\d+-/, '')}.png`;
      const outPath = path.join(outDir, filename);
      await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: size.w, height: size.h } });
      await page.close();

      console.log(`✓ [${platform}] ${filename} (${size.w}×${size.h})`);
      idx++;
    }
  }

  await browser.close();
  console.log('\n스크린샷 생성 완료');
  console.log(`  iOS     → docs/store-assets/ios/`);
  console.log(`  Android → docs/store-assets/android/`);
})();
