import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildAudit,
  classifyBackups,
  classifyRetention,
  parseCorsMarker,
  recoveryFamily,
} from '../audit-kakao-retention.mjs';

test('recognizes only recovery container families', () => {
  assert.equal(recoveryFamily('weddingpick-api-previous-10-1'), 'api');
  assert.equal(recoveryFamily('weddingpick-worker-previous-10-1'), 'worker');
  assert.equal(recoveryFamily('weddingpick-api-cors-previous-10-1'), 'api-cors');
  assert.equal(recoveryFamily('weddingpick-api'), null);
});

test('retains newest three per family and protects marker targets', () => {
  const items = [1, 2, 3, 4, 5].map(n => ({
    name: `weddingpick-api-previous-${n}-1`,
    timestamp: n,
    running: false,
  }));
  const rows = classifyRetention(items, {
    retain: 3,
    protectedNames: new Set(['weddingpick-api-previous-1-1']),
  });
  const byName = Object.fromEntries(rows.map(row => [row.name, row]));
  assert.equal(byName['weddingpick-api-previous-5-1'].disposition, 'KEEP');
  assert.equal(byName['weddingpick-api-previous-4-1'].disposition, 'KEEP');
  assert.equal(byName['weddingpick-api-previous-3-1'].disposition, 'KEEP');
  assert.equal(byName['weddingpick-api-previous-2-1'].disposition, 'CANDIDATE');
  assert.equal(byName['weddingpick-api-previous-1-1'].reason, 'referenced-by-marker');
});

test('running recovery container is never a cleanup candidate', () => {
  const rows = classifyRetention([
    { name: 'weddingpick-worker-previous-1-1', timestamp: 1, running: true },
    { name: 'weddingpick-worker-previous-2-1', timestamp: 2, running: false },
  ], { retain: 1 });
  const running = rows.find(row => row.running);
  assert.equal(running.disposition, 'KEEP');
  assert.equal(running.reason, 'running');
});

test('parses CORS recovery container marker without exposing env backup data', () => {
  assert.equal(
    parseCorsMarker('container=weddingpick-api-cors-previous-7-1\nenv_backup=/tmp/secret\n'),
    'weddingpick-api-cors-previous-7-1'
  );
});

test('nginx marker target is protected even when older than recent retention', () => {
  const files = [1, 2, 3].map(n => ({
    name: `weddingpick-static-sites-20260918T00000${n}Z.conf`,
    path: `/root/nginx-backups/weddingpick-static-sites-20260918T00000${n}Z.conf`,
    timestamp: n,
    size: 10,
  }));
  const rows = classifyBackups(files, {
    retain: 1,
    protectedPaths: new Set(['/root/nginx-backups/weddingpick-static-sites-20260918T000001Z.conf']),
  });
  const oldest = rows.find(row => row.timestamp === 1);
  const middle = rows.find(row => row.timestamp === 2);
  const newest = rows.find(row => row.timestamp === 3);
  assert.equal(oldest.reason, 'referenced-by-marker');
  assert.equal(middle.disposition, 'CANDIDATE');
  assert.equal(newest.disposition, 'KEEP');
});

test('audit is deterministic and read-only classification only', () => {
  const audit = buildAudit({
    containers: [
      { name: 'weddingpick-api-previous-2-1', timestamp: 2, running: false },
      { name: 'weddingpick-api-previous-1-1', timestamp: 1, running: false },
    ],
    protectedContainerNames: new Set(),
    backupFiles: [],
    protectedBackupPaths: new Set(),
    retain: 1,
  });
  assert.deepEqual(
    audit.containers.map(row => [row.name, row.disposition]),
    [
      ['weddingpick-api-previous-2-1', 'KEEP'],
      ['weddingpick-api-previous-1-1', 'CANDIDATE'],
    ]
  );
});
