#!/usr/bin/env node
/*
 * node_modules가 **반쯤 풀린 상태**인지 보고, 그렇다면 다시 설치한다.
 *
 * 2026-09-09, Render의 weddingpick-app-web이 네 번 연속 빌드에 실패했다. GitHub CI는
 * 초록이었고 로컬 `npm run export:web`도 exit 0이었다. 빌드 로그의 실제 원인은 이랬다:
 *
 *   ==> cache extraction failed, continuing without cache
 *   gzip: stdin: invalid compressed data--crc error
 *   ...
 *   Installing dependencies with npm...
 *   up to date, audited 1601 packages in 3s
 *   ...
 *   Error: While trying to resolve module `expo-image` ... the package
 *   `node_modules/expo-image/package.json` was successfully found. However, this
 *   package itself specifies a `main` module field that could not be resolved
 *   (`node_modules/expo-image/src/index.ts`. Indeed, none of these files exist:
 *
 * 빌드 캐시 tar가 CRC 오류로 중간에 끊겨 node_modules가 **일부만** 풀렸다. package.json은
 * 남고 그 안의 진입 파일은 사라진 상태다. `npm install`은 트리를 package.json의 버전으로만
 * 판정하므로 「up to date」라고 답하고 아무것도 고치지 않는다 — 깨진 상태가 캐시에
 * 그대로 다시 저장돼 다음 빌드도 같은 자리에서 죽는다.
 *
 * 그래서 번들러를 부르기 전에 여기서 확인한다. 설치된 패키지의 진입 파일이 실제로
 * 존재하는지 보고, 하나라도 없으면 `npm ci`로 통째로 다시 깐다(`npm ci`는 node_modules를
 * 지우고 시작하므로 반쯤 풀린 상태가 살아남지 못한다).
 *
 * 멀쩡할 때 드는 비용은 1초 미만이고 아무것도 바꾸지 않는다.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modules = path.join(root, 'node_modules');

/** metro·node가 실제로 열어보는 확장자. `main: "src/index.ts"`(expo 57)도 여기 걸린다. */
const EXTENSIONS = ['', '.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.json', '.node'];

/** 타입 선언은 진입 파일이 아니다 — `types`만 남아 있어도 번들러는 못 돌린다. */
const RUNTIME_CONDITIONS = ['default', 'require', 'import', 'react-native', 'browser', 'node'];

function resolves(dir, target) {
  const full = path.join(dir, target);
  if (EXTENSIONS.some((extension) => existsSync(full + extension))) return true;
  return EXTENSIONS.some((extension) => existsSync(path.join(full, `index${extension}`)));
}

/**
 * `exports`가 「.」에 대해 실제로 내놓는 파일들. 「.」키가 없으면 조건 객체 자체가
 * 「.」의 정의다(@humanfs/core의 `{ import: { … } }`가 그렇다).
 */
function mainTargets(exports) {
  if (typeof exports === 'string') return [exports];
  if (exports === null || typeof exports !== 'object') return [];

  const entry = Object.hasOwn(exports, '.') ? exports['.'] : exports;
  if (typeof entry === 'string') return [entry];
  if (entry === null || typeof entry !== 'object') return [];

  return RUNTIME_CONDITIONS.flatMap((condition) =>
    Object.hasOwn(entry, condition) ? mainTargets(entry[condition]) : [],
  );
}

/** node_modules 한 층을 훑어 패키지 디렉터리를 모은다(@scope는 한 단계 더 들어간다). */
function packages(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const found = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    // 워크스페이스는 심볼릭 링크다 — 저장소 안이라 캐시가 건드리지 않는다.
    if (lstatSync(full).isSymbolicLink()) continue;
    if (entry.name.startsWith('@')) found.push(...packages(full));
    else if (entry.isDirectory()) found.push(full);
  }
  return found;
}

const broken = [];
for (const dir of packages(modules)) {
  const manifest = path.join(dir, 'package.json');
  if (!existsSync(manifest)) continue;

  let pkg;
  try {
    pkg = JSON.parse(readFileSync(manifest, 'utf8'));
  } catch {
    // package.json 자체가 깨졌으면 그것도 반쯤 풀린 증거다.
    broken.push(path.relative(root, dir));
    continue;
  }

  // `exports`가 있으면 번들러도 그쪽을 먼저 본다 — main이 낡아 있는 패키지가 흔해서,
  // exports가 내놓는 파일이 하나라도 있으면 온전한 것으로 친다.
  const targets = mainTargets(pkg.exports);
  if (targets.length > 0) {
    if (!targets.some((target) => resolves(dir, target))) {
      broken.push(`${path.relative(root, dir)} (exports: ${targets.join(' · ')})`);
    }
    continue;
  }

  if (typeof pkg.main !== 'string' || pkg.main.length === 0) continue;
  // `main`이 다른 패키지를 가리키기도 한다(`expo-router/entry`). 그건 이 패키지가
  // 온전한지와 무관하다.
  if (!pkg.main.startsWith('.') && existsSync(path.join(modules, pkg.main.split('/')[0]))) continue;

  if (!resolves(dir, pkg.main)) broken.push(`${path.relative(root, dir)} (main: ${pkg.main})`);
}

if (broken.length === 0) process.exit(0);

console.error(`node_modules가 온전하지 않다 — 진입 파일이 없는 패키지 ${broken.length}개:`);
for (const name of broken.slice(0, 10)) console.error(`  - ${name}`);
if (broken.length > 10) console.error(`  ... 외 ${broken.length - 10}개`);
console.error('npm ci로 다시 설치한다.');

execFileSync('npm', ['ci'], { cwd: root, stdio: 'inherit' });
