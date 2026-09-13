#!/usr/bin/env node
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';

// Render의 /health는 스키마가 밀려도 HTTP 200을 준다. 배포 관문은 본문까지 확인한다.
export function assertApiHealth(status, body, expectedMigrations) {
  if (status !== 200) throw new Error(`HTTP ${status}`);
  if (body?.ok !== true) throw new Error('ok가 true가 아니다');
  if (body.database !== 'ok') throw new Error('database가 ok가 아니다');
  const schema = body.schema;
  if (schema?.ok !== true) throw new Error('schema.ok가 true가 아니다');
  if (!Array.isArray(schema.pending) || schema.pending.length !== 0) {
    throw new Error('schema.pending이 빈 배열이 아니다');
  }
  if (!Number.isInteger(schema.applied) || !Number.isInteger(schema.expected)
      || schema.expected < 0 || schema.applied < schema.expected) {
    throw new Error('스키마 적용·기대 개수가 유효하지 않다');
  }
  if (expectedMigrations !== undefined && schema.expected !== expectedMigrations) {
    throw new Error(`배포 API 기대 ${schema.expected}개 / 현재 코드 기대 ${expectedMigrations}개 불일치`);
  }
  // 이름이 바뀐 과거 이력은 보존하므로 applied가 expected보다 많아도 허용한다.
  return schema;
}

export async function checkApiHealth({ api, expectedMigrations, attempts = 3,
  timeoutMs = 90000, delayMs = 20000, fetchImpl = fetch, wait = sleep, log = console.log }) {
  for (const [name, value, minimum] of [['attempts', attempts, 1], ['timeoutMs', timeoutMs, 1], ['delayMs', delayMs, 0]]) {
    if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`${name} 값이 유효하지 않다`);
  }
  const url = new URL(api);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('API는 자격증명이 없는 HTTP(S) 주소여야 한다');
  }
  url.pathname = `${url.pathname.replace(/\/$/, '')}/health`;
  url.search = '';
  url.hash = '';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
      if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
      let body;
      try { body = await response.json(); } catch { throw new Error('health JSON을 읽지 못했다'); }
      const schema = assertApiHealth(response.status, body, expectedMigrations);
      log(`health 통과: 적용 ${schema.applied} / 기대 ${schema.expected} / 미적용 0`);
      return schema;
    } catch (error) {
      // 응답 원문에는 DB 오류가 들어갈 수 있어 본문 전체를 로그에 남기지 않는다.
      log(`시도 ${attempt}/${attempts}: ${error instanceof Error ? error.message : 'health 요청 실패'}`);
      if (attempt === attempts) throw new Error('API health 확인 실패');
      await wait(delayMs);
    }
  }
}

async function main() {
  const { values } = parseArgs({ options: {
    api: { type: 'string', default: process.env.API ?? 'https://weddingpickl-sg.onrender.com' },
    'migrations-dir': { type: 'string' },
    attempts: { type: 'string', default: '3' },
    'timeout-ms': { type: 'string', default: '90000' },
    'delay-ms': { type: 'string', default: '20000' },
  } });
  const expectedMigrations = values['migrations-dir']
    ? (await readdir(values['migrations-dir'])).filter(name => name.endsWith('.sql')).length
    : undefined;
  await checkApiHealth({ api: values.api, expectedMigrations, attempts: Number(values.attempts),
    timeoutMs: Number(values['timeout-ms']), delayMs: Number(values['delay-ms']) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
