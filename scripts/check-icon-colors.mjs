/*
 * 아이콘 PNG가 심볼 원본과 같은 색인지 잰다.
 *
 *   node scripts/check-icon-colors.mjs
 *
 * `build-app-icons.mjs`는 Chromium(playwright)이 있어야 돌아서, 브라우저가 없는
 * 자리에서는 생성물이 원본과 갈라졌는지 볼 방법이 없었다. 이 스크립트는 그리지
 * 않고 **이미 커밋된 PNG를 읽어** 색만 센다 — 의존성은 pngjs 하나다.
 *
 * 잡는 것은 색 드리프트다. 2026-09-14에 키 컬러를 바꿨다가 2026-09-15에 코랄로
 * 되돌릴 때 웹 PNG 일곱 장이 옛 색으로 남았던 것이 그 자리다. 모양이 틀어진 것은
 * 이것으로 못 잡는다 — 그것은 `build-app-icons.mjs`를 돌려야 한다.
 *
 * 기대값의 원본은 `build-app-icons.mjs`의 TARGETS · WEB_TARGETS다. 거기를 고치면
 * 여기도 고친다.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = 'ff6f61';
const ON_BRAND = 'ffffff';

/* file: [배경, 마크]. 배경 null은 투명이어야 하는 자리다. */
const EXPECTED = {
  'apps/mobile/assets/images/icon.png': [BRAND, ON_BRAND],
  'apps/mobile/assets/images/android-icon-background.png': [BRAND, null],
  'apps/mobile/assets/images/android-icon-foreground.png': [null, ON_BRAND],
  'apps/mobile/assets/images/android-icon-monochrome.png': [null, '000000'],
  'apps/mobile/assets/images/favicon.png': [null, BRAND],
  'apps/mobile/assets/images/splash-icon.png': [null, ON_BRAND],
  'apps/web/public/assets/favicon-16.png': [null, BRAND],
  'apps/web/public/assets/favicon-32.png': [null, BRAND],
  'apps/web/public/assets/favicon-48.png': [null, BRAND],
  'apps/web/public/assets/icon-192.png': [BRAND, ON_BRAND],
  'apps/web/public/assets/maskable-512.png': [BRAND, ON_BRAND],
  'apps/web/public/assets/apple-touch-icon.png': [BRAND, ON_BRAND],
  'apps/web/public/assets/android-icon-foreground.png': [null, ON_BRAND],
};

const hex = (r, g, b) => [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

/** 불투명 픽셀의 정확한 RGB만 센다. 안티앨리어싱 섞인 색은 소수라 위로 안 올라온다. */
function histogram(file) {
  const png = PNG.sync.read(readFileSync(file));
  const counts = new Map();
  let transparent = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const a = png.data[i + 3];
    if (a === 0) { transparent += 1; continue; }
    if (a < 255) continue;
    const key = hex(png.data[i], png.data[i + 1], png.data[i + 2]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = png.width * png.height;
  const top = [...counts].sort((a, b) => b[1] - a[1]);
  return { width: png.width, height: png.height, total, transparent, top };
}

let failures = 0;
let missing = 0;
for (const [rel, [bg, mark]] of Object.entries(EXPECTED)) {
  const file = join(root, rel);
  if (!existsSync(file)) { console.log(`없음     ${rel}`); missing += 1; continue; }
  const h = histogram(file);
  const present = new Set(h.top.map(([c]) => c));
  const problems = [];

  if (bg === null) {
    /* 투명 배경 자리. 불투명 픽셀이 전체의 절반을 넘으면 면이 깔린 것이다. */
    const opaque = h.top.reduce((s, [, n]) => s + n, 0);
    if (opaque > h.total / 2) problems.push(`투명이어야 하는데 면이 깔림(불투명 ${opaque}/${h.total})`);
  } else if (!present.has(bg)) {
    problems.push(`배경 ${bg} 없음`);
  }

  if (mark !== null && !present.has(mark)) problems.push(`마크 ${mark} 없음`);

  const top3 = h.top.slice(0, 3).map(([c, n]) => `${c}:${n}`).join(' ');
  if (problems.length > 0) {
    failures += 1;
    console.log(`틀림     ${rel} ${h.width}x${h.height} [${top3}] — ${problems.join(' · ')}`);
  } else {
    console.log(`같음     ${rel} ${h.width}x${h.height} [${top3}]`);
  }
}

/* 생성기 밖에 있는 자산 — 색이 바뀌어도 아무도 다시 만들지 않는 자리다. */
const UNGENERATED = ['apps/web/public/assets/favicon-mono-32.png', 'apps/web/public/assets/weddingpick-og.png'];
console.log('\n생성기 밖(build-app-icons.mjs가 만들지 않는 자산):');
for (const rel of UNGENERATED) {
  const file = join(root, rel);
  if (!existsSync(file)) { console.log(`  없음   ${rel}`); continue; }
  const h = histogram(file);
  console.log(`  ${rel} ${h.width}x${h.height} [${h.top.slice(0, 3).map(([c, n]) => `${c}:${n}`).join(' ')}]`);
}

console.log(`\n틀림 ${failures}건 · 없음 ${missing}건`);
process.exit(failures + missing > 0 ? 1 : 0);
