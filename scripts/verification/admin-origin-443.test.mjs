import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ADMIN_ORIGIN = 'https://210.109.82.212';

const activeAdminDeploymentFiles = [
  'scripts/split-admin-dist.mjs',
  'scripts/install-kakao-app-web.sh',
  'scripts/install-kakao-preview-routes.sh',
  'scripts/add-kakao-static-cors.sh',
  'scripts/probe-kakao-static-ports.sh',
  '.github/workflows/main.yml',
  '.github/workflows/pr-validation.yml',
  '.github/workflows/cutover-kakao-app-web.yml',
  '.github/workflows/cutover-kakao-admin-web.yml',
  '.github/workflows/enable-kakao-static-cors.yml',
  '.github/workflows/probe-kakao-static-ports.yml',
];

test('active admin deployment paths never reference port 8443', () => {
  for (const file of activeAdminDeploymentFiles) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(
      source,
      /(?:210\.109\.82\.212:8443|listen\s+8443\b|static-admin)/,
      `${file} must not reintroduce the retired admin 8443 path`,
    );
  }
});

test('admin redirect origin is hard-coded to canonical 443 and cannot be overridden by env', () => {
  const source = readFileSync('scripts/split-admin-dist.mjs', 'utf8');
  assert.match(source, /const ADMIN_ORIGIN = 'https:\/\/210\.109\.82\.212';/);
  assert.doesNotMatch(source, /process\.env\.ADMIN_ORIGIN/);
});

test('main and PR packaging both use the canonical 443 admin origin', () => {
  for (const file of ['.github/workflows/main.yml', '.github/workflows/pr-validation.yml']) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, new RegExp(`ADMIN_ORIGIN: ${ADMIN_ORIGIN.replaceAll('.', '\\.')}`));
  }
});

test('app cutover owns admin under /admin on the same 443 server', () => {
  const install = readFileSync('scripts/install-kakao-app-web.sh', 'utf8');
  assert.match(install, /listen 443 ssl default_server;/);
  assert.match(install, /location \^~ \/admin\//);
  assert.match(install, /https:\/\/210\.109\.82\.212\/admin\/login/);

  const workflow = readFileSync('.github/workflows/cutover-kakao-app-web.yml', 'utf8');
  assert.match(workflow, /https:\/\/210\.109\.82\.212\/admin\/login/);
});

test('legacy admin cutover marker is read-only and cannot mutate Nginx', () => {
  const source = readFileSync('.github/workflows/cutover-kakao-admin-web.yml', 'utf8');
  assert.doesNotMatch(source, /runs-on: \[self-hosted/);
  assert.doesNotMatch(source, /install-kakao-|rollback-kakao-|systemctl|nginx/);
  assert.match(source, /https:\/\/210\.109\.82\.212\/admin\/login/);
});
