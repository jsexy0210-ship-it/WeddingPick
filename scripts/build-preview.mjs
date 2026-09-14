#!/usr/bin/env node
/**
 * 대표님 프리뷰용 — 빌드된 산출물(dist/*.html)에만 스크립트를 얹는다.
 *
 * **제품 코드는 한 글자도 안 건드린다.** 로그인 가드(`apps/mobile/src/app/_layout.tsx`)는
 * 그대로 둔다 — 캡처 도구(`screenshot-screens.mjs`)와 같은 방법이다: 토큰을
 * `localStorage`에 심고(로그인 가드는 통과하되 서버는 안 속인다), `/v1/**` fetch를
 * `scripts/fixtures/api.cjs` 값으로 가로챈다. 다른 점은 자리뿐이다 — 캡처 도구는
 * Playwright의 `page.route`로 가로채고, 여기서는 진짜 브라우저에서 돌 것이므로
 * `window.fetch`를 감싼 `<script>`로 dist html에 끼워 넣는다.
 *
 * **`/login`·`/setup`은 건드리지 않는다.** 그 경로로 직접 들어오면 토큰을 안 심는다 —
 * 대표님이 로그인·가입 화면 디자인도 그대로 보셔야 한다(MASTER 지시).
 *
 * **`apps/mobile/package.json`의 `export:web`에서 빌드 뒤 자동으로 불린다** — Render의
 * 배포 buildCommand가 이미 `npm run export:web --workspace @weddingpick/mobile`이라
 * `render.yaml`을 건드리지 않고도 프리뷰 빌드에 얹힌다. **캡처 도구는 빠진다** —
 * `screenshot-screens.mjs`가 `WEDDINGPICK_SKIP_PREVIEW_SHIM=1`을 주고 빌드하므로
 * 이 파일이 그 값을 보고 조용히 아무 것도 안 한다. 이 배너·가짜 로그인이 기존
 * Before/After 캡처에 섞이면 안 된다 — 그건 실제 화면을 있는 그대로 찍는 도구다.
 *
 * 이 스크립트가 만드는 파일(`preview-fixtures.js`·`preview-shim.js`)은 `dist/` 안에만
 * 있다 — `dist/`는 `.gitignore`로 저장소에 안 들어간다. `claude/rn-preview` 전용이고
 * MASTER는 이 브랜치를 main에 머지하지 않는다.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(REPO, 'apps/mobile/dist');
const FIXTURES_SRC = join(REPO, 'scripts/fixtures/api.cjs');

const BANNER_TEXT = '미리보기 — 로그인 없이 화면만 봅니다. 값은 예시입니다';

async function findHtmlFiles(dir) {
  const out = [];

  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) out.push(...(await findHtmlFiles(full)));
    else if (entry.name.endsWith('.html')) out.push(full);
  }

  return out;
}

/**
 * `scripts/fixtures/api.cjs`(CommonJS)를 손대지 않고 그대로 감싸 브라우저 전역에 건다.
 * 원본은 캡처 도구도 그대로 쓰므로 여기서 한 글자도 고치지 않는다 — `module`/`exports`
 * 껍데기만 씌운다.
 */
async function bakeFixtures() {
  const src = await readFile(FIXTURES_SRC, 'utf8');
  const baked =
    `// 빌드 산출물 — scripts/fixtures/api.cjs를 그대로 감싼 것이다. 손으로 고치지 않는다.\n` +
    `// 원본을 고치려면 scripts/fixtures/api.cjs를 고치고 다시 빌드한다.\n` +
    `(function () {\n  var module = { exports: {} };\n  var exports = module.exports;\n\n` +
    `${src}\n\n  window.__WEDDINGPICK_PREVIEW_FIXTURES__ = module.exports;\n})();\n`;

  await writeFile(join(DIST, 'preview-fixtures.js'), baked);
}

async function writeShim() {
  const shim = `// 대표님 프리뷰 전용 — 로그인 가드(_layout.tsx)는 그대로 두고 토큰만 심는다.
// /login · /setup 으로 직접 들어오면 토큰을 안 심어 그 화면이 그대로 뜬다.
// scripts/build-preview.mjs가 만든다. claude/rn-preview 전용, main에 올리지 않는다.
(function () {
  var path = window.location.pathname;
  var isAuthScreen = /^\\/(login|setup)(\\/|$)/.test(path);

  function addBanner() {
    var el = document.createElement('div');

    el.textContent = ${JSON.stringify(BANNER_TEXT)};
    el.setAttribute(
      'style',
      'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#371B34;' +
        'color:#fff;font-size:12px;line-height:1.6;text-align:center;padding:4px 8px;' +
        'font-family:system-ui,-apple-system,sans-serif;pointer-events:none;'
    );

    function mount() {
      document.body.appendChild(el);
    }

    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount);
  }

  addBanner();

  if (isAuthScreen) return;

  try {
    window.localStorage.setItem('weddingpick.sessionToken.v1', 'preview-token');
    window.localStorage.setItem('weddingpick.adminToken.v1', 'preview-token');
  } catch (e) {
    /* 저장소를 못 쓰면 로그인 화면이 뜬다 — 그것도 사실이다. */
  }

  var fixtures = window.__WEDDINGPICK_PREVIEW_FIXTURES__;

  if (!fixtures) return;

  var originalFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    var rawUrl = typeof input === 'string' ? input : input.url;
    var url = new URL(rawUrl, window.location.origin);
    var v1At = url.pathname.indexOf('/v1/');

    if (v1At === -1) return originalFetch(input, init);

    var v1Path = url.pathname.slice(v1At);
    var method = (init && init.method) || 'GET';
    var matched = fixtures.matchRoute(method, v1Path);

    if (matched === null) {
      return Promise.resolve(
        new Response(JSON.stringify({ code: 'fixture_missing', message: method + ' ' + v1Path }), {
          status: 404,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        })
      );
    }

    var body =
      typeof matched.value === 'function'
        ? matched.value({ url: url, method: method, params: matched.params })
        : matched.value;

    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      })
    );
  };
})();
`;

  await writeFile(join(DIST, 'preview-shim.js'), shim);
}

async function injectInto(file) {
  let html = await readFile(file, 'utf8');

  if (html.includes('preview-shim.js')) return;

  const tags = '<script src="/preview-fixtures.js"></script><script src="/preview-shim.js"></script></body>';

  html = html.includes('</body>')
    ? html.replace('</body>', tags)
    : `${html}<script src="/preview-fixtures.js"></script><script src="/preview-shim.js"></script>`;

  await writeFile(file, html);
}

async function main() {
  if (process.env.WEDDINGPICK_SKIP_PREVIEW_SHIM) {
    process.stderr.write('· WEDDINGPICK_SKIP_PREVIEW_SHIM — 프리뷰 얹기를 건너뛴다(캡처 빌드)\n');

    return;
  }

  if (!existsSync(DIST)) {
    process.stderr.write('· dist가 없다 — export:web을 먼저 돌린다\n');

    return;
  }

  await bakeFixtures();
  await writeShim();

  const htmlFiles = await findHtmlFiles(DIST);

  for (const file of htmlFiles) await injectInto(file);

  process.stdout.write(`✓ 프리뷰 스크립트를 html ${htmlFiles.length}개에 얹었다\n`);
}

await main();
