import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/main.yml', 'utf8');

function jobBlock(name) {
  const marker = `  ${name}:\n`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `job ${name} must exist`);
  const rest = workflow.slice(start + marker.length);
  const next = rest.search(/\n  [a-zA-Z0-9_-]+:\n/);
  return next === -1 ? workflow.slice(start) : workflow.slice(start, start + marker.length + next);
}

test('PR417 alone runs the current-backlog DB migration before API deployment', () => {
  const migration = jobBlock('migrate-current-backlog-db');
  assert.match(migration, /pr_number == '417'/);
  assert.match(migration, /environment: production-current-backlog-auto/);
  assert.match(migration, /npm run migrate --workspace @weddingpick\/db/);

  const detect = jobBlock('api-deploy-needed');
  assert.match(detect, /migrate-current-backlog-db/);
  assert.match(detect, /pr_number != '417' \|\| needs\.migrate-current-backlog-db\.result == 'success'/);
});

test('app-web cutover cannot bypass a failed PR417 migration', () => {
  const cutover = jobBlock('auto-cutover-current-backlog-app-web');
  assert.match(cutover, /migrate-current-backlog-db/);
  assert.match(cutover, /pr_number != '417' \|\| needs\.migrate-current-backlog-db\.result == 'success'/);
});
