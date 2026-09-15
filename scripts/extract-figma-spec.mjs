#!/usr/bin/env node
/**
 * 피그마 화면의 **모든 노드 수치를 뽑아** 규격서로 낸다.
 *
 * **왜 있는가.** 2026-09-15에 대표님이 「피그마 디자인 그대로 프론트 만들라고, 임의로
 * 만들지 말라」고 하셨다. 그 전까지 세션들은 시안 그림과 우리 화면을 눈으로 견주며
 * 고쳤고, 그 방식은 **반드시 해석이 섞인다** — 실제로 한 세션이 준비 현황의 글자 위계를
 * 「2×2로 넓어졌으니 업종명을 크게」라고 판단해서 뒤집었다. 그럴듯하지만 시킨 적 없는
 * 일이다. 눈대중으로 맞추는 한 이런 일은 계속 난다.
 *
 * 그래서 **재서 준다.** 브라우저가 계산한 값을 그대로 꺼내므로 해석이 낄 자리가 없다.
 * 화면을 만드는 쪽은 이 JSON의 수를 그대로 옮기면 된다.
 *
 *   node scripts/extract-figma-spec.mjs                    # 12개 화면 전부
 *   node scripts/extract-figma-spec.mjs --route /search
 *   node scripts/extract-figma-spec.mjs --out docs/figma-spec
 *
 * 그림은 `scripts/screenshot-figma.mjs`가 찍는다. 둘을 같이 본다 — 수는 여기서,
 * 생김새는 거기서.
 */
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';

const ROUTES = [
  '/', '/search', '/pick', '/our-wedding', '/my', '/community',
  '/vendor/1', '/vendor/1/booking', '/vendor/1/consult',
  '/onboarding', '/login', '/contract-verify',
];

/** 피그마 셸의 폭. `Root.tsx`의 `max-w-[430px]`에서 온다. */
const VIEWPORT = { width: 430, height: 932 };

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon',
};

function parseArgs(argv) {
  const opts = {
    routes: [],
    out: join(tmpdir(), 'weddingpick-figma-spec'),
    repo: '/home/user/jsexy0210-ship-it/weddingpick_figma',
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

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/**
 * 브라우저 안에서 도는 코드. **계산된 값만 꺼낸다** — 클래스 이름이 아니라
 * 실제로 그려진 수다. `rounded-2xl`이 몇 px인지 따지지 않아도 된다.
 */
const COLLECT = () => {
  const px = (v) => Math.round(parseFloat(v) || 0);

  /*
   * 색을 1×1 캔버스에 칠해 픽셀로 되읽는다.
   *
   * 크로미움은 `color-mix`와 투명도가 섞인 색을 `oklab(0.999994 … / 0.55)`처럼
   * 돌려준다. 그 문자열을 그대로 규격서에 적으면 **화면을 만드는 쪽이 옮겨 적을 수가
   * 없다.** 칠해서 되읽으면 어떤 표기로 왔든 sRGB 한 가지로 떨어진다.
   */
  const paint = document.createElement('canvas').getContext('2d', { willReadFrequently: true });

  paint.canvas.width = 1;
  paint.canvas.height = 1;

  const rgb = (v) => {
    if (v === 'rgba(0, 0, 0, 0)' || v === 'transparent') return v;

    let r;
    let g;
    let b;
    let a;
    const direct = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(v);

    if (direct) {
      [r, g, b] = [1, 2, 3].map((i) => Number(direct[i]));
      a = direct[4] === undefined ? 1 : Number(direct[4]);
    } else {
      paint.clearRect(0, 0, 1, 1);
      paint.fillStyle = '#000000';
      paint.fillStyle = v;
      /* 파싱에 실패하면 fillStyle이 안 바뀐다 — 검정으로 뭉개지 말고 원문을 돌려준다. */
      if (paint.fillStyle === '#000000' && !/^#0{3,8}$/i.test(v)) return v;
      paint.fillRect(0, 0, 1, 1);
      const d = paint.getImageData(0, 0, 1, 1).data;

      [r, g, b] = [d[0], d[1], d[2]];
      a = d[3] / 255;
    }

    const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase();

    return a >= 0.999 ? hex : `${hex} ${Math.round(a * 100)}%`;
  };

  /** 이 노드가 제 글자를 직접 들고 있나. 자식의 글자는 세지 않는다. */
  const ownText = (el) =>
    [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();

  const describe = (el, depth) => {
    const s = getComputedStyle(el);
    const box = el.getBoundingClientRect();

    if (box.width === 0 && box.height === 0) return null;
    if (s.display === 'none' || s.visibility === 'hidden') return null;

    const node = { tag: el.tagName.toLowerCase(), depth, w: px(box.width), h: px(box.height) };
    const text = ownText(el);

    if (text) node.text = text.slice(0, 60);

    /* 글자 — 크기 · 굵기 · 색 · 줄높이 · 자간. 글자가 있는 노드만 적는다. */
    if (text) {
      node.font = `${px(s.fontSize)}/${s.fontWeight}`;
      node.color = rgb(s.color);
      if (px(s.lineHeight)) node.lineHeight = px(s.lineHeight);
      if (s.letterSpacing !== 'normal') node.letterSpacing = s.letterSpacing;
      if (s.textAlign !== 'start') node.textAlign = s.textAlign;
    }

    /* 배치 — flex · grid일 때만. 그 외에는 적어도 쓸 데가 없다. */
    if (s.display.includes('flex') || s.display.includes('grid')) {
      node.layout = s.display;
      if (s.flexDirection !== 'row') node.direction = s.flexDirection;
      if (px(s.gap)) node.gap = px(s.gap);
      if (s.justifyContent !== 'normal') node.justify = s.justifyContent;
      if (s.alignItems !== 'normal') node.align = s.alignItems;
      if (s.flexWrap !== 'nowrap') node.wrap = s.flexWrap;
      if (s.gridTemplateColumns !== 'none') node.columns = s.gridTemplateColumns;
    }

    const pad = [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(px);

    if (pad.some(Boolean)) node.padding = pad.join(' ');

    const mar = [s.marginTop, s.marginRight, s.marginBottom, s.marginLeft].map(px);

    if (mar.some(Boolean)) node.margin = mar.join(' ');

    if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') node.background = rgb(s.backgroundColor);
    if (px(s.borderTopLeftRadius)) node.radius = px(s.borderTopLeftRadius);
    if (px(s.borderTopWidth)) node.border = `${px(s.borderTopWidth)} ${rgb(s.borderTopColor)}`;
    if (s.boxShadow !== 'none') node.shadow = s.boxShadow;
    if (s.position !== 'static') node.position = s.position;
    if (el.tagName === 'IMG') node.src = el.getAttribute('src');
    if (el.tagName === 'SVG' || el.tagName === 'svg') node.icon = true;

    return node;
  };

  const out = [];
  const walk = (el, depth) => {
    const node = describe(el, depth);

    if (node) out.push(node);

    /* svg 안쪽은 들어가지 않는다 — path 수백 개가 규격서를 덮는다. */
    if (el.tagName.toLowerCase() === 'svg') return;

    for (const child of el.children) walk(child, node ? depth + 1 : depth);
  };

  walk(document.body, 0);

  return out;
};

/** 사람이 읽는 꼴. JSON보다 이쪽을 먼저 본다. */
function toText(route, nodes) {
  const lines = [`# ${route}`, '', `노드 ${nodes.length}개 · 폭 ${VIEWPORT.width}`, ''];

  for (const n of nodes) {
    const parts = [];

    if (n.text) parts.push(`"${n.text}"`);
    if (n.font) parts.push(`${n.font} ${n.color}`);
    if (n.lineHeight) parts.push(`lh ${n.lineHeight}`);
    if (n.letterSpacing) parts.push(`ls ${n.letterSpacing}`);
    if (n.layout) parts.push(n.direction ? `${n.layout}/${n.direction}` : n.layout);
    if (n.columns) parts.push(`cols ${n.columns}`);
    if (n.gap) parts.push(`gap ${n.gap}`);
    if (n.justify) parts.push(`justify ${n.justify}`);
    if (n.align) parts.push(`align ${n.align}`);
    if (n.wrap) parts.push(`wrap`);
    if (n.padding) parts.push(`pad ${n.padding}`);
    if (n.margin) parts.push(`mar ${n.margin}`);
    if (n.background) parts.push(`bg ${n.background}`);
    if (n.radius) parts.push(`r${n.radius}`);
    if (n.border) parts.push(`border ${n.border}`);
    if (n.shadow) parts.push('shadow');
    if (n.icon) parts.push('svg');
    if (n.src) parts.push(`img ${n.src.slice(0, 40)}`);

    lines.push(`${'  '.repeat(n.depth)}${n.tag} ${n.w}×${n.h}  ${parts.join(' · ')}`);
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const dist = join(opts.repo, 'dist');

  if (!existsSync(dist)) {
    throw new Error(
      `빌드된 시안이 없다: ${dist}\n` +
        `  git clone --depth 1 https://github.com/jsexy0210-ship-it/weddingpick_figma ${opts.repo}\n` +
        `  cd ${opts.repo} && npm install && npx vite build`,
    );
  }

  await mkdir(opts.out, { recursive: true });

  const { chromium } = loadPlaywright();
  const { server, port } = await startStaticServer(dist);
  const executablePath = process.env.CHROMIUM_PATH || undefined;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  try {
    for (const route of opts.routes) {
      const name = route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '-');

      await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(opts.wait);

      const nodes = await page.evaluate(COLLECT);

      await writeFile(join(opts.out, `${name}.json`), `${JSON.stringify(nodes, null, 2)}\n`);
      await writeFile(join(opts.out, `${name}.txt`), toText(route, nodes));
      console.log(`${route} → ${name}.txt · ${name}.json (노드 ${nodes.length})`);
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
