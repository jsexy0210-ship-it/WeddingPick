#!/usr/bin/env node
/**
 * 실제 배포 프리뷰의 로그인 화면을 심층으로 본다 — 버튼 목록 · 카카오 클릭 시
 * 실제로 나가는 OAuth 요청까지 확인한다. `preview-probe.mjs`와 같은 이유로
 * 만들었다(docs/sync/ux-audit-2026-09-15.md). 읽기 전용, 코드 변경 없음.
 *
 * 이 세션처럼 카카오·애플 도메인이 네트워크 정책에 없는 환경에서는 리다이렉트가
 * `ERR_TUNNEL_CONNECTION_FAILED`로 막힌다 — 그래도 **요청이 어떻게 만들어졌는지**
 * (client_id · redirect_uri · PKCE · scope)는 실패 전에 잡아서 보여준다.
 *
 * 사용:
 *   node scripts/audit/preview-login-probe.mjs
 *   node scripts/audit/preview-login-probe.mjs --base-url https://210.109.82.212
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
      /* skip */
    }
  }
  return hashes;
}

function parseArgs(argv) {
  const opts = {
    baseUrl: 'https://210.109.82.212',
    out: join('/tmp', 'weddingpick-preview-login-probe'),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--base-url') opts.baseUrl = argv[++i];
    else if (arg === '--out') opts.out = argv[++i];
    else throw new Error(`모르는 인자: ${arg}`);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  mkdirSync(opts.out, { recursive: true });

  const { chromium } = loadPlaywright();
  const spkiHashes = trustedSpkiHashes();
  const args = spkiHashes.length ? [`--ignore-certificate-errors-spki-list=${spkiHashes.join(',')}`] : [];
  const executablePath = process.env.CHROMIUM_PATH || undefined;
  const browser = await chromium.launch({ executablePath, headless: true, args });
  const context = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: 'ko-KR' });
  const page = await context.newPage();

  const netEvents = [];
  page.on('requestfinished', async (req) => {
    try {
      const res = await req.response();
      netEvents.push({ url: req.url(), method: req.method(), status: res ? res.status() : null });
    } catch {
      /* ignore */
    }
  });
  page.on('requestfailed', (req) => netEvents.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText }));

  await page.goto(opts.baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForURL('**/login', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  process.stdout.write(`로그인 URL: ${page.url()}\n`);
  await page.screenshot({ path: join(opts.out, 'login.png') });

  const buttons = await page
    .$$eval('button, a[role="button"], [role="button"]', (els) =>
      els.map((el) => ({ tag: el.tagName, text: el.textContent?.trim().slice(0, 60) })))
    .catch(() => []);
  process.stdout.write(`버튼 목록: ${JSON.stringify(buttons)}\n`);

  const kakaoBtn = page.getByText(/카카오/).first();
  const kakaoCount = await page.getByText(/카카오/).count();
  process.stdout.write(`카카오 버튼 개수: ${kakaoCount}\n`);

  if (kakaoCount > 0) {
    try {
      await Promise.all([
        page.waitForNavigation({ timeout: 8000 }).catch(() => {}),
        kakaoBtn.click({ timeout: 5000 }),
      ]);
    } catch (e) {
      process.stdout.write(`카카오 클릭 오류: ${e}\n`);
    }
    await page.waitForTimeout(1500);
    process.stdout.write(`클릭 뒤 URL: ${page.url()}\n`);
    await page.screenshot({ path: join(opts.out, 'after-kakao-click.png') }).catch(() => {});
  }

  const oauthRequests = netEvents.filter((e) => /kakao|apple|google/i.test(e.url));
  process.stdout.write(`OAuth 관련 요청: ${JSON.stringify(oauthRequests, null, 2)}\n`);

  const fs = await import('node:fs/promises');
  await fs.writeFile(join(opts.out, 'net-events.json'), JSON.stringify(netEvents, null, 2));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
