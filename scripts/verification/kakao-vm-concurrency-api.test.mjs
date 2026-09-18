import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/deploy-kakao-api.yml', 'utf8');

test('API deploy shares the Kakao VM write concurrency group', () => {
  assert.match(
    workflow,
    /concurrency:\s*\n\s*group: weddingpick-kakao-vm-write\s*\n\s*cancel-in-progress: false/
  );
  assert.doesNotMatch(workflow, /weddingpick-kakao-api-cutover/);
});

test('VM-level API deploy lock remains in place', () => {
  assert.match(workflow, /\.kakao-deploy\.lock/);
  assert.match(workflow, /flock -n 9/);
});
