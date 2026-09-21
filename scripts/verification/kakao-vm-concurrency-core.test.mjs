import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflows = [
  '.github/workflows/preview-kakao-admin-web.yml',
  '.github/workflows/enable-kakao-static-cors.yml',
];

for (const file of workflows) {
  test(`${file} uses shared Kakao VM write concurrency`, () => {
    const source = readFileSync(path.join(root, file), 'utf8');
    assert.match(source, /concurrency:\s*\n\s*group: weddingpick-kakao-vm-write-v2\s*\n\s*cancel-in-progress: false/);
  });
}
