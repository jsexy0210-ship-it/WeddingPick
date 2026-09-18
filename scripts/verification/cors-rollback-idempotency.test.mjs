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
const shellTest = process.platform === 'win32' ? test.skip : test;
const source = readFileSync(path.join(repoRoot, 'scripts/rollback-kakao-static-cors.sh'), 'utf8');

function executable(file, content) {
  writeFileSync(file, content, 'utf8');
  chmodSync(file, 0o755);
}

function get(file, fallback = '') {
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : fallback;
}

function harness({ backupExists = true, markerExists = true } = {}) {
  const base = mkdtempSync(path.join(tmpdir(), 'wp-cors-rollback-'));
  const root = path.join(base, 'root');
  const bin = path.join(base, 'bin');
  const state = path.join(base, 'state');
  const env = path.join(root, '.env.kakao-prod');
  const oldEnv = path.join(root, 'env-old');
  mkdirSync(root, { recursive: true });
  mkdirSync(bin, { recursive: true });
  mkdirSync(state, { recursive: true });

  writeFileSync(env, 'CORS_ORIGINS=new\n', 'utf8');
  writeFileSync(oldEnv, 'CORS_ORIGINS=old\n', 'utf8');
  writeFileSync(path.join(state, 'prod_exists'), '1\n', 'utf8');
  writeFileSync(path.join(state, 'prod_id'), 'new123\n', 'utf8');
  writeFileSync(path.join(state, 'backup_exists'), backupExists ? '1\n' : '0\n', 'utf8');
  writeFileSync(path.join(state, 'backup_name'), 'weddingpick-api-cors-previous-100-1\n', 'utf8');
  writeFileSync(path.join(state, 'removed_prod'), '0\n', 'utf8');

  if (markerExists) {
    writeFileSync(
      path.join(root, '.cors-cutover-backup'),
      `container=weddingpick-api-cors-previous-100-1\nenv_backup=${oldEnv}\n`,
      'utf8',
    );
  }

  const script = path.join(base, 'rollback.sh');
  executable(script, source.replace('ROOT=/home/ubuntu/WeddingPick', `ROOT="${root}"`));
  executable(path.join(bin, 'sudo'), `#!/usr/bin/env bash
set -euo pipefail
if [ "${1:-}" = "-n" ]; then shift; fi
exec "$@"
`);
  executable(path.join(bin, 'sleep'), '#!/usr/bin/env bash\nexit 0\n');
  executable(path.join(bin, 'docker'), `#!/usr/bin/env bash
set -euo pipefail
S="${MOCK_STATE_DIR:?}"
cmd="${1:-}"; shift || true
case "$cmd" in
  inspect)
    fmt=''
    if [ "${1:-}" = -f ]; then fmt="$2"; shift 2; fi
    target="${1:-}"
    if [ "$target" = weddingpick-api-cors-previous-100-1 ]; then
      [ "$(cat "$S/backup_exists")" = 1 ] || exit 1
      [ -z "$fmt" ] && echo '{}' || echo old123
      exit 0
    fi
    if [ "$target" = weddingpick-api ]; then
      [ "$(cat "$S/prod_exists")" = 1 ] || exit 1
      [ "$fmt" = '{{.Id}}' ] && cat "$S/prod_id" || echo '{}'
      exit 0
    fi
    exit 1
    ;;
  rm)
    [ "${1:-}" != -f ] || shift
    target="${1:-}"
    if [ "$target" = new123 ] || [ "$target" = weddingpick-api ]; then
      printf '1\n' > "$S/removed_prod"
      printf '0\n' > "$S/prod_exists"
    fi
    ;;
  rename)
    [ "$1" = weddingpick-api-cors-previous-100-1 ]
    [ "$2" = weddingpick-api ]
    [ "$(cat "$S/backup_exists")" = 1 ]
    printf '0\n' > "$S/backup_exists"
    printf '1\n' > "$S/prod_exists"
    printf 'old123\n' > "$S/prod_id"
    ;;
  start)
    [ "$1" = weddingpick-api ]
    ;;
  *)
    echo "unsupported docker command: $cmd" >&2
    exit 2
    ;;
esac
`);
  executable(path.join(bin, 'curl'), `#!/usr/bin/env bash
set -euo pipefail
S="${MOCK_STATE_DIR:?}"
if [ "${MOCK_HEALTH_FAIL:-0}" = 1 ]; then exit 22; fi
[ "$(cat "$S/prod_id")" = old123 ] || exit 22
printf '%s' '{"ok":true}'
`);

  return {
    base, root, state, env, oldEnv, script,
    marker: path.join(root, '.cors-cutover-backup'),
    run(extra = {}) {
      return spawnSync('bash', [script], {
        env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}`, MOCK_STATE_DIR: state, ...extra },
        encoding: 'utf8',
      });
    },
    close() { rmSync(base, { recursive: true, force: true }); },
  };
}

shellTest('successful rollback restores old API and removes transaction marker', () => {
  const h = harness();
  try {
    const result = h.run();
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(get(path.join(h.state, 'prod_id')), 'old123');
    assert.equal(readFileSync(h.env, 'utf8'), 'CORS_ORIGINS=old\n');
    assert.equal(existsSync(h.marker), false);
  } finally { h.close(); }
});

shellTest('second rollback after success is a no-op and does not delete the restored API', () => {
  const h = harness();
  try {
    assert.equal(h.run().status, 0);
    const second = h.run();
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.equal(get(path.join(h.state, 'prod_id')), 'old123');
    assert.equal(get(path.join(h.state, 'removed_prod')), '1');
  } finally { h.close(); }
});

shellTest('stale marker with missing recovery container preserves current API', () => {
  const h = harness({ backupExists: false });
  try {
    const result = h.run();
    assert.notEqual(result.status, 0);
    assert.equal(get(path.join(h.state, 'prod_id')), 'new123');
    assert.equal(get(path.join(h.state, 'removed_prod')), '0');
    assert.equal(readFileSync(h.env, 'utf8'), 'CORS_ORIGINS=new\n');
    assert.equal(existsSync(h.marker), true);
  } finally { h.close(); }
});

shellTest('missing marker is an idempotent no-op', () => {
  const h = harness({ markerExists: false });
  try {
    const result = h.run();
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(get(path.join(h.state, 'prod_id')), 'new123');
    assert.equal(get(path.join(h.state, 'removed_prod')), '0');
  } finally { h.close(); }
});

shellTest('health failure keeps rollback marker for investigation', () => {
  const h = harness();
  try {
    const result = h.run({ MOCK_HEALTH_FAIL: '1' });
    assert.notEqual(result.status, 0);
    assert.equal(get(path.join(h.state, 'prod_id')), 'old123');
    assert.equal(existsSync(h.marker), true);
    assert.equal(readFileSync(h.env, 'utf8'), 'CORS_ORIGINS=old\n');
  } finally { h.close(); }
});
