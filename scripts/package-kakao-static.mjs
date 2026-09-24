#!/usr/bin/env node
/**
 * CI에서 한 번 만든 정적 산출물을 앱웹·관리자·웹사이트 세 묶음으로 포장한다.
 *
 * 라이브 서버 설정은 건드리지 않는다. 이 스크립트의 결과는 KakaoCloud VM의
 * 후보 릴리스 폴더에 올려 검증한 뒤 별도 cutover 단계에서만 공개한다.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE_DIST = join(ROOT, 'apps', 'mobile', 'dist');
const WEB_DIST = join(ROOT, 'apps', 'web', 'dist');
const OUT = join(ROOT, '.kakao-static');
const CANONICAL_FAVICON_PNG = join(ROOT, 'apps', 'mobile', 'assets', 'images', 'favicon.png');

function requirePath(path, label) {
  if (!existsSync(path)) {
    console.error(`!! ${label}가 없다: ${path}`);
    process.exit(1);
  }
}

requirePath(join(MOBILE_DIST, 'index.html'), '앱 웹 export');
requirePath(join(WEB_DIST, 'index.html'), '웹사이트 build');
requirePath(join(WEB_DIST, 'terms.html'), '이용약관 build');
requirePath(join(WEB_DIST, 'privacy.html'), '개인정보처리방침 build');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const role of ['app', 'admin']) {
  const target = join(OUT, role);
  cpSync(MOBILE_DIST, target, { recursive: true });
  execFileSync(process.execPath, [join(ROOT, 'scripts', 'split-admin-dist.mjs'), role], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, WEDDINGPICK_DIST_DIR: target },
  });
}

cpSync(WEB_DIST, join(OUT, 'web'), { recursive: true });
// 같은 443의 /assets/는 앱 root에서 제공한다. 웹 전용 파일만 합치고 이름 충돌은 중단한다.
cpSync(join(WEB_DIST, 'assets'), join(OUT, 'app', 'assets'), {
  recursive: true, force: false, errorOnExist: true,
});

/*
 * 정적 origin이 분리되어도 절대경로 /favicon.png가 각 origin에서 같은 바이트를
 * 가리키도록 canonical PNG를 app/admin/web 세 root에 모두 넣는다.
 * favicon.ico도 기존 정책대로 Expo app export를 정본으로 유지한다.
 */
requirePath(CANONICAL_FAVICON_PNG, '공통 PNG 파비콘');
for (const role of ['app', 'admin', 'web']) {
  cpSync(CANONICAL_FAVICON_PNG, join(OUT, role, 'favicon.png'));
}

requirePath(join(OUT, 'app', 'favicon.ico'), '공통 ICO 파비콘');
cpSync(join(OUT, 'app', 'favicon.ico'), join(OUT, 'web', 'favicon.ico'));

requirePath(join(OUT, 'app', 'index.html'), '앱 후보');
requirePath(join(OUT, 'app', 'favicon.png'), '앱 PNG 파비콘');
requirePath(join(OUT, 'admin', 'index.html'), '관리자 후보');
requirePath(join(OUT, 'admin', 'admin', 'login.html'), '관리자 로그인 후보');
requirePath(join(OUT, 'admin', 'favicon.ico'), '관리자 공통 ICO 파비콘');
requirePath(join(OUT, 'admin', 'favicon.png'), '관리자 PNG 파비콘');
requirePath(join(OUT, 'web', 'index.html'), '웹사이트 후보');
requirePath(join(OUT, 'web', 'favicon.ico'), '웹사이트 공통 ICO 파비콘');
requirePath(join(OUT, 'web', 'favicon.png'), '웹사이트 PNG 파비콘');

const canonicalFaviconPng = readFileSync(CANONICAL_FAVICON_PNG);
for (const role of ['app', 'admin', 'web']) {
  const packaged = readFileSync(join(OUT, role, 'favicon.png'));
  if (!canonicalFaviconPng.equals(packaged)) {
    console.error(`!! ${role} PNG 파비콘 바이트가 canonical 원본과 다르다`);
    process.exit(1);
  }
}

const manifest = {
  commit: process.env.GITHUB_SHA || null,
  generatedAt: new Date().toISOString(),
  targets: ['app', 'admin', 'web'],
  liveCutover: false,
};

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Kakao static candidate packaged: ${OUT}`);
