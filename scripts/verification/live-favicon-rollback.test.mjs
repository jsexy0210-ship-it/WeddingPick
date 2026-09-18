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
  path.join(repoRoot, 'scripts/unify-live-favicon.sh'),
  'utf8',
);
const shellTest = process.platform === 'win32' ? test.skip : test;

function writeExecutable(file, content) {
  writeFileSync(file, content, 'utf8');
  chmodSync(file, 0o755);
}

function makeHarness({ existingFavicon }) {
  const base = mkdtempSync(path.join(tmpdir(), 'wp-favicon-rollback-'));
  const root = path.join(base, 'root');
  const liveRoot = path.join(base, 'live');
  const workspace = path.join(base, 'workspace');
  const bin = path.join(base, 'bin');
  const releaseSha = 'release-favicon-a';
  const releaseRoot = path.join(liveRoot, releaseSha);

  mkdirSync(root, { recursive: true });
  mkdirSync(path.join(releaseRoot, 'app'), { recursive: true });
  mkdirSync(path.join(releaseRoot, 'admin', 'admin'), { recursive: true });
  mkdirSync(path.join(releaseRoot, 'web'), { recursive: true });
  mkdirSync(path.join(workspace, 'apps', 'mobile', 'assets', 'images'), { recursive: true });
  mkdirSync(bin, { recursive: true });

  writeFileSync(path.join(root, 'static-live-app'), releaseSha + '\n', 'utf8');
  const oldHtml = '<html><head><link rel="icon" href="/favicon.png?v=old"></head><body>old</body></html>';
  writeFileSync(path.join(releaseRoot, 'app', 'index.html'), oldHtml, 'utf8');
  writeFileSync(path.join(releaseRoot, 'app', 'login.html'), oldHtml, 'utf8');
  writeFileSync(path.join(releaseRoot, 'admin', 'admin', 'login.html'), oldHtml, 'utf8');
  writeFileSync(path.join(releaseRoot, 'web', 'index.html'), oldHtml, 'utf8');

  const canonical = path.join(workspace, 'apps', 'mobile', 'assets', 'images', 'favicon.png');
  writeFileSync(canonical, Buffer.from('NEW-FAVICON'));
  if (existingFavicon) {
    writeFileSync(path.join(releaseRoot, 'app', 'favicon.png'), Buffer.from('OLD-FAVICON'));
  }

  const transformed = source
    .replace('ROOT=/home/ubuntu/WeddingPick', `ROOT="${root}"`)
    .replace('LIVE_ROOT=/var/www/weddingpick/releases', `LIVE_ROOT="${liveRoot}"`);
  const script = path.join(base, 'unify-live-favicon.sh');
  writeExecutable(script, transformed);

  writeExecutable(
    path.join(bin, 'sudo'),
    `#!/usr/bin/env bash
set -euo pipefail
if [ "\${1:-}" = "-n" ]; then shift; fi
exec "$@"
`,
  );

  writeExecutable(
    path.join(bin, 'curl'),
    `#!/usr/bin/env bash
set -euo pipefail
if [ "\${MOCK_CURL_FAIL:-0}" = "1" ]; then
  exit 22
fi

out=''
url=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o|--output)
      out="$2"
      shift 2
      ;;
    --connect-timeout|--max-time)
      shift 2
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

case "$url" in
  */favicon.png*)
    src="\${MOCK_RELEASE_ROOT}/app/favicon.png"
    ;;
  */admin/login)
    src="\${MOCK_RELEASE_ROOT}/admin/admin/login.html"
    ;;
  */website.html)
    src="\${MOCK_RELEASE_ROOT}/web/index.html"
    ;;
  */login)
    src="\${MOCK_RELEASE_ROOT}/app/login.html"
    ;;
  */)
    src="\${MOCK_RELEASE_ROOT}/app/index.html"
    ;;
  *)
    exit 22
    ;;
esac

test -n "$out"
cp "$src" "$out"
`,
  );

  return {
    base,
    root,
    releaseRoot,
    workspace,
    script,
    oldHtml,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      GITHUB_WORKSPACE: workspace,
      MOCK_RELEASE_ROOT: releaseRoot,
    },
    cleanup() {
      rmSync(base, { recursive: true, force: true });
    },
  };
}

function run(h, extraEnv = {}) {
  return spawnSync('bash', [h.script], {
    env: { ...h.env, ...extraEnv },
    encoding: 'utf8',
  });
}

shellTest('failed live favicon update restores the previous favicon bytes', () => {
  const h = makeHarness({ existingFavicon: true });
  try {
    const result = run(h, { MOCK_CURL_FAIL: '1' });
    assert.notEqual(result.status, 0);
    assert.equal(
      readFileSync(path.join(h.releaseRoot, 'app', 'favicon.png'), 'utf8'),
      'OLD-FAVICON',
    );
  } finally {
    h.cleanup();
  }
});

shellTest('failed live favicon update removes a favicon that did not exist before', () => {
  const h = makeHarness({ existingFavicon: false });
  try {
    const result = run(h, { MOCK_CURL_FAIL: '1' });
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(path.join(h.releaseRoot, 'app', 'favicon.png')), false);
  } finally {
    h.cleanup();
  }
});

shellTest('successful live favicon update keeps canonical favicon bytes', () => {
  const h = makeHarness({ existingFavicon: true });
  try {
    const result = run(h);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(
      readFileSync(path.join(h.releaseRoot, 'app', 'favicon.png'), 'utf8'),
      'NEW-FAVICON',
    );
    const html = readFileSync(path.join(h.releaseRoot, 'app', 'index.html'), 'utf8');
    assert.match(html, /\/favicon\.png\?v=20260918-unified1/);
  } finally {
    h.cleanup();
  }
});
