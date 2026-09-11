#!/usr/bin/env node
/**
 * 앱 화면을 실제로 렌더해 PNG로 찍는다.
 *
 * **왜 있는가.** 2026-09-11에 검색 화면이 시안과 전혀 다른 채로 배포됐다. 세션 셋이
 * 그 화면을 고쳤는데 셋 다 코드와 시안 HTML을 눈으로 대조했을 뿐이라 「시안대로
 * 맞췄다」는 보고가 계속 올라왔고, 대표님이 앱을 여실 때까지 아무도 몰랐다.
 * 그 일을 막는 도구다 — PR을 올리기 전에 찍어서 붙인다.
 *
 * **앱 화면만 찍는다.** 시안 `.dc.html`은 찍지 않는다 — 그 파일들이 부르는
 * `support.js`·`_ds/` 자산이 용량 때문에 저장소에 들어오지 않는다(2026-09-11 대표님
 * 확인). 시안과의 대조는 사람이 한다: 찍은 화면을 PR에 붙이면 사람이 시안을 옆에
 * 놓고 본다. 자세한 것은 `docs/screen-capture.md`.
 *
 * 쓰는 법은 `docs/screen-capture.md`.
 *
 *   node scripts/screenshot-screens.mjs                        # 검색 화면 한 장
 *   node scripts/screenshot-screens.mjs --route "/(tabs)/pick/"
 *   node scripts/screenshot-screens.mjs --build                # dist부터 새로 만든다
 *
 * 규칙 셋:
 * 1. **운영 API로 나가지 않는다.** 브라우저 안에서 `/v1/**`를 전부 가로채
 *    `scripts/fixtures/api.cjs`로 답한다. 바깥으로 나가는 요청은 막고 이름을 적는다.
 * 2. **제품 코드에 캡처용 구멍을 내지 않는다.** 로그인 가드는 그대로 두고
 *    토큰을 기기 저장소에 심어 통과한다 — 서버 응답만 가짜다.
 *    (`weddingpick.sessionToken.v1` — apps/mobile/src/api/session.ts)
 * 3. **찍은 PNG를 저장소에 커밋하지 않는다.** 기본 저장 자리는 저장소 밖이다.
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

import { matchRoute } from './fixtures/api.cjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(REPO, 'apps/mobile/dist');

/** 시안 `phone` 크기. 여기서 어긋나면 나란히 놓은 그림이 거짓말을 한다. */
const VIEWPORT = { width: 390, height: 844 };

/**
 * 관리자 콘솔 기준 해상도(CLAUDE.md v3.27 — 1440×900에서 올렸다).
 *
 * 앱 크기로 찍으면 사이드바 240이 본문을 밀어 글자가 세로 한 줄로 선다. 그림은
 * 나오지만 **화면을 봤다고 할 수 없는 그림**이 된다 — 실제로 한 번 그렇게 찍혔다.
 */
const ADMIN_VIEWPORT = { width: 1920, height: 1080 };

/**
 * playwright는 이 저장소의 의존성이 아니다 — 컨테이너에 전역으로 깔려 있다.
 * 있는 자리를 먼저 보고, 없으면 전역에서 찾는다.
 */
function loadPlaywright() {
  const req = createRequire(import.meta.url);

  try {
    return req('playwright');
  } catch {
    const root = execSync('npm root -g').toString().trim();

    return req(join(root, 'playwright'));
  }
}

function parseArgs(argv) {
  const opts = {
    routes: [],
    out: join(tmpdir(), 'weddingpick-screens'),
    build: false,
    full: false,
    wait: 1500,
    /** 비워 두면 경로를 보고 정한다 — `/admin/…`은 1920, 나머지는 390. */
    viewport: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--route') opts.routes.push(argv[++i]);
    else if (arg === '--out') opts.out = resolve(argv[++i]);
    else if (arg === '--build') opts.build = true;
    else if (arg === '--full') opts.full = true;
    else if (arg === '--wait') opts.wait = Number(argv[++i]);
    else if (arg === '--viewport') {
      const [width, height] = argv[++i].split('x').map(Number);

      opts.viewport = { width, height };
    }
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`모르는 인자: ${arg}`);
  }

  if (opts.routes.length === 0) opts.routes.push('/(tabs)/search/');

  return opts;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

/**
 * dist를 그대로 내주는 정적 서버.
 *
 * expo export는 경로마다 html을 따로 낸다(`/(tabs)/search/index.html`). 디렉터리로
 * 들어오면 `index.html`을, 그것도 없으면 `<경로>.html`을 찾는다.
 */
function startStaticServer(root) {
  const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const base = join(root, pathname);
    const candidates = [base, join(base, 'index.html'), `${base.replace(/\/$/, '')}.html`];

    for (const file of candidates) {
      if (!file.startsWith(root) || !existsSync(file) || file.endsWith('/')) continue;

      try {
        const body = await readFile(file);

        res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
        res.end(body);

        return;
      } catch {
        /* 디렉터리였다. 다음 후보로 간다. */
      }
    }

    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  });

  return new Promise((done) => {
    server.listen(0, '127.0.0.1', () => done({ server, port: server.address().port }));
  });
}

/**
 * 브라우저가 바깥으로 내보내려는 요청을 전부 붙잡는다.
 *
 * `/v1/**`는 fixtures로 답하고, 나머지 외부 주소는 막는다 — 캡처 한 장 찍자고
 * 운영 서버나 CDN을 부르지 않는다. 무엇을 부르려 했는지는 적어 둔다.
 */
async function installFixtures(page, missing, blocked) {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.startsWith('/v1/')) {
      const method = request.method();
      const key = `${method} ${url.pathname}`;
      const matched = matchRoute(method, url.pathname);

      if (matched === null) {
        missing.add(key);
        await route.fulfill({
          status: 404,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ code: 'fixture_missing', message: key }),
        });

        return;
      }

      const { value, params } = matched;
      const body = typeof value === 'function' ? value({ url, method, params }) : value;

      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(body),
      });

      return;
    }

    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();

      return;
    }

    blocked.add(`${request.method()} ${request.url()}`);
    await route.abort();
  });
}

/**
 * 늘 나오지만 화면과 상관없는 콘솔 오류.
 *
 * React #419는 「서버가 이 Suspense 경계를 끝내지 못했다」 — 정적 export를 띄우면
 * 언제나 나온다. 여기 적어 두지 않으면 매 캡처마다 같은 줄이 붙고, 사람은
 * 곧 콘솔 오류를 통째로 안 읽게 된다.
 */
const BENIGN_CONSOLE = [/Minified React error #419/];

function safeName(route) {
  return route.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root';
}

async function captureRoute(context, origin, route, opts) {
  const missing = new Set();
  const blocked = new Set();
  const errors = [];
  const page = await context.newPage();

  page.on('console', (message) => {
    const text = message.text();

    if (message.type() !== 'error') return;
    if (BENIGN_CONSOLE.some((pattern) => pattern.test(text))) return;

    errors.push(text.slice(0, 400));
  });
  page.on('pageerror', (error) => {
    const text = String(error);

    if (BENIGN_CONSOLE.some((pattern) => pattern.test(text))) return;

    errors.push(text.slice(0, 400));
  });

  await installFixtures(page, missing, blocked);

  /*
   * 토큰을 먼저 심는다. 로그인 가드(`_layout.tsx`)는 그대로 둔다 — 제품 코드에
   * 「캡처일 때는 통과」를 넣으면 그 구멍이 운영에 나간다.
   */
  await page.addInitScript((key) => {
    try {
      window.localStorage.setItem(key, 'capture-token');
    } catch {
      /* 저장소를 못 쓰면 어차피 로그인 화면이 찍힌다 — 그것도 사실이다. */
    }
    try {
      // 관리자 화면은 토큰 자리가 다르다(admin/_session.ts).
      window.localStorage.setItem('weddingpick.adminToken.v1', 'capture-token');
    } catch {
      /* 위와 같다. */
    }
  }, 'weddingpick.sessionToken.v1');

  await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(opts.wait);

  const file = join(opts.out, `${safeName(route)}.png`);

  await page.screenshot({ path: file, fullPage: opts.full });
  await page.close();

  return { route, file, missing: [...missing], blocked: [...blocked], errors };
}

const HELP = `화면을 실제로 렌더해 PNG로 찍는다.

  node scripts/screenshot-screens.mjs [옵션]

  --route <경로>   찍을 화면. 여러 번 줄 수 있다. 기본값 "/(tabs)/search/"
  --out <폴더>     저장 자리. 기본값은 저장소 밖(임시 폴더)이다 — PNG는 커밋하지 않는다.
  --build          dist를 새로 만든 뒤 찍는다.
  --full           화면 전체(스크롤 포함)를 찍는다. 기본은 390x844 한 화면.
  --wait <ms>      렌더를 기다리는 시간. 기본 1500.
  --viewport WxH   창 크기. 기본은 경로를 보고 정한다 — /admin은 1920x1080, 나머지 390x844.
`;

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    process.stdout.write(HELP);

    return;
  }

  if (opts.build || !existsSync(DIST)) {
    process.stderr.write('· dist를 만든다 (몇 분 걸린다)\n');
    execSync('npm run export:web --workspace @weddingpick/mobile', {
      cwd: REPO,
      stdio: 'inherit',
      /*
       * 주소는 형식만 맞으면 된다 — 나가는 요청은 브라우저가 전부 가로챈다.
       * 그래도 비워 두지는 않는다: 비면 `isServerConfigured`가 false가 되어
       * 서버를 아예 안 부르는 다른 화면이 찍힌다(api/config.ts).
       */
      env: { ...process.env, EXPO_PUBLIC_API_URL: 'http://127.0.0.1:1/capture' },
    });
  }

  await mkdir(opts.out, { recursive: true });

  const { chromium } = loadPlaywright();
  const { server, port } = await startStaticServer(DIST);
  const browser = await chromium.launch();
  /*
   * 관리자와 앱은 기준 해상도가 다르다. 섞어 찍으면 한쪽이 반드시 뭉개지므로
   * 경로를 보고 정한다 — 따로 주고 싶으면 `--viewport 1280x800`.
   */
  const adminOnly = opts.routes.every((route) => route.startsWith('/admin'));
  const viewport = opts.viewport ?? (adminOnly ? ADMIN_VIEWPORT : VIEWPORT);
  const context = await browser.newContext({
    viewport,
    /* 1920을 2배로 찍으면 3840이라 파일만 커진다. 관리자는 등배로 본다. */
    deviceScaleFactor: viewport.width > 800 ? 1 : 2,
    locale: 'ko-KR',
  });
  try {
    for (const route of opts.routes) {
      const result = await captureRoute(context, `http://127.0.0.1:${port}`, route, opts);

      process.stdout.write(`✓ ${route}\n  ${result.file}\n`);

      if (result.missing.length) {
        process.stdout.write(
          `  fixture 없음 (scripts/fixtures/api.cjs에 더한다):\n${result.missing.map((m) => `    ${m}\n`).join('')}`
        );
      }

      if (result.blocked.length) {
        process.stdout.write(`  바깥으로 나가려다 막힌 요청:\n${result.blocked.map((b) => `    ${b}\n`).join('')}`);
      }

      if (result.errors.length) {
        process.stdout.write(`  콘솔 오류:\n${result.errors.map((e) => `    ${e}\n`).join('')}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
}

await main();
