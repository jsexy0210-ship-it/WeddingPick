#!/usr/bin/env node
/**
 * 화면의 **좌우 끝선을 픽셀로 잰다.**
 *
 * **왜 있는가.** 2026-09-15에 대표님이 「모든 콘텐츠의 좌우 끝선을 동일한 마진 기준으로
 * 정렬 / 버튼 좌우 여백 불일치」를 찾아 정규화하라고 하셨다. 그때까지 우리가 어긋남을
 * 찾던 방법은 **코드를 눈으로 읽는 것**이었고, 그 방식은 4px 차이를 절대 못 잡는다 —
 * 2026-09-11에 세션 셋이 그렇게 하고 검색 화면이 시안과 전혀 다른 채로 배포됐다.
 *
 * 그래서 잰다. 브라우저가 실제로 그린 `getBoundingClientRect()`의 left·right를 그대로
 * 꺼내므로 해석이 낄 자리가 없다.
 *
 *   node scripts/measure-edges.mjs --target figma          # 피그마 시안을 잰다(기준값)
 *   node scripts/measure-edges.mjs --target app            # 우리 앱을 잰다
 *   node scripts/measure-edges.mjs --target figma --json out.json
 *
 * **기준값은 피그마다.** 우리 코드의 최빈값이 기준이 되는 것이 아니다(CLAUDE.md 최상위
 * 정책 규칙 1번). 이 스크립트가 앱을 재는 것은 「피그마와 얼마나 어긋나 있는지」를 재기
 * 위해서지, 우리 값으로 기준을 정하기 위해서가 아니다.
 *
 * 수는 여기서, 생김새는 `scripts/screenshot-figma.mjs`·`screenshot-screens.mjs`로 본다.
 */
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { extname, join, resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { matchRoute } from './fixtures/api.cjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 재는 자리. 피그마 쪽 경로는 `extract-figma-spec.mjs`의 ROUTES와 같다 — 같은 화면을
 * 재야 두 수를 나란히 놓을 수 있다.
 */
const TARGETS = {
  figma: {
    dist: '/home/user/jsexy0210-ship-it/weddingpick_figma/dist',
    /** 피그마 셸의 폭. `Root.tsx`의 `max-w-[430px]`에서 온다. */
    viewport: { width: 430, height: 932 },
    routes: [
      '/', '/search', '/pick', '/our-wedding', '/my', '/community',
      '/vendor/1', '/vendor/1/booking', '/vendor/1/consult',
      '/onboarding', '/login', '/contract-verify',
    ],
    hint: 'cd /home/user/jsexy0210-ship-it/weddingpick_figma && npm install && npx vite build',
  },
  app: {
    dist: join(REPO, 'apps/mobile/dist'),
    /** 시안 `phone` 크기. `screenshot-screens.mjs`와 같은 값이다. */
    viewport: { width: 390, height: 844 },
    /* 피그마의 12개 화면과 짝이 맞는 자리. 경로 꼴은 `docs/screen-capture.md`를 따른다. */
    routes: [
      '/(tabs)/index.html', '/(tabs)/search/index.html', '/(tabs)/pick/index.html',
      '/(tabs)/wedding/index.html', '/(tabs)/my/index.html', '/(tabs)/community/index.html',
      '/onboarding.html', '/login/index.html',
    ],
    hint: 'node scripts/screenshot-screens.mjs --build',
  },
};

/**
 * 「같은 기준선인데 살짝 어긋난 것」으로 볼 최대 거리.
 *
 * 40px 들어간 노드는 카드 안에 일부러 넣은 것이고, 20px 자리에 24px 하나가 섞인 것은
 * 어긋난 것이다. 8을 넘기면 의도한 중첩까지 어긋남으로 세게 되고, 4로 줄이면
 * 24 대 20 같은 실제 사고를 놓친다.
 */
const NEAR = 8;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon',
};

function parseArgs(argv) {
  const opts = { target: 'figma', routes: [], json: null, wait: 2500 };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--target') opts.target = argv[++i];
    else if (arg === '--route') opts.routes.push(argv[++i]);
    else if (arg === '--json') opts.json = argv[++i];
    else if (arg === '--wait') opts.wait = Number(argv[++i]);
    else throw new Error(`모르는 인자: ${arg}`);
  }

  if (!TARGETS[opts.target]) throw new Error(`--target은 figma 또는 app이다: ${opts.target}`);
  if (opts.routes.length === 0) opts.routes.push(...TARGETS[opts.target].routes);

  return opts;
}

function loadPlaywright() {
  const req = createRequire(import.meta.url);

  try {
    return req('playwright');
  } catch {
    return req(join(execSync('npm root -g').toString().trim(), 'playwright'));
  }
}

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

  return new Promise((resolve_) => {
    server.listen(0, '127.0.0.1', () => resolve_({ server, port: server.address().port }));
  });
}

/**
 * 브라우저 안에서 도는 코드.
 *
 * **셸을 먼저 찾는다.** 피그마는 430 컨테이너를 화면 가운데 세우고, 앱은 그냥 body가
 * 폭 전체다. 셸의 왼쪽 끝을 0으로 잡지 않으면 가운데 정렬분만큼 모든 수가 밀린다.
 */
const COLLECT = (nearPx) => {
  /** 눈에 보이고 자리를 차지하는 노드만. */
  const visible = (el) => {
    const s = getComputedStyle(el);
    const box = el.getBoundingClientRect();

    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return null;
    if (box.width < 1 || box.height < 1) return null;

    return { s, box };
  };

  /*
   * 셸은 찾지 않고 **뷰포트를 그대로 쓴다.**
   *
   * 처음에는 body에서 내려가며 폭이 같은 컨테이너를 셸로 잡으려 했는데, 헤더가
   * 폭 전체를 차지하는 화면에서 헤더를 셸로 물고 거기서 멈췄다 — `/search`가 노드
   * 217개짜리인데 12개만 잡혔다. 피그마 셸도 앱도 뷰포트 폭에 꽉 차게 그리므로
   * (`Root.tsx`의 `max-w-[430px]`, 뷰포트도 430) 원점은 0이고 폭은 뷰포트다.
   */
  const origin = 0;
  const width = window.innerWidth;

  const nodes = [];
  /** 폭을 꽉 채운 조상인가 — 기준선을 만드는 것은 그 **바로 아래** 노드다. */
  const fullBleed = (box) => box.left <= 0 && box.rightInset <= 0;

  const walk = (el, depth, parent) => {
    const v = visible(el);
    let box = parent;

    if (v) {
      const left = Math.round(v.box.left) - origin;
      const right = Math.round(v.box.right) - origin;
      const own = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join(' ')
        .trim();

      box = {
        tag: el.tagName.toLowerCase(),
        depth,
        left,
        right,
        rightInset: width - right,
        w: Math.round(v.box.width),
        h: Math.round(v.box.height),
        text: own.slice(0, 40) || undefined,
        /* 버튼은 따로 센다 — 대표님이 콕 집으신 둘 중 하나다. */
        button: el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || undefined,
        padX: `${Math.round(parseFloat(v.s.paddingLeft) || 0)}/${Math.round(parseFloat(v.s.paddingRight) || 0)}`,
        /* 폭 전체인 조상 바로 아래로 처음 들어간 노드만 기준선을 만든다. */
        firstInset: Boolean(parent && fullBleed(parent) && (left > 0 || width - right > 0)),
      };
      nodes.push(box);
    }

    if (el.tagName.toLowerCase() === 'svg') return;
    for (const child of el.children) walk(child, v ? depth + 1 : depth, box);
  };

  walk(document.body, 0, null);

  /*
   * 전체 폭을 차지하는 노드(구분 밴드·배경·셸 자신)는 기준선을 정할 때 세지 않는다 —
   * 그것들은 어느 화면에서나 0이고, 세면 0이 최빈값이 되어 기준선이 0으로 잡힌다.
   */
  const inset = nodes.filter((n) => n.left > 0 || n.rightInset > 0);

  /*
   * **기준선을 만드는 것은 「폭 전체인 조상 바로 아래로 처음 들어간 노드」다.**
   *
   * 두 번 틀리고 여기에 왔다. 안쪽 노드를 전부 세니 `/our-wedding`이 41px로 나왔다 —
   * 달력 날짜 칸 수십 개가 최빈값을 가져갔다. 폭 절반 이상만 세니 `/search`·`/pick`이
   * 155px로 나왔다 — 카드 안쪽 본문 열(썸네일 135 오른쪽)이 수십 개라 그쪽이 이겼다.
   *
   * 둘 다 **안에 들어앉은 것**이지 화면의 좌우 끝선이 아니다. 끝선을 만드는 것은
   * 화면 폭을 꽉 채운 컨테이너에서 처음 한 칸 들어간 자리 하나뿐이고, 그 아래는
   * 전부 그 안의 배치다.
   *
   * 가로 스크롤 캐러셀은 셸 밖으로 나가므로(rightInset이 음수) 같이 뺀다.
   */
  const anchors = inset.filter((n) => n.firstInset && n.left >= 0 && n.rightInset >= 0);

  const tally = (key) => {
    const counts = new Map();

    for (const n of anchors) counts.set(n[key], (counts.get(n[key]) ?? 0) + 1);

    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  };

  const leftTally = tally('left');
  const rightTally = tally('rightInset');
  const baseLeft = leftTally[0]?.[0] ?? 0;
  const baseRight = rightTally[0]?.[0] ?? 0;

  /** 기준선 「근처」인데 기준선이 아닌 것 — 이것이 어긋남이다. */
  const near = (value, base) => value !== base && Math.abs(value - base) <= nearPx;

  const offenders = anchors
    .filter((n) => near(n.left, baseLeft) || near(n.rightInset, baseRight))
    .map((n) => ({ ...n, baseLeft, baseRight }));

  return { width, baseLeft, baseRight, leftTally, rightTally, nodes: inset, anchors, offenders };
};

function fmtTally(tally, total) {
  return tally
    .slice(0, 8)
    .map(([value, count]) => `${value}px ×${count}${total ? ` (${Math.round((count / total) * 100)}%)` : ''}`)
    .join(' · ');
}

function report(target, results) {
  const lines = [`# 좌우 기준선 실측 — ${target}`, ''];

  for (const { route, data, error } of results) {
    lines.push(`## ${route}`);

    if (error) {
      lines.push(`  잴 수 없었다: ${error}`, '');
      continue;
    }

    const total = data.anchors.length;

    lines.push(`  셸 폭 ${data.width} · 안쪽 노드 ${data.nodes.length}개 · 기준선을 만드는 첫 들여쓰기 블록 ${total}개`);
    lines.push(`  왼쪽 기준선 ${data.baseLeft}px  —  ${fmtTally(data.leftTally, total)}`);
    lines.push(`  오른쪽 기준선 ${data.baseRight}px  —  ${fmtTally(data.rightTally, total)}`);

    if (data.offenders.length === 0) {
      lines.push('  기준선에서 살짝 어긋난 노드: 없음');
    } else {
      lines.push(`  기준선에서 살짝 어긋난 노드 ${data.offenders.length}개:`);
      for (const n of data.offenders.slice(0, 20)) {
        const label = n.text ? `"${n.text}"` : `${n.tag} ${n.w}×${n.h}`;
        const dl = n.left - data.baseLeft;
        const dr = n.rightInset - data.baseRight;
        const drift = [
          dl !== 0 && Math.abs(dl) <= NEAR ? `왼쪽 ${dl > 0 ? '+' : ''}${dl}` : null,
          dr !== 0 && Math.abs(dr) <= NEAR ? `오른쪽 ${dr > 0 ? '+' : ''}${dr}` : null,
        ].filter(Boolean).join(' · ');

        lines.push(`    ${label}  left ${n.left} / rightInset ${n.rightInset}  → ${drift}`);
      }
      if (data.offenders.length > 20) lines.push(`    … 그리고 ${data.offenders.length - 20}개 더`);
    }

    /* 버튼 좌우 여백 — 대표님이 콕 집으신 둘 중 하나다. */
    const buttons = data.nodes.filter((n) => n.button);
    const padCounts = new Map();

    for (const b of buttons) padCounts.set(b.padX, (padCounts.get(b.padX) ?? 0) + 1);

    if (buttons.length) {
      const pads = [...padCounts.entries()].sort((a, b) => b[1] - a[1]);

      lines.push(`  버튼 ${buttons.length}개 · 좌/우 패딩: ${pads.map(([p, c]) => `${p} ×${c}`).join(' · ')}`);

      /* 풀폭 버튼의 끝선이 화면 기준선과 맞는가. */
      const full = buttons.filter((b) => b.w >= data.width - data.baseLeft - data.baseRight - NEAR);
      const misaligned = full.filter((b) => b.left !== data.baseLeft || b.rightInset !== data.baseRight);

      if (full.length) {
        lines.push(
          `  풀폭 버튼 ${full.length}개 중 기준선 어긋남 ${misaligned.length}개` +
            (misaligned.length
              ? `: ${misaligned.map((b) => `"${b.text ?? b.tag}" ${b.left}/${b.rightInset}`).join(' · ')}`
              : ''),
        );
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const target = TARGETS[opts.target];

  if (!existsSync(target.dist)) {
    throw new Error(`빌드가 없다: ${target.dist}\n  ${target.hint}`);
  }

  const { chromium } = loadPlaywright();
  const { server, port } = await startStaticServer(target.dist);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: target.viewport, deviceScaleFactor: 2 });
  const results = [];

  /*
   * 앱은 로그인 가드와 서버 호출이 있다. `screenshot-screens.mjs`와 **같은 방식**으로
   * 연다 — `/v1/**`는 fixtures로 답하고 바깥 주소는 막고, 토큰은 기기 저장소에 심는다.
   * 제품 코드에 「재는 중일 때는 통과」를 넣지 않는다 — 그 구멍은 운영에 나간다.
   */
  if (opts.target === 'app') {
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname.startsWith('/v1/')) {
        const matched = matchRoute(route.request().method(), url.pathname);
        const body = matched === null
          ? { code: 'fixture_missing' }
          : (typeof matched.value === 'function'
            ? matched.value({ url, method: route.request().method(), params: matched.params })
            : matched.value);

        await route.fulfill({
          status: matched === null ? 404 : 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify(body),
        });

        return;
      }

      if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') await route.continue();
      else await route.abort();
    });

    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('weddingpick.sessionToken.v1', 'capture-token');
        window.localStorage.setItem('weddingpick.adminToken.v1', 'capture-token');
      } catch {
        /* 저장소를 못 쓰면 로그인 화면이 재어진다 — 그것도 사실이라 숨기지 않는다. */
      }
    });
  }

  for (const route of opts.routes) {
    try {
      await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(opts.wait);
      results.push({ route, data: await page.evaluate(COLLECT, NEAR) });
    } catch (err) {
      results.push({ route, error: err.message });
    }
  }

  await browser.close();
  server.close();

  const text = report(opts.target, results);

  process.stdout.write(`${text}\n`);

  if (opts.json) {
    await writeFile(opts.json, `${JSON.stringify(results, null, 2)}\n`);
    process.stderr.write(`\n${opts.json}에 적었다.\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
