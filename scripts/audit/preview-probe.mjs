#!/usr/bin/env node
/**
 * 실제 배포 프리뷰(예: weddingpick-app-web.onrender.com)를 열어 경로마다
 * 콘솔 오류 · 실패한 네트워크 요청 · 첫 로드 시간을 찍는다. 코드는 건드리지
 * 않는다 — 읽기 전용 검수 도구다.
 *
 * `scripts/screenshot-screens.mjs`와 달리 로컬 fixture 빌드가 아니라 **실제
 * 배포된 서버**를 연다. 화면 코드만 보는 것이 아니라 실제 API 응답 · 로그인
 * 가드 · 네트워크 상태까지 함께 본다(2026-09-15 UX 검수, docs/sync/ux-audit-2026-09-15.md).
 *
 * 사용:
 *   node scripts/audit/preview-probe.mjs
 *   node scripts/audit/preview-probe.mjs --base-url https://weddingpick-app-web.onrender.com \
 *     --route / --route /login
 *
 * 이 컨테이너처럼 아웃바운드 HTTPS가 정책 프록시로 재종단되는 환경이면
 * `NODE_EXTRA_CA_CERTS`(또는 `SSL_CERT_FILE`)가 그 프록시 CA를 가리키고
 * 있을 것이다 — 있으면 그 번들 안의 인증서들의 SPKI 해시만 Chromium에
 * 신뢰 예외로 넘긴다(TLS 검증을 통째로 끄지 않는다. 이미 이 세션의 다른
 * 모든 도구가 신뢰하는 CA와 똑같은 것만 브라우저에도 신뢰시키는 것이다).
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync, mkdirSync } from 'node:fs';
import { X509Certificate, createHash } from 'node:crypto';

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  try {
    return req('playwright');
  } catch {
    const root = execSync('npm root -g').toString().trim();
    return req(join(root, 'playwright'));
  }
}

/** 프록시 CA 번들이 있으면 그 안의 인증서마다 SPKI(sha256) 해시를 뽑는다. */
function trustedSpkiHashes() {
  const bundlePath = process.env.NODE_EXTRA_CA_CERTS || process.env.SSL_CERT_FILE;
  if (!bundlePath) return [];
  let pem;
  try {
    pem = readFileSync(bundlePath, 'utf8');
  } catch {
    return [];
  }
  const certs = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];
  const hashes = [];
  for (const certPem of certs) {
    try {
      const cert = new X509Certificate(certPem);
      const der = cert.publicKey.export({ type: 'spki', format: 'der' });
      hashes.push(createHash('sha256').update(der).digest('base64'));
    } catch {
      /* 파싱 안 되는 인증서는 건너뛴다 */
    }
  }
  return hashes;
}

function parseArgs(argv) {
  const opts = {
    baseUrl: 'https://weddingpick-app-web.onrender.com',
    routes: [],
    out: join('/tmp', 'weddingpick-preview-probe'),
    viewport: { width: 430, height: 932 },
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--base-url') opts.baseUrl = argv[++i];
    else if (arg === '--route') opts.routes.push(argv[++i]);
    else if (arg === '--out') opts.out = argv[++i];
    else if (arg === '--viewport') {
      const [w, h] = argv[++i].split('x').map(Number);
      opts.viewport = { width: w, height: h };
    } else throw new Error(`모르는 인자: ${arg}`);
  }
  if (opts.routes.length === 0) opts.routes.push('/', '/login');
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  mkdirSync(opts.out, { recursive: true });

  const { chromium } = loadPlaywright();
  const spkiHashes = trustedSpkiHashes();
  const args = [];
  if (spkiHashes.length) {
    args.push(`--ignore-certificate-errors-spki-list=${spkiHashes.join(',')}`);
  }
  const executablePath = process.env.CHROMIUM_PATH || undefined;
  const browser = await chromium.launch({ executablePath, headless: true, args });
  const context = await browser.newContext({ viewport: opts.viewport, locale: 'ko-KR' });
  const page = await context.newPage();

  const consoleErrors = [];
  const failedRequests = [];
  const badStatus = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push({ url: page.url(), text: msg.text() }); });
  page.on('pageerror', (err) => consoleErrors.push({ url: page.url(), text: `pageerror: ${err.message}` }));
  page.on('requestfailed', (req) => failedRequests.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText, page: page.url() }));
  page.on('response', (res) => { if (res.status() >= 400) badStatus.push({ url: res.url(), status: res.status(), page: page.url() }); });

  const results = [];
  for (const route of opts.routes) {
    const url = opts.baseUrl.replace(/\/$/, '') + route;
    const t0 = Date.now();
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(1200);
      const ms = Date.now() - t0;
      const text = await page.evaluate(() => document.body.innerText).catch(() => '');
      const shotName = (route.replace(/\//g, '_') || 'root') + '.png';
      await page.screenshot({ path: join(opts.out, shotName) }).catch(() => {});
      results.push({ route, ms, finalUrl: page.url(), textSnippet: text.slice(0, 300) });
      process.stdout.write(`✓ ${route} (${ms}ms) → ${page.url()}\n`);
    } catch (e) {
      results.push({ route, error: String(e) });
      process.stdout.write(`✗ ${route}: ${e}\n`);
    }
  }

  process.stdout.write(`\n콘솔 오류 ${consoleErrors.length}건, 실패 요청 ${failedRequests.length}건, 4xx/5xx ${badStatus.length}건\n`);
  const fs = await import('node:fs/promises');
  await fs.writeFile(join(opts.out, 'log.json'), JSON.stringify({ results, consoleErrors, failedRequests, badStatus }, null, 2));
  process.stdout.write(`상세 로그: ${join(opts.out, 'log.json')}\n`);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
