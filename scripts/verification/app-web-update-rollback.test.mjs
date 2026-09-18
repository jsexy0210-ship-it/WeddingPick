import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = readFileSync(path.join(repoRoot, 'scripts/rollback-kakao-app-web-update.sh'), 'utf8');
const installSource = readFileSync(path.join(repoRoot, 'scripts/install-kakao-app-web.sh'), 'utf8');
const dispatcherSource = readFileSync(path.join(repoRoot, 'scripts/rollback-kakao-app-web-failed-cutover.sh'), 'utf8');
const cutoverWorkflow = readFileSync(path.join(repoRoot, '.github/workflows/cutover-kakao-app-web.yml'), 'utf8');
const previewWorkflow = readFileSync(path.join(repoRoot, '.github/workflows/preview-kakao-app-web.yml'), 'utf8');
const shellTest = process.platform === 'win32' ? test.skip : test;

function executable(file, content) {
  writeFileSync(file, content, 'utf8');
  chmodSync(file, 0o755);
}

function makeHarness() {
  const base = mkdtempSync(path.join(tmpdir(), 'wp-app-update-rollback-'));
  const root = path.join(base, 'root');
  const conf = path.join(base, 'etc', 'weddingpick-api');
  const bin = path.join(base, 'bin');
  const release = 'release-a';
  const target = path.join(root, 'var', 'www', 'weddingpick', 'releases', release, 'app');
  const backup = path.join(root, 'nginx-backups', 'release-a.conf');
  const marker = path.join(root, '.app-web-update-backup');
  const liveMarker = path.join(root, 'static-live-app');

  mkdirSync(path.dirname(conf), { recursive: true });
  mkdirSync(target, { recursive: true });
  mkdirSync(path.dirname(backup), { recursive: true });
  mkdirSync(bin, { recursive: true });

  const previousConfig = `server {\n  root ${target};\n  # RELEASE_A\n}\n`;
  writeFileSync(backup, previousConfig, 'utf8');
  writeFileSync(conf, 'server { # RELEASE_B }\n', 'utf8');
  writeFileSync(path.join(target, 'index.html'), '<html>A</html>', 'utf8');
  writeFileSync(path.join(target, 'login.html'), '<html>login A</html>', 'utf8');
  writeFileSync(marker, `config=${backup}\nrelease=${release}\n`, 'utf8');
  writeFileSync(liveMarker, 'release-b\n', 'utf8');

  const script = path.join(base, 'rollback-kakao-app-web-update.sh');
  executable(
    script,
    source
      .replace('ROOT=/home/ubuntu/WeddingPick', `ROOT="${root}"`)
      .replace('CONF=/etc/nginx/sites-available/weddingpick-api', `CONF="${conf}"`)
      .replaceAll('/var/www/weddingpick', path.join(root, 'var', 'www', 'weddingpick')),
  );

  executable(path.join(bin, 'sudo'), `#!/usr/bin/env bash
set -euo pipefail
if [ "${1:-}" = "-n" ]; then shift; fi
exec "$@"
`);
  executable(path.join(bin, 'nginx'), '#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n');
  executable(path.join(bin, 'systemctl'), '#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n');
  executable(path.join(bin, 'sleep'), '#!/usr/bin/env bash\nexit 0\n');
  executable(path.join(bin, 'curl'), `#!/usr/bin/env bash
set -euo pipefail
url="${!#}"
if [[ "$url" == */health ]]; then
  if [ "${MOCK_HEALTH_FAIL:-0}" = 1 ]; then exit 22; fi
  printf '%s' '{"ok":true,"database":"ok"}'
elif [[ "$url" == */login ]]; then
  printf '%s' '<html>login</html>'
else
  printf '%s' 'ok'
fi
`);

  return {
    base,
    root,
    conf,
    previousConfig,
    marker,
    liveMarker,
    script,
    release,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}` },
    cleanup() { rmSync(base, { recursive: true, force: true }); },
  };
}

shellTest('A live -> B verification failure restores A config and A live marker', () => {
  const h = makeHarness();
  try {
    const result = spawnSync('bash', [h.script], { env: h.env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(readFileSync(h.conf, 'utf8'), h.previousConfig);
    assert.equal(readFileSync(h.liveMarker, 'utf8').trim(), h.release);
    assert.equal(existsSync(h.marker), false);
  } finally {
    h.cleanup();
  }
});

shellTest('failed recovery health keeps marker evidence while config and live marker stay aligned', () => {
  const h = makeHarness();
  try {
    const result = spawnSync('bash', [h.script], {
      env: { ...h.env, MOCK_HEALTH_FAIL: '1' },
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(h.conf, 'utf8'), h.previousConfig);
    assert.equal(readFileSync(h.liveMarker, 'utf8').trim(), h.release);
    assert.equal(existsSync(h.marker), true);
  } finally {
    h.cleanup();
  }
});

test('install records update/noop/api-only modes and dispatches rollback by mode', () => {
  assert.match(installSource, /\.app-web-update-backup/);
  assert.match(installSource, /cutover_mode='update'/);
  assert.match(installSource, /cutover_mode='noop'/);
  assert.match(installSource, /cutover_mode='api-only'/);
  assert.match(installSource, /rollback-kakao-app-web-failed-cutover\.sh/);
  assert.match(dispatcherSource, /rollback-kakao-app-web-update\.sh/);
  assert.match(dispatcherSource, /rollback-kakao-app-web\.sh/);
  assert.match(dispatcherSource, /noop/);
});

test('public verification rollback uses the mode-aware dispatcher', () => {
  assert.match(cutoverWorkflow, /rollback-kakao-app-web-failed-cutover\.sh/);
  assert.match(previewWorkflow, /rollback-kakao-app-web-failed-cutover\.sh/);
});

test('update rollback never deletes immutable release assets', () => {
  assert.doesNotMatch(source, /rm\s+-rf\s+.*static-releases/);
  assert.doesNotMatch(source, /docker\s+(?:rm|rmi|system prune)/);
});
