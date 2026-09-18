#!/usr/bin/env node
/**
 * CI에서 한 번 만든 정적 산출물을 앱웹·관리자·웹사이트 세 묶음으로 포장한다.
 *
 * 라이브 서버 설정은 건드리지 않는다. 이 스크립트의 결과는 KakaoCloud VM의
 * 후보 릴리스 폴더에 올려 검증한 뒤 별도 cutover 단계에서만 공개한다.
 */

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE_DIST = join(ROOT, 'apps', 'mobile', 'dist');
const WEB_DIST = join(ROOT, 'apps', 'web', 'dist');
const OUT = join(ROOT, '.kakao-static');

function requirePath(path, label) {
  if (!existsSync(path)) {
    console.error(`!! ${label}가 없다: ${path}`);
    process.exit(1);
  }
}

requirePath(join(MOBILE_DIST, 'index.html'), '앱 웹 export');
requirePath(join(WEB_DIST, 'index.html'), '웹사이트 build');

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

/*
 * 브라우저 탭 파비콘 정본은 Expo app export의 favicon.ico 하나다.
 * admin은 같은 mobile dist를 깎아 만들므로 이미 같은 파일을 가진다.
 * web 후보에도 **그 바이트 그대로** 복사해 세 출처가 다른 아이콘을 가질 여지를 없앤다.
 */
requirePath(join(OUT, 'app', 'favicon.ico'), '공통 파비콘');
cpSync(join(OUT, 'app', 'favicon.ico'), join(OUT, 'web', 'favicon.ico'));

requirePath(join(OUT, 'app', 'index.html'), '앱 후보');
requirePath(join(OUT, 'admin', 'index.html'), '관리자 후보');
requirePath(join(OUT, 'admin', 'admin', 'login.html'), '관리자 로그인 후보');
requirePath(join(OUT, 'admin', 'favicon.ico'), '관리자 공통 파비콘');
requirePath(join(OUT, 'web', 'index.html'), '웹사이트 후보');
requirePath(join(OUT, 'web', 'favicon.ico'), '웹사이트 공통 파비콘');

const manifest = {
  commit: process.env.GITHUB_SHA || null,
  generatedAt: new Date().toISOString(),
  targets: ['app', 'admin', 'web'],
  liveCutover: false,
};

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Kakao static candidate packaged: ${OUT}`);
