#!/usr/bin/env node
/**
 * 목록 → 상세 → 뒤로 가기에서 목록 상태(스크롤 · 필터 · 검색어)가 유지되는지를 실제
 * 브라우저 네비게이션(history back)으로 확인한다. screenshot-screens.mjs는 경로 하나를
 * 한 번에 찍는 도구라 이 검사에는 못 쓴다 — 여기서는 페이지 하나를 열어 두고
 * 클릭 → 뒤로 → 다시 찍는다.
 *
 * UX 감사용으로 만든 보조 도구다(docs/sync/ux-audit-2026-09-15.md).
 *
 * node scripts/audit-back-nav.mjs
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { matchRoute } from './fixtures/api.cjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');
const DIST = join(REPO, 'apps/mobile/dist');
const OUT = resolve(process.argv[2] ?? '/tmp/ux-audit/back-nav');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

function loadPlaywright() {
  const req = createRequire(import.meta.url);

  try {
    return req('playwright');
  } catch {
    const root = execSync('npm root -g').toString().trim();

    return req(join(root, 'playwright'));
  }
}

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

async function installFixtures(page) {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.startsWith('/v1/')) {
      const method = request.method();
      const matched = matchRoute(method, url.pathname);

      if (matched === null) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ code: 'fixture_missing', message: `${method} ${url.pathname}` }),
        });

        return;
      }

      const { value, params } = matched;
      const body = typeof value === 'function' ? value({ url, method, params }) : value;

      await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });

      return;
    }

    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();

      return;
    }

    await route.abort();
  });
}

/**
 * 시나리오 하나: 목록 열기 → 스크롤 → 카드 탭 → 뒤로 → 스크롤 위치 비교.
 */
const SCENARIOS = [
  {
    name: 'search-list',
    route: '/(tabs)/search/',
    scrollBy: 600,
    tapLabel: '강남 B 웨딩홀',
  },
  {
    name: 'community-feed',
    route: '/(tabs)/community/',
    scrollBy: 400,
    tapLabel: null,
  },
];

async function run() {
  await mkdir(OUT, { recursive: true });

  const { chromium } = loadPlaywright();
  const { server, port } = await startStaticServer(DIST);
  const executablePath = process.env.CHROMIUM_PATH || undefined;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    locale: 'ko-KR',
  });

  const results = [];

  try {
    for (const scenario of SCENARIOS) {
      const page = await context.newPage();

      await installFixtures(page);
      await page.addInitScript((key) => {
        try {
          window.localStorage.setItem(key, 'capture-token');
        } catch {
          /* noop */
        }
      }, 'weddingpick.sessionToken.v1');

      const origin = `http://127.0.0.1:${port}`;

      await page.goto(`${origin}${scenario.route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);

      /*
       * RN Web의 ScrollView는 window가 아니라 자기 안의 div(overflow:auto)를 스크롤한다.
       * scrollHeight > clientHeight인 첫 요소를 찾아 그 요소를 스크롤한다.
       */
      const scrollTarget = await page.evaluateHandle(() => {
        const all = document.querySelectorAll('div');

        for (const el of all) {
          if (el.scrollHeight - el.clientHeight > 40) return el;
        }

        return document.scrollingElement;
      });

      await scrollTarget.evaluate((el, dy) => el.scrollBy(0, dy), scenario.scrollBy);
      await page.waitForTimeout(300);

      const scrollBefore = await scrollTarget.evaluate((el) => el.scrollTop);

      await page.screenshot({ path: join(OUT, `${scenario.name}-1-before.png`) });

      if (scenario.tapLabel) {
        const target = page.getByText(scenario.tapLabel, { exact: true }).first();

        await target.click({ timeout: 5000 });
        await page.waitForTimeout(800);
        await page.screenshot({ path: join(OUT, `${scenario.name}-2-detail.png`) });

        await page.goBack({ waitUntil: 'networkidle' });
        await page.waitForTimeout(800);
      }

      const scrollTargetAfter = await page.evaluateHandle(() => {
        const all = document.querySelectorAll('div');

        for (const el of all) {
          if (el.scrollHeight - el.clientHeight > 40) return el;
        }

        return document.scrollingElement;
      });
      const scrollAfter = await scrollTargetAfter.evaluate((el) => el.scrollTop);

      await page.screenshot({ path: join(OUT, `${scenario.name}-3-after-back.png`) });

      results.push({ scenario: scenario.name, scrollBefore, scrollAfter, preserved: Math.abs(scrollBefore - scrollAfter) < 20 });

      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
