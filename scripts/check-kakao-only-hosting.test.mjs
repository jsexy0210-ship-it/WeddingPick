import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectTrackedFiles } from './check-kakao-only-hosting.mjs';

const oldHost = ['https://example.', 'on', 'render.com'].join('');
const oldEnv = ['RENDER', '_API_KEY'].join('');
const provider = ['Ren', 'der'].join('');

test('rejects legacy hosting host', () => {
  assert.equal(inspectTrackedFiles([{ path: 'x.txt', content: oldHost }]).length, 1);
});

test('rejects legacy hosting environment variables', () => {
  assert.equal(inspectTrackedFiles([{ path: 'x.txt', content: oldEnv }]).length, 1);
});

test('rejects provider name records', () => {
  assert.equal(inspectTrackedFiles([{ path: 'x.txt', content: provider }]).length, 1);
});

test('allows canonical Kakao origin', () => {
  assert.deepEqual(inspectTrackedFiles([{ path: 'x.txt', content: 'https://210.109.82.212/admin/login' }]), []);
});
