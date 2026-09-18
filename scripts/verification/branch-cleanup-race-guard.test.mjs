import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/branch-cleanup.yml', 'utf8');

test('branch deletion is pinned to the scanned SHA', () => {
  assert.match(workflow, /git ls-remote --heads origin "refs\/heads\/\$ref"/);
  assert.match(workflow, /current_sha.*!=.*\$sha/s);
  assert.match(workflow, /--force-with-lease="refs\/heads\/\$ref:\$sha"/);
  assert.match(workflow, /origin ":refs\/heads\/\$ref"/);
  assert.doesNotMatch(workflow, /git push origin --delete "\$ref"/);
});

test('branch state is rechecked immediately before delete', () => {
  assert.match(workflow, /gh pr list --state open --head "\$ref"/);
  assert.match(workflow, /select\(\.status != "completed"\)/);
  assert.match(workflow, /branches\/\$encoded_ref/);
  assert.match(workflow, /if \[ "\$protected" = "true" \]/);
});

test('backup and runtime smoke branches are protected by default', () => {
  assert.match(workflow, /backup\/\*/);
  assert.match(workflow, /ops\/kakao-runtime-smoke/);
  assert.match(workflow, /backup\/main-history-reset-2026-09-16/);
});

test('cleanup remains dry-run by default', () => {
  assert.match(workflow, /dry_run:/);
  assert.match(workflow, /default: true/);
  assert.match(workflow, /if \[ "\$DRY_RUN" != "false" \]/);
});
