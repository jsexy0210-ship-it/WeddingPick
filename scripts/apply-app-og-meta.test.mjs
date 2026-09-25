import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { applyMeta, run } from './apply-app-og-meta.mjs';

const HEAD = `<html><head><title>웨딩픽</title>
<meta name="description" content="앱 설명"/>
<meta property="og:title" content="웨딩픽"/>
<meta property="og:description" content="앱 설명"/>
<meta property="og:image" content="https://example.test/app.png"/>
<meta property="og:image:alt" content="앱 그림"/>
<meta property="og:url" content="https://example.test"/>
<meta name="twitter:title" content="웨딩픽"/>
<meta name="twitter:description" content="앱 설명"/>
<meta name="twitter:image" content="https://example.test/app.png"/>
</head><body></body></html>`;

const strings = {
  inviteShare: { metaTitle: '초대 기본 제목', metaDescription: '초대 기본 설명', imageAlt: '초대 그림' },
};

function dist() {
  const dir = mkdtempSync(join(tmpdir(), 'og-'));
  writeFileSync(join(dir, 'index.html'), HEAD);
  writeFileSync(join(dir, 'invite.html'), HEAD);
  mkdirSync(join(dir, 'pick'));
  writeFileSync(join(dir, 'pick', 'index.html'), HEAD);
  return dir;
}

test('비어 있는 항목은 구운 값을 남긴다', () => {
  const next = applyMeta(HEAD, { ogTitle: '새 제목' });
  assert.match(next, /<title>새 제목<\/title>/);
  assert.match(next, /property="og:title" content="새 제목"/);
  assert.match(next, /name="twitter:title" content="새 제목"/);
  assert.match(next, /property="og:description" content="앱 설명"/);
});

test('API를 못 읽어도 초대 주소는 초대 기본값을 싣고 앱 주소는 그대로다', async () => {
  const dir = dist();
  const result = await run({ dist: dir, api: '', appOrigin: 'https://example.test', strings });
  assert.equal(result.app, 'built-default');

  const invite = readFileSync(join(dir, 'invite.html'), 'utf8');
  assert.match(invite, /property="og:title" content="초대 기본 제목"/);
  assert.match(invite, /property="og:url" content="https:\/\/example.test\/invite"/);
  assert.equal(readFileSync(join(dir, 'index.html'), 'utf8'), HEAD);
});

test('앱 벌과 초대 벌은 서로의 HTML에 섞이지 않는다', async () => {
  const dir = dist();
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const kind = new URL(url).searchParams.get('kind');
    const body = {
      app: { ogTitle: '앱 제목', ogDescription: '앱 새 설명', ogImageUrl: null, ogImageAlt: '앱 그림' },
      invite: { ogTitle: '초대 제목', ogDescription: '초대 설명', ogImageUrl: 'https://example.test/invite.png', ogImageAlt: '초대 그림' },
    }[kind];
    return new Response(JSON.stringify(body), { status: 200 });
  };
  try {
    await run({ dist: dir, api: 'https://api.test', appOrigin: 'https://example.test', strings });
  } finally {
    globalThis.fetch = original;
  }

  for (const file of ['index.html', join('pick', 'index.html')]) {
    const html = readFileSync(join(dir, file), 'utf8');
    assert.match(html, /property="og:title" content="앱 제목"/);
    assert.doesNotMatch(html, /초대/);
  }
  const invite = readFileSync(join(dir, 'invite.html'), 'utf8');
  assert.match(invite, /property="og:title" content="초대 제목"/);
  assert.match(invite, /property="og:image" content="https:\/\/example.test\/invite.png"/);
  assert.doesNotMatch(invite, /앱 제목/);
  /* 초대 카드에는 코드가 없다 — 6자리 숫자가 실리지 않는다. */
  assert.doesNotMatch(invite, /content="[^"]*\b\d{6}\b[^"]*"/);
});
