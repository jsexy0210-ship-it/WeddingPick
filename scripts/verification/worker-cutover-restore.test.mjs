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
  path.join(repoRoot, 'scripts/update-kakao-worker.sh'),
  'utf8',
);
const shellTest = process.platform === 'win32' ? test.skip : test;

function writeExecutable(file, content) {
  writeFileSync(file, content, 'utf8');
  chmodSync(file, 0o755);
}

function state(file, fallback = '') {
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : fallback;
}

function makeHarness({ hadOld = true } = {}) {
  const base = mkdtempSync(path.join(tmpdir(), 'wp-worker-cutover-'));
  const bin = path.join(base, 'bin');
  const dockerState = path.join(base, 'docker-state');
  const envFile = path.join(base, '.env.kakao-prod');
  mkdirSync(bin, { recursive: true });
  mkdirSync(dockerState, { recursive: true });
  writeFileSync(envFile, 'DATABASE_URL=postgres://example\n', 'utf8');

  writeFileSync(path.join(dockerState, 'prod_owner'), hadOld ? 'old\n' : 'none\n', 'utf8');
  writeFileSync(path.join(dockerState, 'old_name'), hadOld ? '/weddingpick-worker\n' : '\n', 'utf8');
  writeFileSync(path.join(dockerState, 'old_running'), hadOld ? '1\n' : '0\n', 'utf8');
  writeFileSync(path.join(dockerState, 'new_exists'), '0\n', 'utf8');
  writeFileSync(path.join(dockerState, 'new_running'), '0\n', 'utf8');
  writeFileSync(path.join(dockerState, 'removed_old'), '0\n', 'utf8');

  const script = path.join(base, 'update-kakao-worker.sh');
  writeExecutable(
    script,
    source.replace(
      'ENV_FILE=/home/ubuntu/WeddingPick/.env.kakao-prod',
      `ENV_FILE="${envFile}"`,
    ),
  );

  writeExecutable(
    path.join(bin, 'sudo'),
    `#!/usr/bin/env bash
set -euo pipefail
if [ "\${1:-}" = "-n" ]; then shift; fi
exec "$@"
`,
  );

  writeExecutable(
    path.join(bin, 'sleep'),
    `#!/usr/bin/env bash
exit 0
`,
  );

  writeExecutable(
    path.join(bin, 'docker'),
    `#!/usr/bin/env bash
set -euo pipefail
S="\${MOCK_DOCKER_STATE:?}"
FAIL="\${MOCK_FAIL_STAGE:-}"
OLD=old-worker-id
NEW=new-worker-id

get() { [ ! -f "$S/$1" ] || cat "$S/$1"; }
put() { printf '%s\\n' "$2" > "$S/$1"; }

resolve() {
  local target="$1" owner old_name
  owner="$(get prod_owner)"
  old_name="$(get old_name)"
  if [ "$target" = "$OLD" ] && [ -n "$old_name" ]; then echo old; return 0; fi
  if [ "$target" = "$NEW" ] && [ "$(get new_exists)" = 1 ]; then echo new; return 0; fi
  if [ "$target" = weddingpick-worker ]; then
    [ "$owner" != none ] || return 1
    echo "$owner"
    return 0
  fi
  if [ -n "$old_name" ] && [ "$target" = "\${old_name#/}" ]; then echo old; return 0; fi
  return 1
}

cmd="\${1:-}"
shift || true
case "$cmd" in
  inspect)
    fmt=''
    if [ "\${1:-}" = -f ]; then
      fmt="$2"
      shift 2
    fi
    target="\${1:-}"
    kind="$(resolve "$target")" || exit 1
    case "$fmt" in
      '{{.Id}}')
        [ "$kind" = old ] && echo "$OLD" || echo "$NEW"
        ;;
      '{{.Config.Image}}')
        [ "$kind" = old ] && echo 'worker:image-old' || echo 'worker:image-new'
        ;;
      '{{.State.Running}}')
        if [ "$kind" = old ]; then
          [ "$(get old_running)" = 1 ] && echo true || echo false
        else
          if [ "$FAIL" = running ]; then echo false; else [ "$(get new_running)" = 1 ] && echo true || echo false; fi
        fi
        ;;
      '{{.Name}}')
        if [ "$kind" = old ]; then get old_name; else echo '/weddingpick-worker'; fi
        ;;
      '{{ index .Config.Labels "org.opencontainers.image.revision" }}')
        if [ "$kind" = new ]; then
          if [ "$FAIL" = revision ]; then
            printf '%040d\n' 0
          else
            printf '%040s\n' a | tr ' ' a
          fi
        else
          printf '%040s\n' c | tr ' ' c
        fi
        ;;
      '')
        echo '{}'
        ;;
      *)
        echo ''
        ;;
    esac
    ;;
  stop)
    while [ "$#" -gt 0 ] && [[ "$1" == --* ]]; do
      if [ "$1" = --time ]; then shift 2; else shift; fi
    done
    target="\${1:-}"
    kind="$(resolve "$target")" || exit 1
    [ "$kind" = old ] || exit 1
    if [ "$FAIL" = stop ]; then exit 1; fi
    put old_running 0
    ;;
  rename)
    from="$1"
    to="$2"
    kind="$(resolve "$from")" || exit 1
    [ "$kind" = old ] || exit 1
    if [ "$FAIL" = rename ] && [ "$to" != weddingpick-worker ]; then exit 1; fi
    put old_name "/$to"
    if [ "$to" = weddingpick-worker ]; then put prod_owner old; else put prod_owner none; fi
    ;;
  run)
    name=''
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --name)
          name="$2"; shift 2 ;;
        --env-file)
          shift 2 ;;
        --restart=*)
          shift ;;
        -d|--pull=never)
          shift ;;
        *)
          shift ;;
      esac
    done
    [ "$name" = weddingpick-worker ] || exit 1
    if [ "$FAIL" = run ]; then exit 1; fi
    put new_exists 1
    put new_running 1
    put prod_owner new
    echo "$NEW"
    ;;
  rm)
    [ "\${1:-}" != -f ] || shift
    target="\${1:-}"
    kind="$(resolve "$target")" || exit 0
    if [ "$kind" = old ]; then
      put removed_old 1
      put old_name /removed
      put old_running 0
      [ "$(get prod_owner)" != old ] || put prod_owner none
    else
      put new_exists 0
      put new_running 0
      [ "$(get prod_owner)" != new ] || put prod_owner none
    fi
    ;;
  start)
    target="\${1:-}"
    kind="$(resolve "$target")" || exit 1
    if [ "$kind" = old ]; then
      put old_running 1
      [ "$(get old_name)" != /weddingpick-worker ] || put prod_owner old
    else
      put new_running 1
      put prod_owner new
    fi
    ;;
  logs)
    target="\${1:-}"
    kind="$(resolve "$target")" || exit 1
    [ "$kind" = new ] || exit 1
    if [ "$FAIL" = logs ]; then
      echo 'worker booted without expected marker'
    else
      echo '분석 워커 시작'
    fi
    ;;
  *)
    echo "unsupported docker command: $cmd" >&2
    exit 2
    ;;
esac
`,
  );

  return {
    base,
    dockerState,
    script,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      MOCK_DOCKER_STATE: dockerState,
      GITHUB_RUN_ID: '200',
      GITHUB_RUN_ATTEMPT: '1',
      GITHUB_SHA: 'a'.repeat(40),
    },
    cleanup() {
      rmSync(base, { recursive: true, force: true });
    },
  };
}

function run(h, stage = '') {
  return spawnSync('bash', [h.script, 'worker:image-new'], {
    env: { ...h.env, MOCK_FAIL_STAGE: stage },
    encoding: 'utf8',
  });
}

function assertOldRestored(h) {
  assert.equal(state(path.join(h.dockerState, 'prod_owner')), 'old');
  assert.equal(state(path.join(h.dockerState, 'old_name')), '/weddingpick-worker');
  assert.equal(state(path.join(h.dockerState, 'old_running')), '1');
  assert.equal(state(path.join(h.dockerState, 'removed_old')), '0');
}

for (const stage of ['stop', 'rename', 'run', 'running', 'logs', 'revision']) {
  shellTest(`worker ${stage} failure restores the previous worker by id`, () => {
    const h = makeHarness();
    try {
      const result = run(h, stage);
      assert.notEqual(result.status, 0);
      assertOldRestored(h);
    } finally {
      h.cleanup();
    }
  });
}

shellTest('failed worker creation with no previous worker leaves no worker behind', () => {
  const h = makeHarness({ hadOld: false });
  try {
    const result = run(h, 'run');
    assert.notEqual(result.status, 0);
    assert.equal(state(path.join(h.dockerState, 'prod_owner')), 'none');
    assert.equal(state(path.join(h.dockerState, 'new_exists')), '0');
  } finally {
    h.cleanup();
  }
});

shellTest('successful worker update keeps new worker and retains old recovery container', () => {
  const h = makeHarness();
  try {
    const result = run(h);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(state(path.join(h.dockerState, 'prod_owner')), 'new');
    assert.equal(state(path.join(h.dockerState, 'new_exists')), '1');
    assert.equal(state(path.join(h.dockerState, 'new_running')), '1');
    assert.match(state(path.join(h.dockerState, 'old_name')), /^\/weddingpick-worker-previous-/);
    assert.equal(state(path.join(h.dockerState, 'removed_old'), '0');
  } finally {
    h.cleanup();
  }
});
