import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = readFileSync(path.join(repoRoot, 'scripts/install-kakao-preview-routes.sh'), 'utf8');

test('preview proxy overwrites forwarded client IP with nginx peer address', () => {
  assert.doesNotMatch(source, /X-Forwarded-For \\$proxy_add_x_forwarded_for/);
  const xff = source.match(/proxy_set_header X-Forwarded-For \\$remote_addr;/g) ?? [];
  const real = source.match(/proxy_set_header X-Real-IP \\$remote_addr;/g) ?? [];
  assert.equal(xff.length, 2);
  assert.equal(real.length, 2);
});
