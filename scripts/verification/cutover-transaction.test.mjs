import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const shellTest = process.platform === 'win32' ? test.skip : test;
const appInstallSource = readFileSync(
  path.join(repoRoot, 'scripts/install-kakao-app-web.sh'),
  'utf8',
);
const appRollbackSource = readFileSync(
  path.join(repoRoot, 'scripts/rollback-kakao-app-web.sh'),
  'utf8',
);
const appCutoverWorkflow = readFileSync(
  path.join(repoRoot, '.github/workflows/cutover-kakao-app-web.yml'),
  'utf8',
);
const previewInstallSource = readFileSync(
  path.join(repoRoot, 'scripts/install-kakao-preview-routes.sh'),
  'utf8',
);
const previewWorkflow = readFileSync(
  path.join(repoRoot, '.github/workflows/preview-kakao-admin-web.yml'),
  'utf8',
);

function replaceRuntimePaths(source, root, conf) {
  return source
    .replace('ROOT=/home/ubuntu/WeddingPick', `ROOT="${root}"`)
    .replace('CONF=/etc/nginx/sites-available/weddingpick-api', `CONF="${conf}"`)
    .replaceAll('/var/www/weddingpick', path.join(root, 'var/www/weddingpick'));
}

function writeExecutable(file, content) {
  writeFileSync(file, content, 'utf8');
  chmodSync(file, 0o755);
}

function readCount(file) {
  try {
    return Number(readFileSync(file, 'utf8'));
  } catch {
    return 0;
  }
}

function makeHarness({ includeLogin = true } = {}) {
  const base = mkdtempSync(path.join(tmpdir(), 'wp-cutover-'));
  const root = path.join(base, 'root');
  const conf = path.join(base, 'etc', 'weddingpick-api');
  const scripts = path.join(base, 'scripts');
  const bin = path.join(base, 'bin');
  const state = path.join(base, 'state');
  const releaseSha = 'release-a';
  const releaseApp = path.join(root, 'static-releases', releaseSha, 'app');
  const servedApp = path.join(root, 'var', 'www', 'weddingpick', 'releases', releaseSha, 'app');

  mkdirSync(path.dirname(conf), { recursive: true });
  mkdirSync(releaseApp, { recursive: true });
  mkdirSync(scripts, { recursive: true });
  mkdirSync(bin, { recursive: true });
  mkdirSync(state, { recursive: true });

  const baseline = 'server {\n  listen 443 ssl;\n  # API_ONLY_BASELINE\n}\n';
  writeFileSync(conf, baseline, 'utf8');
  writeFileSync(path.join(releaseApp, 'index.html'), '<html>app</html>', 'utf8');
  if (includeLogin) {
    writeFileSync(path.join(releaseApp, 'login.html'), '<html>login</html>', 'utf8');
  }

  const installPath = path.join(scripts, 'install-kakao-app-web.sh');
  const rollbackPath = path.join(scripts, 'rollback-kakao-app-web.sh');
  writeExecutable(installPath, replaceRuntimePaths(appInstallSource, root, conf));
  writeExecutable(rollbackPath, replaceRuntimePaths(appRollbackSource, root, conf));

  writeExecutable(
    path.join(bin, 'sudo'),
    `#!/usr/bin/env bash
set -euo pipefail
if [ "${1:-}" = "-n" ]; then shift; fi
exec "$@"
`,
  );

  writeExecutable(
    path.join(bin, 'nginx'),
    `#!/usr/bin/env bash
set -euo pipefail
state="${MOCK_STATE_DIR:?}"
case "${1:-}" in
  -T)
    printf '%s\\n' 'ssl_certificate /tmp/mock-cert.pem;' 'ssl_certificate_key /tmp/mock-key.pem;'
    ;;
  -t)
    count_file="$state/nginx-t-count"
    count=0
    [ ! -f "$count_file" ] || count="$(cat "$count_file")"
    count=$((count + 1))
    printf '%s' "$count" > "$count_file"
    if [ "${MOCK_NGINX_T_FAIL_FIRST:-0}" = "1" ] && [ "$count" -eq 1 ]; then
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
state="${MOCK_STATE_DIR:?}"
if [ "${1:-}" = "reload" ] && [ "${2:-}" = "nginx" ]; then
  count_file="$state/reload-count"
  count=0
  [ ! -f "$count_file" ] || count="$(cat "$count_file")"
  count=$((count + 1))
  printf '%s' "$count" > "$count_file"
fi
exit 0
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
    -o|--output|--dump-header|--write-out|--header|--request|--connect-timeout|--max-time)
      if [ "$#" -ge 2 ]; then
        if [ "$1" = "-o" ] || [ "$1" = "--output" ]; then out="$2"; fi
        shift 2
      else
        shift
      fi
      ;;
    --fail|--silent|--show-error)
      shift
      ;;
    *)
      url="$1"
      shift
      ;;
  esac
done

if [ -n "${MOCK_CURL_FAIL_MATCH:-}" ] && [[ "$url" == *"${MOCK_CURL_FAIL_MATCH}"* ]]; then
  exit 22
fi

case "$url" in
  */health) body='{"ok":true,"database":"ok"}' ;;
  */login) body='<html>login</html>' ;;
  */v1/auth/providers) body='{"providers":[]}' ;;
  *) body='ok' ;;
esac

if [ -n "$out" ]; then
  printf '%s' "$body" > "$out"
else
  printf '%s' "$body"
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
    releaseApp,
    servedApp,
    baseline,
    env,
    cleanup() {
      rmSync(base, { recursive: true, force: true });
    },
  };
}

function run(script, args, env) {
  return spawnSync('bash', [script, ...args], {
    env,
    encoding: 'utf8',
  });
}

shellTest('candidate preparation failure leaves existing 443 config untouched', () => {
  const h = makeHarness({ includeLogin: false });
  try {
    const result = run(h.installPath, [h.releaseSha], h.env);
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(h.conf, 'utf8'), h.baseline);
    assert.equal(
      readFileSync(h.conf, 'utf8').includes('/var/www/weddingpick'),
      false,
    );
  } finally {
    h.cleanup();
  }
});

shellTest('first nginx validation failure restores and reloads the previous 443 config', () => {
  const h = makeHarness();
  try {
    const result = run(h.installPath, [h.releaseSha], {
      ...h.env,
      MOCK_NGINX_T_FAIL_FIRST: '1',
    });
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(h.conf, 'utf8'), h.baseline);
    assert.equal(readCount(path.join(h.state, 'nginx-t-count')), 2);
    assert.equal(readCount(path.join(h.state, 'reload-count')), 1);
  } finally {
    h.cleanup();
  }
});

shellTest('local public smoke failure restores the previous 443 config', () => {
  const h = makeHarness();
  try {
    const result = run(h.installPath, [h.releaseSha], {
      ...h.env,
      MOCK_CURL_FAIL_MATCH: '/login',
    });
    assert.notEqual(result.status, 0);
    assert.equal(
      readFileSync(h.conf, 'utf8'),
      h.baseline,
      [
        'install-kakao-app-web.sh changed 443 before smoke failed,',
        'so its EXIT failure handler must still be active at this point.',
        'A later EXIT trap must not replace rollback_on_error.',
      ].join(' '),
    );
  } finally {
    h.cleanup();
  }
});

shellTest('re-running the same live release preserves served files and the API-only backup', () => {
  const h = makeHarness();
  try {
    const first = run(h.installPath, [h.releaseSha], h.env);
    assert.equal(first.status, 0, first.stderr || first.stdout);

    const marker = path.join(h.root, '.app-web-cutover-backup');
    const firstBackup = readFileSync(marker, 'utf8').trim();
    assert.equal(readFileSync(firstBackup, 'utf8'), h.baseline);

    writeFileSync(path.join(h.servedApp, 'index.html'), '<html>LIVE-INDEX</html>', 'utf8');
    writeFileSync(path.join(h.servedApp, 'login.html'), '<html>LIVE-LOGIN</html>', 'utf8');
    writeFileSync(path.join(h.releaseApp, 'index.html'), '<html>NEW-SOURCE</html>', 'utf8');
    writeFileSync(path.join(h.releaseApp, 'login.html'), '<html>NEW-SOURCE-LOGIN</html>', 'utf8');

    const second = run(h.installPath, [h.releaseSha], h.env);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    const secondBackup = readFileSync(marker, 'utf8').trim();

    assert.equal(secondBackup, firstBackup);
    assert.equal(readFileSync(secondBackup, 'utf8'), h.baseline);
    assert.equal(readFileSync(path.join(h.servedApp, 'index.html'), 'utf8'), '<html>LIVE-INDEX</html>');
    assert.equal(readFileSync(path.join(h.servedApp, 'login.html'), 'utf8'), '<html>LIVE-LOGIN</html>');
  } finally {
    h.cleanup();
  }
});

shellTest('missing live marker fails closed before mutating the currently served app release', () => {
  const h = makeHarness();
  try {
    const first = run(h.installPath, [h.releaseSha], h.env);
    assert.equal(first.status, 0, first.stderr || first.stdout);

    const liveMarker = path.join(h.root, 'static-live-app');
    rmSync(liveMarker, { force: true });

    writeFileSync(path.join(h.servedApp, 'index.html'), '<html>LIVE-SAFE</html>', 'utf8');
    writeFileSync(path.join(h.releaseApp, 'index.html'), '<html>NEW-SOURCE</html>', 'utf8');

    const second = run(h.installPath, [h.releaseSha], h.env);
    assert.notEqual(second.status, 0);
    assert.match(second.stderr, /live release marker is missing/);
    assert.equal(readFileSync(path.join(h.servedApp, 'index.html'), 'utf8'), '<html>LIVE-SAFE</html>');
  } finally {
    h.cleanup();
  }
});

shellTest('stale rollback marker fails closed before mutating the live release', () => {
  const h = makeHarness();
  try {
    const first = run(h.installPath, [h.releaseSha], h.env);
    assert.equal(first.status, 0, first.stderr || first.stdout);

    const marker = path.join(h.root, '.app-web-cutover-backup');
    const missingBackup = readFileSync(marker, 'utf8').trim();
    rmSync(missingBackup, { force: true });

    const liveConfig = readFileSync(h.conf, 'utf8');
    writeFileSync(path.join(h.servedApp, 'index.html'), '<html>LIVE-SAFE</html>', 'utf8');
    writeFileSync(path.join(h.releaseApp, 'index.html'), '<html>NEW-SOURCE</html>', 'utf8');

    const second = run(h.installPath, [h.releaseSha], h.env);
    assert.notEqual(second.status, 0);
    assert.match(second.stderr, /Preserved API-only rollback backup is missing/);
    assert.equal(readFileSync(h.conf, 'utf8'), liveConfig);
    assert.equal(readFileSync(path.join(h.servedApp, 'index.html'), 'utf8'), '<html>LIVE-SAFE</html>');
  } finally {
    h.cleanup();
  }
});

shellTest('successful install clears rollback-on-exit and keeps app-web live', () => {
  const h = makeHarness();
  try {
    const result = run(h.installPath, [h.releaseSha], h.env);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const live = readFileSync(h.conf, 'utf8');
    assert.match(live, /static-releases\/release-a\/app/);
    assert.equal(
      readFileSync(path.join(h.root, 'static-live-app'), 'utf8').trim(),
      h.releaseSha,
    );
  } finally {
    h.cleanup();
  }
});

shellTest('explicit rollback is repeatable and returns 443 to the preserved baseline', () => {
  const h = makeHarness();
  try {
    const install = run(h.installPath, [h.releaseSha], h.env);
    assert.equal(install.status, 0, install.stderr || install.stdout);

    const first = run(h.rollbackPath, [], h.env);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    assert.equal(readFileSync(h.conf, 'utf8'), h.baseline);

    const second = run(h.rollbackPath, [], h.env);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.equal(readFileSync(h.conf, 'utf8'), h.baseline);
  } finally {
    h.cleanup();
  }
});

shellTest('workflow rollback ownership prevents double rollback after a successful local cutover', () => {
  assert.match(
    appCutoverWorkflow,
    /needs\.cutover\.result == 'success'\s*&&\s*needs\.verify\.result != 'success'/,
  );
  assert.match(appCutoverWorkflow, /rollback-kakao-app-web\.sh/);
  assert.match(appInstallSource, /trap rollback_on_error EXIT/);
  assert.match(appInstallSource, /trap - EXIT/);
});

shellTest('preview route flow keeps internal failure rollback separate from public-verify rollback', () => {
  assert.match(previewInstallSource, /trap rollback_on_error EXIT/);
  assert.match(previewInstallSource, /trap - EXIT/);
  assert.match(
    previewWorkflow,
    /needs\.publish\.result == 'success'\s*&&\s*needs\.verify\.result != 'success'/,
  );
  assert.match(previewWorkflow, /rollback-kakao-preview-routes\.sh/);
});
