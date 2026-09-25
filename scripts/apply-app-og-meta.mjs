#!/usr/bin/env node
/**
 * 앱웹 export(`apps/mobile/dist`)에 관리자 「링크 미리보기」 값을 싣는다.
 *
 *   node scripts/apply-app-og-meta.mjs
 *
 * 2026-09-25 대표 지시 — 링크 미리보기는 세 벌이다(0436).
 *
 *   app      앱웹의 모든 HTML(`invite.html` 제외) — `+html.tsx`가 기본값을 굽고 여기서 덮는다
 *   invite   `invite.html` 하나 — 카카오로 초대하기가 보내는 주소. 초대 코드는 담지 않는다
 *   website  여기서 다루지 않는다 — `apps/web` 빌드가 `/v1/site-meta?kind=website`를 읽는다
 *
 * **저장과 반영은 다른 일이다** — 웹사이트 벌과 같은 규칙이다. 관리자가 저장한 값은 이
 * 스크립트가 도는 다음 정적 빌드에 실려 나간다.
 *
 * API를 못 읽어도 빌드를 세우지 않는다. 앱 벌은 `+html.tsx`가 구운 기본값이 그대로 남고,
 * 초대 벌은 `spec/strings.ko.json` `inviteShare`의 기본값으로 채운다 — 초대 주소에 앱 카드가
 * 남는 일은 없다.
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TIMEOUT_MS = 10_000;

/** `packages/domain/src/site.ts`의 `SITE_ORIGIN` · 앱웹 `social-meta.ts`의 기본 그림과 같다. */
const SITE_ORIGIN = 'https://210.109.82.212';
const DEFAULT_IMAGE = `${SITE_ORIGIN}/assets/weddingpick-og.png`;

export const INVITE_HTML = 'invite.html';

export function inviteDefaults(strings) {
  const copy = strings.inviteShare;
  return {
    ogTitle: copy.metaTitle,
    ogDescription: copy.metaDescription,
    ogImageUrl: null,
    ogImageAlt: copy.imageAlt,
  };
}

function escapeAttribute(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeText(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** `<meta property|name="key" content="…">`의 content만 바꾼다. 태그가 없으면 그대로 둔다. */
function setMeta(html, key, value) {
  const pattern = new RegExp(`(<meta\\s+(?:property|name)="${key.replace(/[.:]/g, '\\$&')}"\\s+content=")[^"]*(")`, 'g');
  return html.replace(pattern, (_match, head, tail) => `${head}${escapeAttribute(value)}${tail}`);
}

/**
 * 한 벌의 값을 HTML 머리에 싣는다. 비어 있는 항목은 건드리지 않는다 — 구운 기본값이 남는다.
 * `url`이 있으면 og:url도 그 주소로 바꾼다(초대 주소가 앱 첫 화면 주소를 싣지 않게).
 */
export function applyMeta(html, meta, url) {
  let next = html;
  if (meta.ogTitle) {
    next = next.replace(/<title>[^<]*<\/title>/, `<title>${escapeText(meta.ogTitle)}</title>`);
    next = setMeta(next, 'og:title', meta.ogTitle);
    next = setMeta(next, 'twitter:title', meta.ogTitle);
  }
  if (meta.ogDescription) {
    next = setMeta(next, 'description', meta.ogDescription);
    next = setMeta(next, 'og:description', meta.ogDescription);
    next = setMeta(next, 'twitter:description', meta.ogDescription);
  }
  const image = meta.ogImageUrl || null;
  if (image) {
    next = setMeta(next, 'og:image', image);
    next = setMeta(next, 'twitter:image', image);
  }
  if (meta.ogImageAlt) next = setMeta(next, 'og:image:alt', meta.ogImageAlt);
  if (url) next = setMeta(next, 'og:url', url);
  return next;
}

function htmlFiles(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...htmlFiles(path));
    else if (name.endsWith('.html')) found.push(path);
  }
  return found;
}

async function readKind(api, kind) {
  if (!api) return null;
  try {
    const response = await fetch(`${api.replace(/\/+$/, '')}/v1/site-meta?kind=${kind}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function run({ dist, api, appOrigin, strings }) {
  if (!existsSync(join(dist, 'index.html'))) {
    throw new Error(`앱웹 export가 없다: ${dist}`);
  }

  const app = await readKind(api, 'app');
  const invite = { ...inviteDefaults(strings), ...(await readKind(api, 'invite')) };
  if (!invite.ogImageUrl) invite.ogImageUrl = DEFAULT_IMAGE;

  const files = htmlFiles(dist);
  for (const file of files) {
    const isInvite = relative(dist, file) === INVITE_HTML;
    if (!isInvite && !app) continue;
    const html = readFileSync(file, 'utf8');
    const next = isInvite ? applyMeta(html, invite, `${appOrigin}/invite`) : applyMeta(html, app);
    if (next !== html) writeFileSync(file, next);
  }

  return {
    app: app ? 'api' : 'built-default',
    invite: existsSync(join(dist, INVITE_HTML)) ? 'applied' : 'missing',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = process.env.WEDDINGPICK_DIST_DIR
    ? resolve(process.env.WEDDINGPICK_DIST_DIR)
    : join(ROOT, 'apps', 'mobile', 'dist');
  const api = process.env.WEDDINGPICK_API_URL || process.env.EXPO_PUBLIC_API_URL || '';
  const appOrigin = (process.env.EXPO_PUBLIC_WEB_URL || SITE_ORIGIN).replace(/\/+$/, '');
  const strings = JSON.parse(readFileSync(join(ROOT, 'spec', 'strings.ko.json'), 'utf8'));

  const result = await run({ dist, api, appOrigin, strings });
  if (result.invite === 'missing') {
    console.error(`!! ${INVITE_HTML}가 export에 없다 — apps/mobile/src/app/invite.tsx를 확인한다`);
    process.exit(1);
  }
  console.log(`링크 미리보기 반영: 앱=${result.app === 'api' ? '관리자 값' : '구운 기본값'} · 초대=${INVITE_HTML}`);
}
