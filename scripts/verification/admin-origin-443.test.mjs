import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';


function jobBlock(source, name) {
  const marker = `  ${name}:\n`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `job ${name} must exist`);
  const rest = source.slice(start + marker.length);
  const next = rest.search(/\n  [a-zA-Z0-9_-]+:\n/);
  return next === -1 ? source.slice(start) : source.slice(start, start + marker.length + next);
}

function activeDeploymentFiles() {
  const workflows = readdirSync('.github/workflows')
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => join('.github/workflows', name));

  const scripts = readdirSync('scripts')
    .filter((name) => {
      const path = join('scripts', name);
      return statSync(path).isFile() && /\.(?:sh|mjs|cjs|js)$/.test(name) && name !== 'assert-admin-origin-443.sh';
    })
    .map((name) => join('scripts', name));

  return [...workflows, ...scripts];
}

test('active admin deployment paths never reference port 8443', () => {
  for (const file of activeDeploymentFiles()) {
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

test('no workflow can override the locked admin origin', () => {
  for (const name of readdirSync('.github/workflows').filter((entry) => /\.ya?ml$/.test(entry))) {
    const source = readFileSync(join('.github/workflows', name), 'utf8');
    assert.doesNotMatch(source, /ADMIN_ORIGIN/, `${name} must not override the admin origin`);
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

test('runtime-mutating workflows recheck the 443 lock immediately before writes', () => {
  for (const file of [
    '.github/workflows/cutover-kakao-app-web.yml',
    '.github/workflows/preview-kakao-app-web.yml',
    '.github/workflows/preview-kakao-admin-web.yml',
    '.github/workflows/enable-kakao-static-cors.yml',
    '.github/workflows/probe-kakao-static-ports.yml',
  ]) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /bash \.\/scripts\/assert-admin-origin-443\.sh/);
  }
});

test('legacy admin cutover marker is read-only and cannot mutate Nginx', () => {
  const source = readFileSync('.github/workflows/cutover-kakao-admin-web.yml', 'utf8');
  assert.doesNotMatch(source, /runs-on: \[self-hosted/);
  assert.doesNotMatch(source, /install-kakao-|rollback-kakao-|systemctl|nginx/);
  assert.match(source, /https:\/\/210\.109\.82\.212\/admin\/login/);
});

test('all Kakao write entry points that can affect admin wait for the 443 CI lock', () => {
  const main = readFileSync('.github/workflows/main.yml', 'utf8').replaceAll('\r\n', '\n');
  for (const name of [
    'probe-kakao-static-ports',
    'enable-kakao-static-cors',
    'preview-kakao-admin-web',
    'preview-kakao-app-web',
  ]) {
    const job = jobBlock(main, name);
    assert.match(job, /needs: \[ci\]/);
    assert.match(job, /needs\.ci\.result == 'success'/);
  }

  const cutover = jobBlock(main, 'cutover-kakao-app-web');
  assert.match(cutover, /needs: \[ci, api-tests, non-db-tests, db-tests, repair-kakao-runner, stage-kakao-static, deploy-kakao\]/);
  assert.match(cutover, /needs\.ci\.result == 'success'/);
  assert.match(cutover, /needs\.stage-kakao-static\.outputs\.candidate_sha == github\.sha/);
});
