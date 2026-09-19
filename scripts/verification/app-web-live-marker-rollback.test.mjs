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
const source = readFileSync(
  path.join(repoRoot, 'scripts/rollback-kakao-app-web.sh'),
  'utf8',
);
const shellTest = process.platform === 'win32' ? test.skip : test;

function executable(file, content) {
  writeFileSync(file, content, 'utf8');
  chmodSync(file, 0o755);
}

function makeHarness() {
  const base = mkdtempSync(path.join(tmpdir(), 'wp-app-marker-rollback-'));
  const root = path.join(base, 'root');
  const conf = path.join(base, 'etc', 'weddingpick-api');
  const bin = path.join(base, 'bin');
  const backup = path.join(root, 'nginx-backups', 'api-only.conf');
  const marker = path.join(root, '.app-web-cutover-backup');
  const liveMarker = path.join(root, 'static-live-app');

  mkdirSync(path.dirname(conf), { recursive: true });
  mkdirSync(path.dirname(backup), { recursive: true });
  mkdirSync(bin, { recursive: true });

  const baseline = 'server {\n  listen 443 ssl;\n  # API_ONLY_BASELINE\n}\n';
  writeFileSync(backup, baseline, 'utf8');
  writeFileSync(conf, 'server { # APP_WEB_CURRENT }\n', 'utf8');
  writeFileSync(marker, backup + '\n', 'utf8');
  writeFileSync(liveMarker, 'release-failed-a\n', 'utf8');

  const script = path.join(base, 'rollback-kakao-app-web.sh');
  executable(
    script,
    source
      .replace('ROOT=/home/ubuntu/WeddingPick', `ROOT="${root}"`)
      .replace('CONF=/etc/nginx/sites-available/weddingpick-api', `CONF="${conf}"`),
  );

  executable(
    path.join(bin, 'sudo'),
    `#!/usr/bin/env bash
set -euo pipefail
if [ "\${1:-}" = "-n" ]; then shift; fi
exec "$@"
`,
  );
  executable(path.join(bin, 'nginx'), '#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n');
  executable(path.join(bin, 'systemctl'), '#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n');
  executable(path.join(bin, 'sleep'), '#!/usr/bin/env bash\nexit 0\n');
  executable(
    path.join(bin, 'curl'),
    `#!/usr/bin/env bash
set -euo pipefail
if [ "\${MOCK_HEALTH_FAIL:-0}" = 1 ]; then exit 22; fi
printf '%s' '{"ok":true}'
`,
  );

  return {
    base,
    conf,
    baseline,
    liveMarker,
    releaseDir: path.join(root, 'static-releases', 'release-failed-a'),
    script,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}` },
    cleanup() { rmSync(base, { recursive: true, force: true }); },
  };
}

shellTest('successful API-only rollback removes the live app marker', () => {
  const h = makeHarness();
  try {
    mkdirSync(h.releaseDir, { recursive: true });
    writeFileSync(path.join(h.releaseDir, 'keep.txt'), 'keep', 'utf8');

    const result = spawnSync('bash', [h.script], { env: h.env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(readFileSync(h.conf, 'utf8'), h.baseline);
    assert.equal(existsSync(h.liveMarker), false);
    assert.equal(existsSync(path.join(h.releaseDir, 'keep.txt')), true);
  } finally {
    h.cleanup();
  }
});

shellTest('failed health recovery keeps the live app marker as incomplete-recovery evidence', () => {
  const h = makeHarness();
  try {
    const result = spawnSync('bash', [h.script], {
      env: { ...h.env, MOCK_HEALTH_FAIL: '1' },
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(h.conf, 'utf8'), h.baseline);
    assert.equal(readFileSync(h.liveMarker, 'utf8').trim(), 'release-failed-a');
  } finally {
    h.cleanup();
  }
});
