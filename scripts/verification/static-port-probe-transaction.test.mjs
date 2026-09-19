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
const probeSource = readFileSync(path.join(repoRoot, 'scripts/probe-kakao-static-ports.sh'), 'utf8');
const cleanupSource = readFileSync(path.join(repoRoot, 'scripts/cleanup-kakao-static-port-probes.sh'), 'utf8');

function writeExecutable(file, content) {
  writeFileSync(file, content, 'utf8');
  chmodSync(file, 0o755);
}

function rewrite(source, root, conf) {
  return source
    .replace('ROOT=/home/ubuntu/WeddingPick', `ROOT="${root}"`)
    .replace('CONF=/etc/nginx/conf.d/weddingpick-port-probe.conf', `CONF="${conf}"`);
}

function count(file) {
  return existsSync(file) ? Number(readFileSync(file, 'utf8')) : 0;
}

function harness({ existingConf = null } = {}) {
  const base = mkdtempSync(path.join(tmpdir(), 'wp-port-probe-'));
  const root = path.join(base, 'root');
  const conf = path.join(base, 'etc', 'weddingpick-port-probe.conf');
  const scripts = path.join(base, 'scripts');
  const bin = path.join(base, 'bin');
  const state = path.join(base, 'state');
  mkdirSync(root, { recursive: true });
  mkdirSync(path.dirname(conf), { recursive: true });
  mkdirSync(scripts, { recursive: true });
  mkdirSync(bin, { recursive: true });
  mkdirSync(state, { recursive: true });
  if (existingConf !== null) writeFileSync(conf, existingConf, 'utf8');

  const probe = path.join(scripts, 'probe-kakao-static-ports.sh');
  const cleanup = path.join(scripts, 'cleanup-kakao-static-port-probes.sh');
  writeExecutable(probe, rewrite(probeSource, root, conf));
  writeExecutable(cleanup, rewrite(cleanupSource, root, conf));

  writeExecutable(path.join(bin, 'sudo'), `#!/usr/bin/env bash
set -euo pipefail
if [ "\${1:-}" = "-n" ]; then shift; fi
exec "$@"
`);

  writeExecutable(path.join(bin, 'nginx'), `#!/usr/bin/env bash
set -euo pipefail
state="\${MOCK_STATE_DIR:?}"
case "\${1:-}" in
  -T)
    printf '%s\\n' 'ssl_certificate /tmp/cert.pem;' 'ssl_certificate_key /tmp/key.pem;'
    ;;
  -t)
    f="$state/nginx-count"; n=0; [ ! -f "$f" ] || n="$(cat "$f")"; n=$((n+1)); printf '%s' "$n" >"$f"
    if [ "\${MOCK_NGINX_FAIL_AT:-0}" = "$n" ]; then exit 1; fi
    ;;
esac
`);

  writeExecutable(path.join(bin, 'systemctl'), `#!/usr/bin/env bash
set -euo pipefail
state="\${MOCK_STATE_DIR:?}"
if [ "\${1:-}" = reload ] && [ "\${2:-}" = nginx ]; then
  f="$state/reload-count"; n=0; [ ! -f "$f" ] || n="$(cat "$f")"; n=$((n+1)); printf '%s' "$n" >"$f"
  if [ "\${MOCK_RELOAD_FAIL_AT:-0}" = "$n" ]; then exit 1; fi
fi
`);

  return {
    base, root, conf, probe, cleanup, state,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}`, MOCK_STATE_DIR: state },
    close() { rmSync(base, { recursive: true, force: true }); },
  };
}

function run(file, env) {
  return spawnSync('bash', [file], { env, encoding: 'utf8' });
}

shellTest('first probe install succeeds and cleanup removes the temporary config', () => {
  const h = harness();
  try {
    const install = run(h.probe, h.env);
    assert.equal(install.status, 0, install.stderr || install.stdout);
    assert.match(readFileSync(h.conf, 'utf8'), /X-WeddingPick-Probe/);
    assert.equal(count(path.join(h.state, 'reload-count')), 1);

    const cleanup = run(h.cleanup, h.env);
    assert.equal(cleanup.status, 0, cleanup.stderr || cleanup.stdout);
    assert.equal(existsSync(h.conf), false);
    assert.equal(count(path.join(h.state, 'reload-count')), 2);
    assert.equal(existsSync(path.join(h.root, '.static-port-probe-backup')), false);
  } finally { h.close(); }
});

shellTest('existing probe config is restored after a successful probe cycle', () => {
  const previous = 'server { # PREVIOUS_PROBE_STATE }\n';
  const h = harness({ existingConf: previous });
  try {
    assert.equal(run(h.probe, h.env).status, 0);
    assert.notEqual(readFileSync(h.conf, 'utf8'), previous);
    assert.equal(run(h.cleanup, h.env).status, 0);
    assert.equal(readFileSync(h.conf, 'utf8'), previous);
  } finally { h.close(); }
});

shellTest('probe nginx validation failure restores the previous config before cleanup job runs', () => {
  const previous = 'server { # PREVIOUS_PROBE_STATE }\n';
  const h = harness({ existingConf: previous });
  try {
    const result = run(h.probe, { ...h.env, MOCK_NGINX_FAIL_AT: '1' });
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(h.conf, 'utf8'), previous);
    assert.equal(count(path.join(h.state, 'nginx-count')), 2);
    assert.equal(count(path.join(h.state, 'reload-count')), 1);
    assert.equal(existsSync(path.join(h.root, '.static-port-probe-backup')), false);
  } finally { h.close(); }
});

shellTest('probe reload failure restores the previous config and reloads it', () => {
  const previous = 'server { # PREVIOUS_PROBE_STATE }\n';
  const h = harness({ existingConf: previous });
  try {
    const result = run(h.probe, { ...h.env, MOCK_RELOAD_FAIL_AT: '1' });
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(h.conf, 'utf8'), previous);
    assert.equal(count(path.join(h.state, 'reload-count')), 2);
    assert.equal(existsSync(path.join(h.root, '.static-port-probe-backup')), false);
  } finally { h.close(); }
});


shellTest('failed install rollback keeps marker when previous config cannot be validated', () => {
  const previous = 'server { # PREVIOUS_PROBE_STATE }\\n';
  const h = harness({ existingConf: previous });
  try {
    const result = run(h.probe, {
      ...h.env,
      MOCK_RELOAD_FAIL_AT: '1',
      MOCK_NGINX_FAIL_AT: '2',
    });
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(h.conf, 'utf8'), previous);
    assert.equal(existsSync(path.join(h.root, '.static-port-probe-backup')), true);
    assert.equal(count(path.join(h.state, 'reload-count')), 1);
  } finally { h.close(); }
});

shellTest('cleanup validation failure restores the active probe config and keeps transaction marker', () => {
  const previous = 'server { # PREVIOUS_PROBE_STATE }\n';
  const h = harness({ existingConf: previous });
  try {
    assert.equal(run(h.probe, h.env).status, 0);
    const activeProbe = readFileSync(h.conf, 'utf8');
    const result = run(h.cleanup, { ...h.env, MOCK_NGINX_FAIL_AT: '2' });
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(h.conf, 'utf8'), activeProbe);
    assert.equal(existsSync(path.join(h.root, '.static-port-probe-backup')), true);
  } finally { h.close(); }
});

shellTest('cleanup reload failure restores and reloads the active probe config', () => {
  const previous = 'server { # PREVIOUS_PROBE_STATE }\n';
  const h = harness({ existingConf: previous });
  try {
    assert.equal(run(h.probe, h.env).status, 0);
    const activeProbe = readFileSync(h.conf, 'utf8');
    const result = run(h.cleanup, { ...h.env, MOCK_RELOAD_FAIL_AT: '2' });
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(h.conf, 'utf8'), activeProbe);
    assert.equal(count(path.join(h.state, 'reload-count')), 3);
    assert.equal(existsSync(path.join(h.root, '.static-port-probe-backup')), true);
  } finally { h.close(); }
});
