#!/usr/bin/env node
/**
 * **시안을 찍는다.** 피그마 저장소(`docs/design/figma-export`)를 빌드해 화면을 PNG로 낸다.
 *
 * **왜 생겼는가.** 2026-09-14에 대표님이 앱을 열어 보시고 「피그마랑 아예 다르다」고
 * 하셨다. 그때까지 규칙은 「시안은 찍지 않는다 — 대조는 사람이 한다」였다. 그 규칙은
 * `docs/design/handoff/`의 `.dc.html`이 자산(`_ds/`·`support.js`) 없이는 렌더되지 않아서
 * 생긴 것인데, **피그마 저장소는 사정이 다르다** — 그냥 도는 Vite 앱이라 빌드해서 찍힌다.
 * 못 찍는 줄 알고 사람 눈에 맡긴 동안 홈·검색·Pick이 통째로 어긋나 있었다.
 *
 * 쓰는 법:
 *
 *   node scripts/screenshot-figma.mjs                 # 12개 화면 전부
 *   node scripts/screenshot-figma.mjs --route /search
 *   node scripts/screenshot-figma.mjs --out /tmp/ref
 *
 * 처음 한 번은 저장소를 받아 빌드해야 한다(`--repo`로 받은 자리를 알려준다):
 *
 *   git clone --depth 1 https://github.com/jsexy0210-ship-it/docs/design/figma-export <자리>
 *   cd <자리> && npm install && npx vite build
 *
 * 앱 쪽은 `scripts/screenshot-screens.mjs`로 찍는다. **크기를 맞춰 찍는다** —
 * 피그마 셸이 `max-w-[430px]`이라 여기 기본도 430이다. 390으로 찍은 앱 화면과
 * 나란히 놓으면 폭이 달라 없는 차이가 보인다.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';

/** 피그마 라우터(`src/app/routes.ts`)에 있는 화면 전부. 늘어나면 여기에 더한다. */
const ROUTES = [
  '/',
  '/search',
  '/pick',
  '/our-wedding',
  '/my',
  '/community',
  /*
   * 라우터에 걸려 있는데 이 목록에 없던 화면. **글 상세다**(`FlowScreens.tsx`
   * `FeedDetailPage`). 2026-09-16에 웨딩피드 글 상세를 만들면서 「피그마에 글
   * 상세가 없다」고 적을 뻔했다 — 이 목록만 봤기 때문이다. 목록이 라우터보다
   * 짧으면 없는 화면과 안 적어 둔 화면이 같아 보인다.
   */
  '/community/feed/1',
  '/vendor/1',
  '/vendor/1/booking',
  '/vendor/1/consult',
  '/onboarding',
  '/login',
  '/contract-verify',
];

/** 피그마 셸의 폭. `Root.tsx`의 `max-w-[430px]`에서 온다. */
const VIEWPORT = { width: 430, height: 932 };

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

function parseArgs(argv) {
  const opts = {
    routes: [],
    out: join(tmpdir(), 'weddingpick-figma'),
    repo: '/home/user/jsexy0210-ship-it/docs/design/figma-export',
    wait: 2500,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--route') opts.routes.push(argv[++i]);
    else if (arg === '--out') opts.out = argv[++i];
    else if (arg === '--repo') opts.repo = argv[++i];
    else if (arg === '--wait') opts.wait = Number(argv[++i]);
    else throw new Error(`모르는 인자: ${arg}`);
  }

  if (opts.routes.length === 0) opts.routes.push(...ROUTES);

  return opts;
}

/**
 * playwright는 이 저장소의 의존성이 아니다 — 컨테이너에 전역으로 깔려 있다.
 * `scripts/screenshot-screens.mjs`와 같은 방식으로 찾는다.
 */
function loadPlaywright() {
  const req = createRequire(import.meta.url);

  try {
    return req('playwright');
  } catch {
    return req(join(execSync('npm root -g').toString().trim(), 'playwright'));
  }
}

/**
 * dist를 내주되 **없는 경로는 index.html로 돌린다.**
 * 피그마는 `createBrowserRouter`를 써서 `/search` 같은 주소에 파일이 없다.
 */
function startStaticServer(root) {
  const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const direct = join(root, pathname);
    const file = direct.startsWith(root) && extname(direct) && existsSync(direct)
      ? direct
      : join(root, 'index.html');

    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function fileNameFor(route) {
  return route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '-');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const dist = join(opts.repo, 'dist');

  if (!existsSync(dist)) {
    throw new Error(
      `빌드된 시안이 없다: ${dist}\n` +
        `먼저 받아서 빌드한다:\n` +
        `  git clone --depth 1 https://github.com/jsexy0210-ship-it/docs/design/figma-export ${opts.repo}\n` +
        `  cd ${opts.repo} && npm install && npx vite build`,
    );
  }

  mkdirSync(opts.out, { recursive: true });

  const { chromium } = loadPlaywright();
  const { server, port } = await startStaticServer(dist);
  /** 컨테이너의 chromium 판이 playwright가 찾는 것과 다를 때 직접 가리킨다. */
  const executablePath = process.env.CHROMIUM_PATH || undefined;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await context.newPage();

  try {
    for (const route of opts.routes) {
      const name = fileNameFor(route);

      await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(opts.wait);
      await page.screenshot({ path: join(opts.out, `${name}.png`), fullPage: true });
      console.log(`${route} → ${join(opts.out, `${name}.png`)}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
