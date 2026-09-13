import test from 'node:test';
import assert from 'node:assert/strict';
import { assertApiHealth, checkApiHealth } from './check-api-health.mjs';

const healthy = () => ({ ok: true, database: 'ok', schema: {
  ok: true, applied: 118, expected: 115, pending: [], unknown: ['old-history'],
} });

test('정상 응답과 보존된 과거 적용 이력은 통과한다', () => {
  assert.equal(assertApiHealth(200, healthy(), 115).applied, 118);
});

test('HTTP 200이어도 스키마 실패면 거절한다', () => {
  const body = healthy(); body.schema.ok = false;
  assert.throws(() => assertApiHealth(200, body), /schema.ok/);
});

test('필수 상태와 pending 배열이 빠지면 거절한다', () => {
  for (const key of ['ok', 'database', 'schema']) {
    const body = healthy(); delete body[key];
    assert.throws(() => assertApiHealth(200, body));
  }
  const body = healthy(); delete body.schema.pending;
  assert.throws(() => assertApiHealth(200, body), /pending/);
});

test('스키마 성공 표시와 달리 미적용 항목이 있으면 거절한다', () => {
  const body = healthy(); body.schema.pending.push('new-migration');
  assert.throws(() => assertApiHealth(200, body), /pending/);
});

test('HTTP 오류·DB 오류·구버전 API의 기대 개수 불일치를 거절한다', () => {
  assert.throws(() => assertApiHealth(503, healthy()), /HTTP 503/);
  assert.throws(() => assertApiHealth(200, { ...healthy(), database: 'unavailable' }), /database/);
  assert.throws(() => assertApiHealth(200, healthy(), 116), /불일치/);
});

test('기동 실패 뒤 다시 요청해 본문까지 정상일 때 통과한다', async () => {
  let calls = 0; const delays = [];
  const schema = await checkApiHealth({ api: 'https://example.test', attempts: 2, delayMs: 20,
    expectedMigrations: 115, log() {}, wait: async ms => delays.push(ms),
    fetchImpl: async (_url, { signal }) => {
      assert.ok(signal instanceof AbortSignal);
      if (++calls === 1) throw new Error('fetch failed');
      return new Response(JSON.stringify(healthy()));
    },
  });
  assert.equal(schema.expected, 115); assert.equal(calls, 2); assert.deepEqual(delays, [20]);
});

test('잘못된 JSON 응답은 정해진 횟수 후 실패한다', async () => {
  let calls = 0; let waits = 0;
  await assert.rejects(checkApiHealth({ api: 'https://example.test', attempts: 2,
    log() {}, wait: async () => waits++, fetchImpl: async () => { calls++; return new Response('not JSON'); },
  }), /확인 실패/);
  assert.equal(calls, 2); assert.equal(waits, 1);
});
