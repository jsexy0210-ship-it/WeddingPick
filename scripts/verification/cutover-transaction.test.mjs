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

function makeHarness({ includeLogin = true } = {}) {
  const base = mkdtempSync(path.join(tmpdir(), 'wp-cutover-'));
  const root = path.join(base, 'root');
  const conf = path.join(base, 'etc', 'weddingpick-api');
  const scripts = path.join(base, 'scripts');
  const bin = path.join(base, 'bin');
  const releaseSha = 'release-a';
  const releaseApp = path.join(root, 'static-releases', releaseSha, 'app');

  mkdirSync(path.dirname(conf), { recursive: true });
  mkdirSync(releaseApp, { recursive: true });
  mkdirSync(scripts, { recursive: true });
  mkdirSync(bin, { recursive: true });

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
case "${1:-}" in
  -T)
    printf '%s\\n' 'ssl_certificate /tmp/mock-cert.pem;' 'ssl_certificate_key /tmp/mock-key.pem;'
    ;;
  -t)
    if [ "${MOCK_NGINX_T_FAIL:-0}" = "1" ]; then
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
  };

  return {
    base,
    root,
    conf,
    installPath,
    rollbackPath,
    releaseSha,
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

test('candidate preparation failure leaves existing 443 config untouched', () => {
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

test('nginx config validation failure restores the previous 443 config', () => {
  const h = makeHarness();
  try {
    const result = run(h.installPath, [h.releaseSha], {
      ...h.env,
      MOCK_NGINX_T_FAIL: '1',
    });
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(h.conf, 'utf8'), h.baseline);
  } finally {
    h.cleanup();
  }
});

test('local public smoke failure restores the previous 443 config', () => {
  const h = makeHarness();
  try {
    const result = run(h.installPath, [h.releaseSha], {
      ...h.env,
      MOCK_CURL_FAIL_MATCH: '/health',
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

test('re-running while app-web already owns 443 preserves the original API-only rollback backup', () => {
  const h = makeHarness();
  try {
    const first = run(h.installPath, [h.releaseSha], h.env);
    assert.equal(first.status, 0, first.stderr || first.stdout);

    const marker = path.join(h.root, '.app-web-cutover-backup');
    const firstBackup = readFileSync(marker, 'utf8').trim();
    assert.equal(readFileSync(firstBackup, 'utf8'), h.baseline);

    const second = run(h.installPath, [h.releaseSha], h.env);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    const secondBackup = readFileSync(marker, 'utf8').trim();

    assert.equal(secondBackup, firstBackup);
    assert.equal(readFileSync(secondBackup, 'utf8'), h.baseline);
  } finally {
    h.cleanup();
  }
});

test('successful install clears rollback-on-exit and keeps app-web live', () => {
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

test('explicit rollback is repeatable and returns 443 to the preserved baseline', () => {
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

test('workflow rollback ownership prevents double rollback after a successful local cutover', () => {
  assert.match(
    appCutoverWorkflow,
    /needs\.cutover\.result == 'success'\s*&&\s*needs\.verify\.result != 'success'/,
  );
  assert.match(appCutoverWorkflow, /rollback-kakao-app-web\.sh/);
  assert.match(appInstallSource, /trap rollback_on_error EXIT/);
  assert.match(appInstallSource, /trap - EXIT/);
});

test('preview route flow keeps internal failure rollback separate from public-verify rollback', () => {
  assert.match(previewInstallSource, /trap rollback_on_error EXIT/);
  assert.match(previewInstallSource, /trap - EXIT/);
  assert.match(
    previewWorkflow,
    /needs\.publish\.result == 'success'\s*&&\s*needs\.verify\.result != 'success'/,
  );
  assert.match(previewWorkflow, /rollback-kakao-preview-routes\.sh/);
});
