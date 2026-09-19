import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const workflow = readFileSync(resolve(root, '.github/workflows/kakao-retention-cleanup.yml'), 'utf8');
const cleanup = readFileSync(resolve(root, 'scripts/cleanup-kakao-retention.mjs'), 'utf8');
const audit = readFileSync(resolve(root, 'scripts/audit-kakao-retention.mjs'), 'utf8');

test('retention cleanup is manual only and apply requires production approval', () => {
  assert.match(workflow, /on:\n  workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\n\s+push:/);
  assert.doesNotMatch(workflow, /\n\s+pull_request:/);
  assert.match(workflow, /group: weddingpick-kakao-vm-write/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /dry-run:[\s\S]*if: \$\{\{ !inputs\.apply \}\}/);
  assert.match(workflow, /apply:[\s\S]*if: \$\{\{ inputs\.apply \}\}[\s\S]*environment: production/);
  assert.match(workflow, /WP_RETENTION_APPROVED: '1'/);
  assert.match(workflow, /cleanup-kakao-retention\.mjs --apply/);
});

test('cleanup defaults to dry-run and rechecks each candidate before delete', () => {
  assert.match(cleanup, /const apply = args\.includes\('--apply'\)/);
  assert.match(cleanup, /requireApplyApproval\(apply\)/);
  assert.match(cleanup, /WP_RETENTION_APPROVED !== '1'/);
  assert.match(cleanup, /assertStillCandidate\(root, retain, 'container', name\)/);
  assert.match(cleanup, /assertStillCandidate\(root, retain, 'backup', target\)/);
  assert.match(cleanup, /candidate set changed before apply/i);
  assert.doesNotMatch(cleanup, /docker[^\n]*system[^\n]*prune/i);
  assert.doesNotMatch(cleanup, /docker[^\n]*image[^\n]*prune/i);
});

test('read-only audit collectors are reused instead of reimplementing retention rules', () => {
  assert.match(audit, /export function collectRecoveryContainers/);
  assert.match(audit, /export function collectNginxBackups/);
  assert.match(cleanup, /collectRecoveryContainers/);
  assert.match(cleanup, /collectNginxBackups/);
});
