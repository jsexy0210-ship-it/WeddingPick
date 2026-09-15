#!/usr/bin/env node
/**
 * 피그마 시안(`weddingpick_figma`)을 실제로 렌더해 PNG로 찍는다.
 *
 * **왜 있는가.** `screenshot-screens.mjs`의 머리말은 「시안은 찍지 않는다」고 적었다.
 * 그 말은 `docs/design-handoff/`의 `.dc.html`에 맞다 — `support.js`·`_ds/` 자산이
 * 용량 때문에 저장소에 들어오지 않아 찍어도 빈 화면이 나온다. 그러나 **피그마
 * 저장소에는 틀리다.** 그쪽은 그냥 도는 Vite + React 앱이라 빌드하면 찍힌다.
 *
 * 그 전제를 그대로 둔 채 2026-09-14까지 왔고, 대표님이 앱을 열어 보시고
 * 「피그마랑 아예 다르잖아」라고 하실 때까지 아무도 두 장을 나란히 놓지 못했다.
 * 이 도구가 그 자리를 메운다 — 앱은 `screenshot-screens.mjs`, 시안은 이 파일.
 *
 * 준비(처음 한 번):
 *
 *   git clone --depth 1 https://github.com/jsexy0210-ship-it/weddingpick_figma \
 *     /home/user/jsexy0210-ship-it/weddingpick_figma
 *   cd /home/user/jsexy0210-ship-it/weddingpick_figma && npm install && npx vite build
 *
 * 쓰는 법:
 *
 *   node scripts/screenshot-figma.mjs                       # 홈 한 장
 *   node scripts/screenshot-figma.mjs --route /search --route /pick
 *   node scripts/screenshot-figma.mjs --repo <경로> --out <폴더>
 *
 * | 옵션 | 하는 일 |
 * | --- | --- |
 * | `--route <경로>` | 찍을 시안 라우트(`/` `/search` `/pick` …). 여러 번 줄 수 있다. 기본값 `/` |
 * | `--repo <경로>` | 피그마 저장소 자리. 기본값 `/home/user/jsexy0210-ship-it/weddingpick_figma` |
 * | `--out <폴더>` | 저장 자리. 기본값은 저장소 **밖**이다 |
 * | `--viewport WxH` | 창 크기. 기본 430×932 — **앱 캡처와 같은 폭으로 맞춘다** |
 * | `--wait <ms>` | 렌더를 기다리는 시간. 기본 1500 |
 * | `--no-full` | 스크롤 제외, 한 화면만 |
 *
 * 규칙 둘:
 * 1. **바깥으로 나가는 요청을 막는다.** 시안은 unsplash 이미지를 부른다 — 그림 자리는
 *    회색으로 비우고 이름을 적는다. 자산을 구하러 다니지 않는다(2026-09-11 대표님 확인).
 * 2. **찍은 PNG를 저장소에 커밋하지 않는다.** 기본 저장 자리는 저장소 밖이다.
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

/** 앱 캡처와 같은 폭. 여기서 어긋나면 나란히 놓은 그림이 거짓말을 한다. */
const VIEWPORT = { width: 430, height: 932 };

const DEFAULT_REPO = '/home/user/jsexy0210-ship-it/weddingpick_figma';

/**
 * playwright는 이 저장소의 의존성이 아니다 — 컨테이너에 전역으로 깔려 있다.
 * `screenshot-screens.mjs`와 같은 방식으로 찾는다.
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
    repo: DEFAULT_REPO,
    out: join(tmpdir(), 'weddingpick-figma'),
    viewport: VIEWPORT,
    wait: 1500,
    full: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--route') opts.routes.push(argv[++i]);
    else if (arg === '--repo') opts.repo = resolve(argv[++i]);
    else if (arg === '--out') opts.out = resolve(argv[++i]);
    else if (arg === '--wait') opts.wait = Number(argv[++i]);
    else if (arg === '--no-full') opts.full = false;
    else if (arg === '--viewport') {
      const [width, height] = argv[++i].split('x').map(Number);

      opts.viewport = { width, height };
    } else throw new Error(`모르는 인자: ${arg}`);
  }

  if (opts.routes.length === 0) opts.routes.push('/');

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
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/**
 * dist를 내주는 정적 서버. 파일이 없으면 `index.html`로 떨어뜨린다 —
 * 시안은 `createBrowserRouter`라 `/search`가 실제 파일이 아니다.
 */
function serve(dist) {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = join(dist, path);

    try {
      if (existsSync(file) && extname(file) !== '') {
        const body = await readFile(file);

        res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
        res.end(body);

        return;
      }

      const body = await readFile(join(dist, 'index.html'));

      res.writeHead(200, { 'content-type': MIME['.html'] });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });

  return new Promise((done) => {
    server.listen(0, '127.0.0.1', () => done({ server, port: server.address().port }));
  });
}

/** `/` → `home`, `/community/feed/2` → `community-feed-2`. */
function nameOf(route) {
  const trimmed = route.replace(/^\/+|\/+$/g, '');

  return trimmed === '' ? 'home' : trimmed.replace(/[^\w가-힣]+/g, '-');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const dist = join(opts.repo, 'dist');

  if (!existsSync(dist)) {
    throw new Error(
      `시안 빌드가 없다: ${dist}\n` +
        `먼저 만든다 — cd ${opts.repo} && npm install && npx vite build`,
    );
  }

  await mkdir(opts.out, { recursive: true });

  const { chromium } = loadPlaywright();
  const { server, port } = await serve(dist);
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: opts.viewport,
    deviceScaleFactor: 2,
  });

  /*
   * 바깥으로 나가는 요청을 막는다. 시안 카드의 unsplash 사진이 그 대상이다 —
   * 자리는 그대로 두고 회색으로 비운다. 레이아웃은 `w-full h-36` 같은 클래스가
   * 정하므로 그림이 없어도 크기와 간격은 그대로 찍힌다.
   */
  const blocked = new Set();

  await context.route('**/*', async (route) => {
    const url = route.request().url();

    if (url.startsWith(`http://127.0.0.1:${port}`) || url.startsWith('data:')) {
      await route.continue();

      return;
    }

    blocked.add(new URL(url).host);

    if (route.request().resourceType() === 'image') {
      await route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#d9d9d9"/></svg>',
      });

      return;
    }

    await route.abort();
  });

  const page = await context.newPage();
  const saved = [];

  for (const route of opts.routes) {
    await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(opts.wait);

    const file = join(opts.out, `${nameOf(route)}.png`);

    await page.screenshot({ path: file, fullPage: opts.full });
    saved.push(file);
  }

  await browser.close();
  server.close();

  for (const file of saved) console.log(file);
  if (blocked.size > 0) console.log(`· 바깥 요청을 막았다: ${[...blocked].join(' · ')}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
