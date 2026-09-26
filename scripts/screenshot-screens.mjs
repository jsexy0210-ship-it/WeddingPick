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
    edges: false,
    wait: 1500,
    /** 비워 두면 경로를 보고 정한다 — `/admin/…`은 1920, 나머지는 390. */
    viewport: null,
    /** 찍기 전에 눌러 둘 것들. 시트 · 펼침처럼 **눌러야 나오는 화면**을 찍는다. */
    taps: [],
    /** 토큰을 심지 않는다 — 로그인 화면(`/login`)처럼 로그인 전 화면을 찍을 때. */
    guest: false,
    expand: false,
    homeLoading: false,
    /** 이 경로로 시작하는 응답을 붙잡아 둔다 — 로딩 뼈대(WP-LOAD-004) · 보낸 뒤 기다리는 화면을 찍는다. 여러 번 줄 수 있다. */
    slow: [],
    /**
     * 파일 · 카메라 입력이 열리면 이 파일을 넣는다 — 예산 추가 «자동 등록»처럼 **OS 선택 창 뒤의
     * 화면**을 찍는다. 없으면 선택 창은 열리기만 하고 아무것도 들어가지 않는다(헤드리스 브라우저).
     */
    file: null,
    /**
     * 페이지가 뜨기 전에 기기 저장소(localStorage)에 심어 둘 값 `키=값`. 여러 번 줄 수 있다.
     * 서버가 아니라 기기에 적힌 상태(온보딩 답 · 초안)로만 닿는 화면을 찍는다 — 예:
     * 온보딩 완료 요약(WP-AUTH-007)은 적어 둔 다섯 답이 있어야 선다.
     */
    storage: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--route') opts.routes.push(argv[++i]);
    else if (arg === '--out') opts.out = resolve(argv[++i]);
    else if (arg === '--build') opts.build = true;
    else if (arg === '--full') opts.full = true;
    else if (arg === '--expand') { opts.expand = true; opts.full = true; }
    else if (arg === '--wait') opts.wait = Number(argv[++i]);
    else if (arg === '--tap') opts.taps.push(argv[++i]);
    else if (arg === '--edges') opts.edges = true;
    else if (arg === '--guest') opts.guest = true;
    else if (arg === '--home-loading') opts.homeLoading = true;
    else if (arg === '--slow') opts.slow.push(argv[++i]);
    else if (arg === '--file') opts.file = resolve(argv[++i]);
    else if (arg === '--storage') {
      const pair = argv[++i];
      const at = pair.indexOf('=');

      if (at <= 0) throw new Error(`--storage는 키=값 꼴이다: ${pair}`);
      opts.storage.push([pair.slice(0, at), pair.slice(at + 1)]);
    }
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

    /*
     * Expo의 static export는 generateStaticParams가 없는 동적 URL을 파일로 만들지 않는다.
     * 캡처 도구는 운영 정적 호스팅을 흉내 내는 것이 아니라 **브라우저에서 실제 라우트
     * 컴포넌트를 검증**하는 도구다. 문서 탐색 요청만 가장 가까운 정적 부모 HTML로
     * 되돌리고 URL은 그대로 둔다. 그러면 Expo Router가 location.pathname을 읽어
     * /search/:vendorId 같은 동적 화면을 클라이언트에서 렌더한다.
     *
     * 자산·API 요청까지 index.html로 덮으면 진짜 404를 숨기므로 Accept: text/html인
     * 문서 탐색에만 적용한다.
     */
    const wantsHtml = String(req.headers.accept ?? '').includes('text/html');

    if (wantsHtml) {
      const parts = pathname.split('/').filter(Boolean);

      for (let end = parts.length - 1; end >= 0; end -= 1) {
        const fallback = join(root, ...parts.slice(0, end), 'index.html');

        if (!fallback.startsWith(root) || !existsSync(fallback)) continue;

        try {
          const body = await readFile(fallback);

          res.writeHead(200, { 'content-type': MIME['.html'] });
          res.end(body);

          return;
        } catch {
          /* 읽을 수 없는 후보면 더 위 부모를 본다. */
        }
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
async function installFixtures(page, missing, blocked, opts) {
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
      /* 보낸 본문 — 상태를 기억하는 fixture(온보딩 «완료» → Pick)가 읽는다. JSON이 아니면 null. */
      let sent = null;

      try {
        sent = request.postDataJSON();
      } catch {
        sent = null;
      }

      const body = typeof value === 'function' ? value({ url, method, params, body: sent }) : value;

      // 홈 첫 진입 스켈레톤을 찍을 때만 데이터 응답을 늦춘다. 인증 응답은 그대로 둔다.
      if (opts.homeLoading && method === 'GET'
        && (url.pathname === '/v1/app/bootstrap' || url.pathname === '/v1/wedding-feed')) {
        await new Promise((resolve) => setTimeout(resolve, 5_000));
      }

      /* 쓰기도 붙잡는다 — «읽고 있어요»처럼 보낸 뒤 기다리는 화면을 찍는다(예산 추가 자동 등록). */
      if (opts.slow.some((prefix) => url.pathname.startsWith(prefix))) {
        await new Promise((resolve) => setTimeout(resolve, 30_000));
      }

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
 * 늘 나오지만 화면과 상관없는 콘솔 오류. **지금은 비어 있다.**
 *
 * React #419는 2026-09-18 main에서 고쳤다. `_layout.tsx`가 정적 export의 Node
 * 렌더 중 `window`를 읽던 것이 원인이었다. 이제 같은 오류가 다시 나오면 회귀다.
 * «원래 나는 것»으로 숨기지 않는다.
 */
const BENIGN_CONSOLE = [];

function safeName(route) {
  return route.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root';
}

async function captureRoute(context, origin, route, opts) {
  const missing = new Set();
  const blocked = new Set();
  const errors = [];
  const page = await context.newPage();

  const cdp = await context.newCDPSession(page);
  await cdp.send('Log.enable');
  cdp.on('Log.entryAdded', (e) => {
    const text = `[cdp:${e.entry.level}/${e.entry.source}] ${e.entry.text}`;
    if (BENIGN_CONSOLE.some((pattern) => pattern.test(text))) return;
    errors.push(text.slice(0, 400));
  });

  page.on('console', (message) => {
    const text = message.text();

    if (message.type() !== 'error' && message.type() !== 'warning') return;
    if (BENIGN_CONSOLE.some((pattern) => pattern.test(text))) return;

    errors.push(`[${message.type()}] ${text.slice(0, 400)}`);
  });
  page.on('pageerror', (error) => {
    const text = String(error);

    if (BENIGN_CONSOLE.some((pattern) => pattern.test(text))) return;

    errors.push(text.slice(0, 400));
  });

  await installFixtures(page, missing, blocked, opts);

  /* 파일 · 카메라 입력 — 열리면 준 파일을 넣고, 열렸다는 사실을 남긴다(열리지 않았는데 찍지 않게). */
  const fileChoosers = [];
  if (opts.file) {
    page.on('filechooser', async (chooser) => {
      const input = chooser.element();
      fileChoosers.push({
        accept: await input.getAttribute('accept'),
        capture: await input.getAttribute('capture'),
      });
      await chooser.setFiles(opts.file);
    });
  }

  /*
   * 토큰을 먼저 심는다. 로그인 가드(`_layout.tsx`)는 그대로 둔다 — 제품 코드에
   * 「캡처일 때는 통과」를 넣으면 그 구멍이 운영에 나간다.
   */
  if (!opts.guest) await page.addInitScript((key) => {
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

  if (opts.storage.length > 0) await page.addInitScript((pairs) => {
    for (const [key, value] of pairs) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* 저장소를 못 쓰면 심은 상태 없이 찍힌다 — 그것도 사실이다. */
      }
    }
  }, opts.storage);

  const response = await page.goto(`${origin}${route}`, {
    waitUntil: opts.homeLoading || opts.slow.length ? 'domcontentloaded' : 'networkidle',
  });

  if (!response?.ok()) {
    throw new Error(`캡처 경로가 HTTP ${response?.status() ?? '응답 없음'}를 돌려줬다: ${route}`);
  }

  await page.waitForTimeout(opts.wait);

  if ((await page.locator('body').innerText()).trim() === 'not found') {
    throw new Error(`캡처 경로가 not found 본문을 돌려줬다: ${route}`);
  }

  /*
   * 눌러야 나오는 화면 — 바텀시트 · 펼침 · 탭. 순서대로 누르고 매번 기다린다.
   * 이름은 `accessibilityLabel`을 먼저 보고, 없으면 화면에 적힌 글자로 찾는다.
   * **없으면 조용히 넘어가지 않는다** — 「눌렀다고 치고」 찍은 그림은 안 찍은 것보다
   * 나쁘다. 시트가 안 열린 화면을 시트라고 믿게 된다.
   */
  for (const label of opts.taps) {
    /*
     * 버튼 이름을 먼저 **정확히** 찾는다. getByLabel의 기본 부분일치는
     * "빼기"를 찾을 때 뒤에 깔린 "강남 A 웨딩홀 빼기"까지 잡아, 열린 dialog 대신
     * 배경 버튼을 다시 누르는 거짓 캡처를 만들었다.
     */
    /*
     * `fill:<이름>=<글자>` — 누르는 대신 입력칸에 글자를 넣는다(검색 시트처럼 **쳐야
     * 나오는 화면**). 이름은 입력칸의 `accessibilityLabel`이다.
     */
    if (label.startsWith('fill:')) {
      const [name, ...rest] = label.slice('fill:'.length).split('=');
      const field = page.getByLabel(name, { exact: true }).first();

      await field.waitFor({ state: 'attached', timeout: 8000 });
      await field.fill(rest.join('='));
      await page.waitForTimeout(opts.wait);
      continue;
    }

    const target = page
      .getByRole('button', { name: label, exact: true })
      .or(page.getByLabel(label, { exact: true }))
      .or(page.getByText(label, { exact: true }))
      .first();

    /*
     * `locator.click()`은 다른 요소가 겹치면 재시도만 하다 타임아웃으로 죽는다 —
     * 이 앱은 부팅 직후 뜨는 알림 배너(`InAppBrowserNotice`)가 자주 단추 위에
     * 걸친다. `el.focus(); el.click()`은 실제 DOM 클릭 이벤트를 그대로 내서
     * react-native-web의 Pressable이 받게 하면서도, 겹친 요소 때문에 죽지 않는다.
     */
    await target.waitFor({ state: 'attached', timeout: 8000 });
    await target.evaluate((el) => {
      el.focus();
      el.click();
    });
    await page.waitForTimeout(opts.wait);
  }

  const file = join(opts.out, `${safeName(route)}.png`);

  /*
   * **`--full`만으로는 접힌 아래가 안 찍힌다.** `fullPage`는 «문서» 높이를 늘리는데,
   * react-native-web의 `ScrollView`는 문서가 아니라 `overflow:auto`인 «안쪽 div»가
   * 스크롤된다. 그래서 화면 하나 높이에서 잘린 그림이 나오고, 그것을 「전체」라고
   * 믿게 된다 — 2026-09-16에 홈을 그렇게 찍어 대표님께 반쪽만 보여드렸다.
   *
   * 스크롤되는 것을 찾아 높이를 내용만큼 늘린다. 뷰포트를 고정한 조상(높이 100%)도
   * 같이 풀어야 늘어난 높이가 실제로 보인다.
   */
  /*
   * **`--full`만으로는 접힌 아래가 안 찍힌다.** `fullPage`는 «문서» 높이를 늘리는데,
   * react-native-web의 `ScrollView`는 문서가 아니라 `overflow:auto`인 «안쪽 div»가
   * 스크롤된다. 그래서 화면 하나 높이에서 잘린 그림이 나오고, 그것을 「전체」라고
   * 믿게 된다 — 2026-09-16에 홈을 그렇게 찍어 대표님께 반쪽만 보여드렸다.
   *
   * 스크롤되는 것을 찾아 높이를 내용만큼 늘린다.
   *
   * **그런데 이 수법이 어떤 화면에서는 «내용을 접는다».** Pick · 웨딩노트 · 라운지가
   * 그랬다 — 조상에 `height:auto`를 주면 flex로 늘어나 있던 칸이 제 내용만큼으로
   * 줄어들고, 화면이 844에서 223으로 무너진다. 요소는 그대로 살아 있어서 «개수»로는
   * 못 잡는다. **재는 것은 내용이 차지한 «범위»다.**
   *
   * 무너졌으면 되돌리고 안 편 채로 찍는다. 잘린 그림이 무너진 그림보다 낫고,
   * 무엇보다 **어느 쪽인지 말해준다** — 조용히 틀린 그림을 내보내지 않는다.
   */
  if (opts.expand) {
    const extent = () => page.evaluate(() => {
      const boxes = [...document.querySelectorAll('*')]
        .map((el) => el.getBoundingClientRect())
        .filter((box) => box.width > 0 && box.height > 0);

      if (boxes.length === 0) return 0;

      return Math.round(Math.max(...boxes.map((box) => box.bottom + window.scrollY)));
    });

    const before = await extent();

    await page.evaluate(() => {
      const touched = [];
      const scrollers = [...document.querySelectorAll('*')].filter((el) => {
        const style = getComputedStyle(el);
        return /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
      });

      const relax = (el, height) => {
        touched.push([el, el.getAttribute('style')]);
        el.style.setProperty('height', height, 'important');
        el.style.setProperty('max-height', 'none', 'important');
        el.style.setProperty('overflow', 'visible', 'important');
      };

      for (const el of scrollers) {
        for (let node = el.parentElement; node && node !== document.documentElement; node = node.parentElement) {
          relax(node, 'auto');
        }
        relax(el, `${el.scrollHeight}px`);
      }

      for (const el of [document.documentElement, document.body]) relax(el, 'auto');

      // 되돌릴 수 있게 남겨 둔다.
      window.__expandUndo = () => {
        for (const [el, style] of touched) {
          if (style === null) el.removeAttribute('style');
          else el.setAttribute('style', style);
        }
      };
    });
    await page.waitForTimeout(600);

    const after = await extent();

    if (after < before) {
      console.warn(
        `  !! --expand가 화면을 접었다 (${before}px → ${after}px). 되돌리고 안 편 채로 찍는다 — ` +
        '이 화면은 아래가 잘릴 수 있다.'
      );
      await page.evaluate(() => window.__expandUndo?.());
      await page.waitForTimeout(300);
    }
  }

  await page.screenshot({ path: file, fullPage: opts.full });

  /*
   * 좌우 끝선. **찍은 그림과 같은 순간에 잰다** — 따로 띄워서 재면 fixture도 토큰도
   * 없는 화면을 재게 되고, 전 화면이 시작 화면으로 떨어진 것을 모른 채 「전부 맞다」는
   * 숫자가 나온다. 실제로 그렇게 한 번 속았다.
   */
  const edges = opts.edges ? await measureEdges(page) : null;

  await page.close();

  return { route, file, missing: [...missing], blocked: [...blocked], errors, edges, fileChoosers };
}


/**
 * 한 화면 안에서 콘텐츠의 **좌우 끝선이 몇 종류인지** 센다.
 *
 * 기준선이 맞는다는 것은 제목 · 본문 · 카드 · 목록 · 버튼의 `left`가 한 값이고
 * `right`도 한 값이라는 뜻이다. 여러 값이 나오면 그 화면은 어긋나 있고, 몇 px
 * 어긋났는지가 그대로 나온다 — 2026-09-15 대표 지시 「모든 콘텐츠의 좌우 끝선을
 * 동일한 마진 기준으로 정렬」.
 *
 * 세지 않는 것: 화면을 꽉 채우는 틀(그것은 끝선이 아니라 바탕이다) · 너무 작은 것 ·
 * 안 보이는 것 · 여백이 80을 넘는 것(가운데 정렬된 안내 문구는 기준선이 아니다).
 */
async function measureEdges(page) {
  return page.evaluate(() => {
    const shell = document.documentElement.clientWidth;
    const tally = new Map();

    for (const el of document.querySelectorAll('body *')) {
      const rect = el.getBoundingClientRect();

      if (rect.width < 40 || rect.height < 8) continue;
      if (rect.width >= shell - 1) continue;

      const css = getComputedStyle(el);

      if (css.visibility === 'hidden' || css.display === 'none' || css.opacity === '0') continue;

      const left = Math.round(rect.left);
      const right = Math.round(shell - rect.right);

      if (left < 0 || right < 0 || left > 80 || right > 80) continue;

      const key = `${left}|${right}`;
      const seen = tally.get(key) ?? { n: 0, what: [] };

      seen.n += 1;
      if (seen.what.length < 2) {
        seen.what.push((el.textContent ?? '').trim().slice(0, 18) || `<${el.tagName.toLowerCase()}>`);
      }
      tally.set(key, seen);
    }

    return [...tally.entries()]
      .map(([key, seen]) => {
        const [left, right] = key.split('|').map(Number);

        return { left, right, count: seen.n, what: seen.what };
      })
      .sort((a, b) => b.count - a.count);
  });
}

const HELP = `화면을 실제로 렌더해 PNG로 찍는다.

  node scripts/screenshot-screens.mjs [옵션]

  --route <경로>   찍을 화면. 여러 번 줄 수 있다. 기본값 "/(tabs)/search/"
  --out <폴더>     저장 자리. 기본값은 저장소 밖(임시 폴더)이다 — PNG는 커밋하지 않는다.
  --build          dist를 새로 만든 뒤 찍는다.
  --full           화면 전체(스크롤 포함)를 찍는다. 기본은 390x844 한 화면.
  --wait <ms>      렌더를 기다리는 시간. 기본 1500.
  --tap <이름>     찍기 전에 누른다. 여러 번 줄 수 있고 준 순서대로 누른다.
  --guest          토큰을 심지 않는다 — 로그인 전 화면(/login)을 찍을 때.
  --storage 키=값  페이지가 뜨기 전에 localStorage에 심는다. 여러 번 줄 수 있다 — 기기에
                   적힌 상태(온보딩 답 등)로만 닿는 화면을 찍을 때.
                   눌러야 나오는 화면(바텀시트 · 펼침)을 찍을 때 쓴다. 못 찾으면 멈춘다.
  --home-loading   홈 데이터 응답을 5초 늦춰 첫 진입 스켈레톤을 찍는다.
  --file <경로>    파일 · 카메라 입력이 열리면 이 파일을 넣는다(OS 선택 창 뒤 화면을 찍을 때).
  --viewport WxH   창 크기. 기본은 경로를 보고 정한다 — /admin은 1920x1080, 나머지 390x844.
  --edges          좌우 끝선을 재서 같이 적는다. 한 화면 안에서 제목 · 본문 · 카드 ·
                   버튼의 시작선과 끝선이 갈라지는 자리를 숫자로 잡는다.
`;

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    process.stdout.write(HELP);

    return;
  }

  if (opts.build || !existsSync(DIST)) {
    process.stderr.write('· dist를 만든다 (몇 분 걸린다)\n');
    /* 주소가 바뀌어도 이전 Metro 번들을 재사용하지 않게 한다. */
    execSync('npm run export:web --workspace @weddingpick/mobile -- --clear', {
      cwd: REPO,
      stdio: 'inherit',
      /*
       * 주소는 형식만 맞으면 된다 — 나가는 요청은 브라우저가 전부 가로챈다.
       * 그래도 비워 두지는 않는다: 비면 `isServerConfigured`가 false가 되어
       * 서버를 아예 안 부르는 다른 화면이 찍힌다(api/config.ts).
       *
       * 포트 1은 Chromium이 ERR_UNSAFE_PORT로 접속 자체를 막는다(tcpmux) —
       * page.route가 가로채기도 전에 브라우저가 거부한다. 39999는 안전 목록 밖의
       * 높은 포트다.
       *
       * **경로 없이 origin만 둔다.** `client.ts`의 `send()`가 `${baseUrl}${path}`를
       * 단순 문자열 접합으로 만든다(URL 재해석이 아니다) — base가 `/capture`로
       * 끝나면 실제 요청 pathname이 `/capture/v1/...`가 되어 `installFixtures`의
       * `pathname.startsWith('/v1/')` 검사를 벗어난다. 그러면 가로채지 못한 요청이
       * 실제 네트워크로 나가고, 업체 상세처럼 fetch가 필요한 화면은 전부
       * «연결이 불안정해요»만 찍힌다 — fixture를 아무리 채워도 닿지 않는다.
       */
      env: { ...process.env, EXPO_PUBLIC_API_URL: 'http://127.0.0.1:39999' },
    });
  }

  await mkdir(opts.out, { recursive: true });

  const { chromium } = loadPlaywright();
  const { server, port } = await startStaticServer(DIST);
  /*
   * **설치된 브라우저를 직접 가리킬 수 있게 둔다.**
   *
   * Playwright는 자기 버전에 맞는 브라우저만 찾는다. 컨테이너에 이미 깔려 있어도
   * 번호가 다르면 「없다」고 하고 `npx playwright install`을 하라고 한다 — 그
   * 한 줄 때문에 **캡처를 한 번도 못 돌린 채 「환경에서 안 된다」로 넘어갔다.**
   * 실제로 2026-09-15에 그랬다.
   *
   * `CHROMIUM_PATH`를 주면 그것을 쓴다. 없으면 지금까지처럼 알아서 찾는다.
   */
  const executablePath = process.env.CHROMIUM_PATH || undefined;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
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

      if (opts.file) {
        process.stdout.write(
          result.fileChoosers.length
            ? `  파일 입력 ${result.fileChoosers.length}번 열림: ${result.fileChoosers.map((c) => `accept=${c.accept} capture=${c.capture}`).join(' · ')}\n`
            : '  !! 파일 입력이 열리지 않았다 — --file을 줬는데 넣을 자리가 없었다\n'
        );
      }

      if (result.errors.length) {
        process.stdout.write(`  콘솔 오류:\n${result.errors.map((e) => `    ${e}\n`).join('')}`);
      }

      if (result.edges) {
        const lines = result.edges
          .slice(0, 6)
          .map(
            (e) =>
              `    좌 ${String(e.left).padStart(3)}  우 ${String(e.right).padStart(3)}  ${String(e.count).padStart(2)}개` +
              `${e.left === e.right ? '  ' : '  ← 비대칭'}  ${e.what.join(' · ')}\n`
          )
          .join('');

        process.stdout.write(`  좌우 끝선:\n${lines}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
}

await main();
