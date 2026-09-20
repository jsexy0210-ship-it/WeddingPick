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
  path.join(repoRoot, 'scripts/install-kakao-preview-routes.sh'),
  'utf8',
);
const rollbackSource = readFileSync(
  path.join(repoRoot, 'scripts/rollback-kakao-preview-routes.sh'),
  'utf8',
);
const shellTest = process.platform === 'win32' ? test.skip : test;
const adminHtml = (label) => `<html>${label}<script src="/_expo/static/js/web/entry.js"></script></html>`;

function writeExecutable(file, content) {
  writeFileSync(file, content, 'utf8');
  chmodSync(file, 0o755);
}

function readCount(file) {
  return existsSync(file) ? Number(readFileSync(file, 'utf8')) : 0;
}

function transform(source, root, conf) {
  return source
    .replace('ROOT=/home/ubuntu/WeddingPick', `ROOT="${root}"`)
    .replace('CONF=/etc/nginx/sites-available/weddingpick-api', `CONF="${conf}"`)
    .replaceAll('/var/www/weddingpick', path.join(root, 'var/www/weddingpick'));
}

function makeHarness({ staleMarker = false, existingPreview = false } = {}) {
  const base = mkdtempSync(path.join(tmpdir(), 'wp-preview-rollback-'));
  const root = path.join(base, 'root');
  const conf = path.join(base, 'etc', 'weddingpick-api');
  const scripts = path.join(base, 'scripts');
  const bin = path.join(base, 'bin');
  const state = path.join(base, 'state');
  const releaseSha = 'release-preview-a';
  const sourceRoot = path.join(root, 'static-releases', releaseSha);
  const liveRoot = path.join(root, 'var', 'www', 'weddingpick', 'releases', releaseSha);
  const marker = path.join(root, '.preview-routes-backup');
  const backupDir = path.join(root, 'nginx-backups');

  mkdirSync(path.dirname(conf), { recursive: true });
  mkdirSync(path.join(sourceRoot, 'admin', 'admin'), { recursive: true });
  mkdirSync(path.join(sourceRoot, 'web'), { recursive: true });
  mkdirSync(path.join(liveRoot, 'app'), { recursive: true });
  mkdirSync(scripts, { recursive: true });
  mkdirSync(bin, { recursive: true });
  mkdirSync(state, { recursive: true });

  let baseline = 'server {\n  listen 443 ssl;\n  # PREVIEW_BASELINE\n}\n';
  writeFileSync(conf, baseline, 'utf8');
  writeFileSync(path.join(root, 'static-live-app'), releaseSha + '\n', 'utf8');
  writeFileSync(path.join(liveRoot, 'app', 'index.html'), '<html>app</html>', 'utf8');
  writeFileSync(path.join(sourceRoot, 'admin', 'admin', 'login.html'), adminHtml('admin'), 'utf8');
  writeFileSync(path.join(sourceRoot, 'web', 'index.html'), '<html>web</html>', 'utf8');
  writeFileSync(path.join(sourceRoot, 'web', 'privacy.html'), '<html>privacy</html>', 'utf8');


  if (staleMarker || existingPreview) {
    mkdirSync(path.join(liveRoot, 'admin', 'admin'), { recursive: true });
    mkdirSync(path.join(liveRoot, 'web'), { recursive: true });
    writeFileSync(path.join(liveRoot, 'admin', 'admin', 'login.html'), adminHtml('LIVE-ADMIN'), 'utf8');
    writeFileSync(path.join(liveRoot, 'web', 'privacy.html'), '<html>LIVE-WEB</html>', 'utf8');
    mkdirSync(backupDir, { recursive: true });
  }

  if (staleMarker) {
    writeFileSync(marker, path.join(backupDir, 'missing.conf') + '\n', 'utf8');
  }

  if (existingPreview) {
    const backup = path.join(backupDir, 'baseline.conf');
    writeFileSync(backup, baseline, 'utf8');
    writeFileSync(marker, backup + '\n', 'utf8');
    baseline = [
      'server {',
      '  location ^~ /admin/ {',
      `    root ${path.join(liveRoot, 'admin')};`,
      '  }',
      '  location ~ ^/privacy\\.html$ {',
      `    root ${path.join(liveRoot, 'web')};`,
      '  }',
      '}',
      '',
    ].join('\n');
    writeFileSync(conf, baseline, 'utf8');
  }

  const installPath = path.join(scripts, 'install-kakao-preview-routes.sh');
  const rollbackPath = path.join(scripts, 'rollback-kakao-preview-routes.sh');
  writeExecutable(installPath, transform(installSource, root, conf));
  writeExecutable(rollbackPath, transform(rollbackSource, root, conf));

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
S="\${MOCK_STATE_DIR:?}"
case "\${1:-}" in
  -T)
    printf '%s\\n' 'ssl_certificate /tmp/mock-cert.pem;' 'ssl_certificate_key /tmp/mock-key.pem;'
    ;;
  -t)
    file="$S/nginx-t-count"
    count=0
    [ ! -f "$file" ] || count="$(cat "$file")"
    count=$((count + 1))
    printf '%s' "$count" > "$file"
    if [ "\${MOCK_NGINX_FAIL_FIRST:-0}" = 1 ] && [ "$count" -eq 1 ]; then
      exit 1
    fi
    if [ "\${MOCK_ROLLBACK_FAIL:-0}" = 1 ] && [ "$count" -gt 1 ]; then
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
S="\${MOCK_STATE_DIR:?}"
if [ "\${1:-}" = reload ] && [ "\${2:-}" = nginx ]; then
  file="$S/reload-count"
  count=0
  [ ! -f "$file" ] || count="$(cat "$file")"
  count=$((count + 1))
  printf '%s' "$count" > "$file"
  if [ "\${MOCK_RELOAD_FAIL_FIRST:-0}" = 1 ] && [ "$count" -eq 1 ]; then
    exit 1
  fi
fi
`,
  );

  writeExecutable(
    path.join(bin, 'curl'),
    `#!/usr/bin/env bash
set -euo pipefail
out=''
url=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o|--output)
      out="$2"; shift 2 ;;
    --connect-timeout|--max-time)
      shift 2 ;;
    --fail|--silent|--show-error)
      shift ;;
    *)
      url="$1"; shift ;;
  esac
done

if [ -n "\${MOCK_CURL_FAIL_MATCH:-}" ] && [[ "$url" == *"\${MOCK_CURL_FAIL_MATCH}"* ]]; then
  exit 22
fi

case "$url" in
  */admin/login)
    admin_root="$(awk '/location \^~ \/admin\// { in_admin=1 } in_admin && $1=="root" { gsub(/;/,"",$2); print $2; exit }' "\${MOCK_NGINX_CONF:?}")"
    body="$(cat "$admin_root/admin/login.html")"
    ;;
  */website.html) body='<html>web</html>' ;;
  */privacy.html) body='<html>privacy</html>' ;;
  */health) body='{"ok":true}' ;;
  *) body='ok' ;;
esac

if [ -n "$out" ]; then printf '%s' "$body" > "$out"; else printf '%s' "$body"; fi
`,
  );

  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH ?? ''}`,
    MOCK_STATE_DIR: state,
    MOCK_NGINX_CONF: conf,
  };

  return {
    base,
    root,
    conf,
    state,
    installPath,
    baseline,
    marker,
    liveRoot,
    env,
    cleanup() {
      rmSync(base, { recursive: true, force: true });
    },
  };
}

function run(h, extraEnv = {}) {
  return spawnSync('bash', [h.installPath], {
    env: { ...h.env, ...extraEnv },
    encoding: 'utf8',
  });
}

function assertRollback(h, result, reloads) {
  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(h.conf, 'utf8'), h.baseline);
  assert.equal(existsSync(h.marker), false);
  assert.equal(readCount(path.join(h.state, 'reload-count')), reloads);
}

shellTest('preview nginx validation failure restores the previous config', () => {
  const h = makeHarness();
  try {
    const result = run(h, { MOCK_NGINX_FAIL_FIRST: '1' });
    assertRollback(h, result, 1);
    assert.equal(readCount(path.join(h.state, 'nginx-t-count')), 2);
  } finally {
    h.cleanup();
  }
});

shellTest('preview reload failure restores and reloads the previous config', () => {
  const h = makeHarness();
  try {
    const result = run(h, { MOCK_RELOAD_FAIL_FIRST: '1' });
    assertRollback(h, result, 2);
    assert.equal(readCount(path.join(h.state, 'nginx-t-count')), 2);
  } finally {
    h.cleanup();
  }
});

shellTest('preview local smoke failure restores the previous config', () => {
  const h = makeHarness();
  try {
    const result = run(h, { MOCK_CURL_FAIL_MATCH: '/website.html' });
    assertRollback(h, result, 2);
  } finally {
    h.cleanup();
  }
});

shellTest('preview rollback failure is explicit and keeps the original failure status', () => {
  const h = makeHarness();
  try {
    const result = run(h, {
      MOCK_CURL_FAIL_MATCH: '/website.html',
      MOCK_ROLLBACK_FAIL: '1',
    });
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Automatic preview route rollback failed; inspect the Kakao VM before another cutover/,
    );
    assert.equal(readFileSync(h.conf, 'utf8'), h.baseline);
    assert.equal(existsSync(h.marker), true);
  } finally {
    h.cleanup();
  }
});

shellTest('successful preview publish keeps preview config and rollback marker', () => {
  const h = makeHarness();
  try {
    const result = run(h);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(readFileSync(h.conf, 'utf8'), /location \^~ \/admin\//);
    assert.equal(existsSync(h.marker), true);
    assert.equal(readCount(path.join(h.state, 'nginx-t-count')), 1);
    assert.equal(readCount(path.join(h.state, 'reload-count')), 1);
  } finally {
    h.cleanup();
  }
});


shellTest('stale preview rollback marker fails before served files or nginx config change', () => {
  const h = makeHarness({ staleMarker: true });
  try {
    const result = run(h);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Preview rollback backup is missing/);
    assert.equal(readFileSync(h.conf, 'utf8'), h.baseline);
    assert.equal(
      readFileSync(path.join(h.liveRoot, 'admin', 'admin', 'login.html'), 'utf8'),
      adminHtml('LIVE-ADMIN'),
    );
    assert.equal(
      readFileSync(path.join(h.liveRoot, 'web', 'privacy.html'), 'utf8'),
      '<html>LIVE-WEB</html>',
    );
    assert.equal(readCount(path.join(h.state, 'nginx-t-count')), 0);
  } finally {
    h.cleanup();
  }
});

shellTest('re-running the same preview release preserves served admin and web files', () => {
  const h = makeHarness({ existingPreview: true });
  try {
    const result = run(h);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(
      readFileSync(path.join(h.liveRoot, 'admin', 'admin', 'login.html'), 'utf8'),
      adminHtml('LIVE-ADMIN'),
    );
    assert.equal(
      readFileSync(path.join(h.liveRoot, 'web', 'privacy.html'), 'utf8'),
      '<html>LIVE-WEB</html>',
    );
    assert.equal(existsSync(h.marker), true);
  } finally {
    h.cleanup();
  }
});
