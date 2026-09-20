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
  path.join(repoRoot, 'scripts/add-kakao-static-cors.sh'),
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

function makeHarness() {
  const base = mkdtempSync(path.join(tmpdir(), 'wp-cors-cutover-'));
  const root = path.join(base, 'root');
  const bin = path.join(base, 'bin');
  const dockerState = path.join(base, 'docker-state');
  const envFile = path.join(root, '.env.kakao-prod');

  mkdirSync(root, { recursive: true });
  mkdirSync(bin, { recursive: true });
  mkdirSync(dockerState, { recursive: true });

  writeFileSync(envFile, 'CORS_ORIGINS=https://210.109.82.212\nKEEP=1\n', 'utf8');
  writeFileSync(path.join(dockerState, 'prod_owner'), 'old\n', 'utf8');
  writeFileSync(path.join(dockerState, 'old_name'), '/weddingpick-api\n', 'utf8');
  writeFileSync(path.join(dockerState, 'old_running'), '1\n', 'utf8');
  writeFileSync(path.join(dockerState, 'new_exists'), '0\n', 'utf8');
  writeFileSync(path.join(dockerState, 'new_running'), '0\n', 'utf8');
  writeFileSync(path.join(dockerState, 'removed_old'), '0\n', 'utf8');
  writeFileSync(path.join(dockerState, 'worker_in_api'), 'unset\n', 'utf8');

  const script = path.join(base, 'add-kakao-static-cors.sh');
  writeExecutable(
    script,
    source.replace('ROOT=/home/ubuntu/WeddingPick', `ROOT="${root}"`),
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
    path.join(bin, 'python3'),
    `#!/usr/bin/env bash
set -euo pipefail
if [ "\${1:-}" = "-" ]; then
  env_file="\${2:?}"
  tmp="$env_file.tmp"
  awk '
    BEGIN { done=0 }
    /^CORS_ORIGINS=/ {
      print "CORS_ORIGINS=https://210.109.82.212,https://210.109.82.212:9443"
      done=1
      next
    }
    { print }
    END {
      if (!done) print "CORS_ORIGINS=https://210.109.82.212,https://210.109.82.212:9443"
    }
  ' "$env_file" > "$tmp"
  mv "$tmp" "$env_file"
  exit 0
fi
body="$(cat)"
[ -n "$body" ] || exit 1
grep -Fq '"ok":true' <<< "$body"
grep -Fq '"database":"ok"' <<< "$body"
grep -Fq '"pending":[]' <<< "$body"
`,
  );

  writeExecutable(
    path.join(bin, 'docker'),
    `#!/usr/bin/env bash
set -euo pipefail
S="\${MOCK_DOCKER_STATE:?}"
FAIL="\${MOCK_FAIL_STAGE:-}"
OLD=old123
NEW=new456

get() { [ ! -f "$S/$1" ] || cat "$S/$1"; }
put() { printf '%s\\n' "$2" > "$S/$1"; }

resolve() {
  local target="$1" owner old_name
  owner="$(get prod_owner)"
  old_name="$(get old_name)"
  if [ "$target" = "$OLD" ]; then echo old; return 0; fi
  if [ "$target" = "$NEW" ] && [ "$(get new_exists)" = 1 ]; then echo new; return 0; fi
  if [ "$target" = weddingpick-api ]; then
    [ "$owner" != none ] || return 1
    echo "$owner"
    return 0
  fi
  if [ "$target" = "\${old_name#/}" ] && [ -n "$old_name" ]; then
    echo old
    return 0
  fi
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
    if [ "$FAIL" = inspect-old ] && [ "$target" = weddingpick-api ] && [ "$fmt" = '{{.Id}}' ]; then
      exit 1
    fi
    kind="$(resolve "$target")" || exit 1
    case "$fmt" in
      '{{.Id}}')
        [ "$kind" = old ] && echo "$OLD" || echo "$NEW"
        ;;
      '{{.Config.Image}}')
        echo 'weddingpick-api:test-image'
        ;;
      '{{.Name}}')
        if [ "$kind" = old ]; then get old_name; else echo '/weddingpick-api'; fi
        ;;
      '{{range .Config.Env}}{{println .}}{{end}}')
        if [ "$kind" = new ]; then
          if [ "$FAIL" = worker-env ]; then
            echo "RUN_WORKER_IN_API=true"
          else
            echo "RUN_WORKER_IN_API=$(get worker_in_api)"
          fi
        fi
        ;;
      *org.opencontainers.image.revision*)
        echo 'old-revision'
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
    [ "$target" = "$OLD" ] || exit 1
    if [ "$FAIL" = stop ]; then exit 1; fi
    put old_running 0
    ;;
  rename)
    from="$1"
    to="$2"
    kind="$(resolve "$from")" || exit 1
    [ "$kind" = old ] || exit 1
    if [ "$FAIL" = rename ] && [ "$to" != weddingpick-api ]; then
      exit 1
    fi
    put old_name "/$to"
    if [ "$to" = weddingpick-api ]; then put prod_owner old; else put prod_owner none; fi
    ;;
  run)
    name=''
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --name)
          name="$2"
          shift 2
          ;;
        --label|--env-file|-p)
          shift 2
          ;;
        -e)
          if [ "$2" = RUN_WORKER_IN_API=false ]; then
            put worker_in_api false
          fi
          shift 2
          ;;
        --restart=*)
          shift
          ;;
        -d|--pull=never)
          shift
          ;;
        *)
          shift
          ;;
      esac
    done
    [ "$name" = weddingpick-api ] || exit 1
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
      [ "$(get old_name)" != /weddingpick-api ] || put prod_owner old
    else
      put new_running 1
      put prod_owner new
    fi
    ;;
  *)
    echo "unsupported docker command: $cmd" >&2
    exit 2
    ;;
esac
`,
  );

  writeExecutable(
    path.join(bin, 'curl'),
    `#!/usr/bin/env bash
set -euo pipefail
S="\${MOCK_DOCKER_STATE:?}"
owner="$(cat "$S/prod_owner")"
if [ "\${MOCK_FAIL_STAGE:-}" = health-new ] && [ "$owner" = new ]; then
  exit 22
fi
printf '%s' '{"ok":true,"database":"ok","schema":{"ok":true,"pending":[]}}'
`,
  );

  return {
    base,
    root,
    dockerState,
    envFile,
    script,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      MOCK_DOCKER_STATE: dockerState,
      GITHUB_RUN_ID: '100',
      GITHUB_RUN_ATTEMPT: '1',
    },
    cleanup() {
      rmSync(base, { recursive: true, force: true });
    },
  };
}

function run(h, stage = '') {
  return spawnSync('bash', [h.script], {
    env: { ...h.env, MOCK_FAIL_STAGE: stage },
    encoding: 'utf8',
  });
}

function assertOldRestored(h) {
  assert.equal(state(path.join(h.dockerState, 'prod_owner')), 'old');
  assert.equal(state(path.join(h.dockerState, 'old_name')), '/weddingpick-api');
  assert.equal(state(path.join(h.dockerState, 'old_running')), '1');
  assert.equal(state(path.join(h.dockerState, 'removed_old'), '0'), '0', 'old container must never be removed');
  assert.equal(readFileSync(h.envFile, 'utf8'), 'CORS_ORIGINS=https://210.109.82.212\nKEEP=1\n');
}

shellTest('CORS preflight inspect failure leaves the production env and old API untouched', () => {
  const h = makeHarness();
  try {
    const result = run(h, 'inspect-old');
    assert.notEqual(result.status, 0);
    assertOldRestored(h);
  } finally {
    h.cleanup();
  }
});

for (const stage of ['stop', 'rename', 'run', 'worker-env', 'health-new']) {
  shellTest(`CORS cutover ${stage} failure restores the original API container by id`, () => {
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

shellTest('successful CORS cutover keeps the new API and retains the old recovery container', () => {
  const h = makeHarness();
  try {
    const result = run(h);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(state(path.join(h.dockerState, 'prod_owner')), 'new');
    assert.equal(state(path.join(h.dockerState, 'new_exists')), '1');
    assert.equal(state(path.join(h.dockerState, 'worker_in_api')), 'false');
    assert.match(state(path.join(h.dockerState, 'old_name')), /^\/weddingpick-api-cors-previous-/);
    assert.equal(state(path.join(h.dockerState, 'removed_old')), '0');
    assert.match(readFileSync(h.envFile, 'utf8'), /https:\/\/210\.109\.82\.212:8443/);
    assert.match(readFileSync(h.envFile, 'utf8'), /https:\/\/210\.109\.82\.212:9443/);
    assert.equal(existsSync(path.join(h.root, '.cors-cutover-backup')), true);
  } finally {
    h.cleanup();
  }
});
