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
const installSource = readFileSync(
  path.join(repoRoot, 'scripts/install-kakao-static-sites.sh'),
  'utf8',
);
const rollbackSource = readFileSync(
  path.join(repoRoot, 'scripts/rollback-kakao-static-sites.sh'),
  'utf8',
);

function replaceRuntimePaths(source, root, conf) {
  return source
    .replace('ROOT=/home/ubuntu/WeddingPick', `ROOT="${root}"`)
    .replace('CONF=/etc/nginx/conf.d/weddingpick-static-sites.conf', `CONF="${conf}"`)
    .replaceAll('/var/www/weddingpick', path.join(root, 'var/www/weddingpick'));
}

function writeExecutable(file, content) {
  writeFileSync(file, content, 'utf8');
  chmodSync(file, 0o755);
}

function readCount(file) {
  return existsSync(file) ? Number(readFileSync(file, 'utf8')) : 0;
}

function makeHarness({ includePrivacy = true, previousLiveSha = null } = {}) {
  const base = mkdtempSync(path.join(tmpdir(), 'wp-static-cutover-'));
  const root = path.join(base, 'root');
  const conf = path.join(base, 'etc', 'weddingpick-static-sites.conf');
  const scripts = path.join(base, 'scripts');
  const bin = path.join(base, 'bin');
  const state = path.join(base, 'state');
  const releaseSha = 'release-static-a';
  const releaseRoot = path.join(root, 'static-releases', releaseSha);
  const servedReleaseRoot = path.join(root, 'var', 'www', 'weddingpick', 'releases', releaseSha);
  const liveMarker = path.join(root, 'static-live-admin-web');

  mkdirSync(path.dirname(conf), { recursive: true });
  mkdirSync(path.join(releaseRoot, 'admin', 'admin'), { recursive: true });
  mkdirSync(path.join(releaseRoot, 'web'), { recursive: true });
  mkdirSync(scripts, { recursive: true });
  mkdirSync(bin, { recursive: true });
  mkdirSync(state, { recursive: true });

  const baseline = 'server {\n  listen 8443 ssl;\n  # STATIC_BASELINE\n}\n';
  writeFileSync(conf, baseline, 'utf8');
  writeFileSync(
    path.join(releaseRoot, 'admin', 'admin', 'login.html'),
    '<html>admin</html>',
    'utf8',
  );
  if (includePrivacy) {
    writeFileSync(
      path.join(releaseRoot, 'web', 'privacy.html'),
      '<html>privacy</html>',
      'utf8',
    );
  }

  if (previousLiveSha) {
    writeFileSync(liveMarker, previousLiveSha + '\n', 'utf8');
  }
  if (previousLiveSha === releaseSha) {
    mkdirSync(path.join(servedReleaseRoot, 'admin', 'admin'), { recursive: true });
    mkdirSync(path.join(servedReleaseRoot, 'web'), { recursive: true });
    writeFileSync(
      path.join(servedReleaseRoot, 'admin', 'admin', 'login.html'),
      '<html>LIVE-ADMIN</html>',
      'utf8',
    );
    writeFileSync(
      path.join(servedReleaseRoot, 'web', 'privacy.html'),
      '<html>LIVE-WEB</html>',
      'utf8',
    );
  }

  const installPath = path.join(scripts, 'install-kakao-static-sites.sh');
  const rollbackPath = path.join(scripts, 'rollback-kakao-static-sites.sh');
  writeExecutable(installPath, replaceRuntimePaths(installSource, root, conf));
  writeExecutable(rollbackPath, replaceRuntimePaths(rollbackSource, root, conf));

  writeExecutable(
    path.join(bin, 'sudo'),
    `#!/usr/bin/env bash
set -euo pipefail
if [ "\${1:-}" = "-n" ]; then shift; fi
exec "$@"
`,
  );

  writeExecutable(
    path.join(bin, 'nginx'),
    `#!/usr/bin/env bash
set -euo pipefail
state="\${MOCK_STATE_DIR:?}"
case "\${1:-}" in
  -T)
    printf '%s\\n' 'ssl_certificate /tmp/mock-cert.pem;' 'ssl_certificate_key /tmp/mock-key.pem;'
    ;;
  -t)
    count_file="$state/nginx-t-count"
    count=0
    [ ! -f "$count_file" ] || count="$(cat "$count_file")"
    count=$((count + 1))
    printf '%s' "$count" > "$count_file"
    if [ "\${MOCK_NGINX_T_FAIL_FIRST:-0}" = "1" ] && [ "$count" -eq 1 ]; then
      exit 1
    fi
    ;;
esac
`,
  );

  writeExecutable(
    path.join(bin, 'systemctl'),
    `#!/usr/bin/env bash
set -euo pipefail
state="\${MOCK_STATE_DIR:?}"
if [ "\${1:-}" = "reload" ] && [ "\${2:-}" = "nginx" ]; then
  count_file="$state/reload-count"
  count=0
  [ ! -f "$count_file" ] || count="$(cat "$count_file")"
  count=$((count + 1))
  printf '%s' "$count" > "$count_file"
  if [ "\${MOCK_RELOAD_FAIL_FIRST:-0}" = "1" ] && [ "$count" -eq 1 ]; then
    exit 1
  fi
fi
`,
  );

  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH ?? ''}`,
    MOCK_STATE_DIR: state,
  };

  return {
    base,
    root,
    conf,
    state,
    installPath,
    rollbackPath,
    releaseSha,
    baseline,
    liveMarker,
    servedReleaseRoot,
    env,
    cleanup() {
      rmSync(base, { recursive: true, force: true });
    },
  };
}

function run(h, env = h.env) {
  return spawnSync('bash', [h.installPath, h.releaseSha], {
    env,
    encoding: 'utf8',
  });
}

test('candidate preparation failure leaves previous static config untouched', () => {
  const h = makeHarness({ includePrivacy: false });
  try {
    const result = run(h);
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(h.conf, 'utf8'), h.baseline);
    assert.equal(existsSync(path.join(h.root, '.weddingpick-static-sites-backup')), false);
  } finally {
    h.cleanup();
  }
});

test('first nginx validation failure restores previous config and previous live marker', () => {
  const h = makeHarness({ previousLiveSha: 'release-static-old' });
  try {
    const result = run(h, {
      ...h.env,
      MOCK_NGINX_T_FAIL_FIRST: '1',
    });
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(h.conf, 'utf8'), h.baseline);
    assert.equal(readFileSync(h.liveMarker, 'utf8').trim(), 'release-static-old');
    assert.equal(existsSync(path.join(h.root, '.weddingpick-static-sites-live-backup')), false);
    assert.equal(readCount(path.join(h.state, 'nginx-t-count')), 2);
    assert.equal(readCount(path.join(h.state, 'reload-count')), 1);
  } finally {
    h.cleanup();
  }
});

test('first nginx reload failure restores previous config and reloads again', () => {
  const h = makeHarness();
  try {
    const result = run(h, {
      ...h.env,
      MOCK_RELOAD_FAIL_FIRST: '1',
    });
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(h.conf, 'utf8'), h.baseline);
    assert.equal(existsSync(h.liveMarker), false);
    assert.equal(readCount(path.join(h.state, 'nginx-t-count')), 2);
    assert.equal(readCount(path.join(h.state, 'reload-count')), 2);
  } finally {
    h.cleanup();
  }
});

test('live marker write failure rolls static config back after a successful reload', () => {
  const h = makeHarness();
  try {
    mkdirSync(path.join(h.root, 'static-live-admin-web'), { recursive: true });
    const result = run(h);
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(h.conf, 'utf8'), h.baseline);
    assert.equal(readCount(path.join(h.state, 'nginx-t-count')), 2);
    assert.equal(readCount(path.join(h.state, 'reload-count')), 2);
  } finally {
    h.cleanup();
  }
});

test('rollback refuses to delete active config when the recorded backup file is missing', () => {
  const h = makeHarness();
  try {
    writeFileSync(
      path.join(h.root, '.weddingpick-static-sites-backup'),
      path.join(h.root, 'nginx-backups', 'missing.conf') + '\n',
      'utf8',
    );
    const result = spawnSync('bash', [h.rollbackPath], {
      env: h.env,
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(h.conf, 'utf8'), h.baseline);
    assert.match(result.stderr, /rollback backup is missing/i);
    assert.equal(readCount(path.join(h.state, 'nginx-t-count')), 0);
    assert.equal(readCount(path.join(h.state, 'reload-count')), 0);
  } finally {
    h.cleanup();
  }
});

test('successful install keeps new static config and release marker without rollback', () => {
  const h = makeHarness();
  try {
    const result = run(h);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const liveConfig = readFileSync(h.conf, 'utf8');
    assert.match(liveConfig, /release-static-a\/admin/);
    assert.match(liveConfig, /release-static-a\/web/);
    assert.equal(
      readFileSync(h.liveMarker, 'utf8').trim(),
      h.releaseSha,
    );
    assert.equal(readCount(path.join(h.state, 'nginx-t-count')), 1);
    assert.equal(readCount(path.join(h.state, 'reload-count')), 1);
  } finally {
    h.cleanup();
  }
});


test('missing live marker fails closed before mutating currently served static files', () => {
  const h = makeHarness();
  try {
    const first = run(h);
    assert.equal(first.status, 0, first.stderr || first.stdout);

    rmSync(h.liveMarker, { force: true });
    writeFileSync(
      path.join(h.servedReleaseRoot, 'admin', 'admin', 'login.html'),
      '<html>LIVE-ADMIN-SAFE</html>',
      'utf8',
    );
    writeFileSync(
      path.join(h.root, 'static-releases', h.releaseSha, 'admin', 'admin', 'login.html'),
      '<html>NEW-SOURCE</html>',
      'utf8',
    );

    const second = run(h);
    assert.notEqual(second.status, 0);
    assert.match(second.stderr, /live release marker is missing/);
    assert.equal(
      readFileSync(path.join(h.servedReleaseRoot, 'admin', 'admin', 'login.html'), 'utf8'),
      '<html>LIVE-ADMIN-SAFE</html>',
    );
  } finally {
    h.cleanup();
  }
});

test('re-running the same live static release does not replace served files', () => {
  const h = makeHarness({ previousLiveSha: 'release-static-a' });
  try {
    const result = run(h);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(
      readFileSync(path.join(h.servedReleaseRoot, 'admin', 'admin', 'login.html'), 'utf8'),
      '<html>LIVE-ADMIN</html>',
    );
    assert.equal(
      readFileSync(path.join(h.servedReleaseRoot, 'web', 'privacy.html'), 'utf8'),
      '<html>LIVE-WEB</html>',
    );
    assert.equal(readFileSync(h.liveMarker, 'utf8').trim(), h.releaseSha);
  } finally {
    h.cleanup();
  }
});
