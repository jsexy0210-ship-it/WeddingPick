#!/usr/bin/env node
/**
 * 앱 디자인 정본(`docs/design/React_Native/preview.html`)의 화면 프레임을 PNG로 찍는다.
 * 2026-09-25 대표 지시 「픽셀 단위까지 하나도 빠짐없이 싹다 맞춘다」 — 앱 화면과 나란히
 * 놓고 픽셀로 비교할 기준 그림을 만드는 도구다(비교는 `pixel-diff.py`).
 *
 *   CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/canon/capture-rn-canon.mjs \
 *     [--group home] [--frame frame-003] [--out /tmp/canon] [--scale 2]
 *
 * 프레임 목록은 `runtime-check.json`의 groups[].screens에서 읽는다. preview.html은 한 파일짜리
 * 번들이라 내용을 그대로 주입(setContent)하고 `#<group>?screen=<frame>`으로 화면을 고른다
 * (정본을 만든 쪽도 같은 방식으로 검사했다 — runtime-check.json `method`).
 * 프레임 크기는 화면군마다 다르다(home·search 등 430×932, common 일부 390×844·430×600) —
 * 로그에 찍힌 크기를 보고 앱도 같은 `--viewport`로 찍는다.
 * 저장 이름: `<out>/<group>/<frame>__<WP-ID>.png`. 저장소 밖에 저장한다.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  const { execSync } = await import('node:child_process');
  const root = execSync('npm root -g').toString().trim();
  ({ chromium } = require(join(root, 'playwright')));
}

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const onlyGroup = arg('group');
const onlyFrame = arg('frame');
const out = arg('out', '/tmp/rn-canon');
const scale = Number(arg('scale', '2'));

const dir = new URL('../../docs/design/React_Native/', import.meta.url);
const html = readFileSync(new URL('preview.html', dir), 'utf8');
const check = JSON.parse(readFileSync(new URL('runtime-check.json', dir), 'utf8'));

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: scale });
await page.setContent(html, { waitUntil: 'load' });
// 미리보기 기본 배율은 75%다. 원래 크기(휴대전화 430×932)로 찍어야 앱과 같은 자로 잰다.
await page.locator('select').first().selectOption('1');

let saved = 0;
const missing = [];
for (const group of check.groups) {
  if (onlyGroup && group.group !== onlyGroup) continue;
  mkdirSync(join(out, group.group), { recursive: true });
  for (const screen of group.screens) {
    if (onlyFrame && screen.id !== onlyFrame) continue;
    await page.evaluate((hash) => { window.location.hash = hash; }, `${group.group}?screen=${screen.id}`);
    await page.waitForTimeout(400);
    const frame = page.locator(`[data-design-frame="true"][data-source-line="${screen.sourceLine}"]:visible`).first();
    try {
      await frame.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      missing.push(`${group.group}/${screen.id}`);
      continue;
    }
    const wp = (screen.label.match(/WP-[A-Z]+-[0-9A-Za-z]+/) ?? ['NOID'])[0];
    const file = join(out, group.group, `${screen.id}__${wp}.png`);
    await frame.screenshot({ path: file });
    const box = await frame.boundingBox();
    console.log(`${file}  ${Math.round(box?.width ?? 0)}×${Math.round(box?.height ?? 0)}  ${screen.label}`);
    saved += 1;
  }
}
await browser.close();
console.log(`저장 ${saved}장${missing.length ? ` · 못 찾음 ${missing.length}: ${missing.join(', ')}` : ''}`);
if (missing.length) process.exitCode = 1;
