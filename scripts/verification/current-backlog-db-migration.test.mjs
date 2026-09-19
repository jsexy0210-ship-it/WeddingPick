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

test('PR417 and deployment-successor PR431 run current-backlog DB migration before API deployment', () => {
  const gate = jobBlock('current-backlog-production');
  assert.match(gate, /ALLOWED_PRS:[^\n]*\b417\b[^\n]*\b431\b/);

  const migration = jobBlock('migrate-current-backlog-db');
  assert.match(migration, /pr_number == '417'/);
  assert.match(migration, /pr_number == '431'/);
  assert.match(migration, /environment: production-current-backlog-auto/);
  assert.match(migration, /runs-on: \[self-hosted, Linux, X64, weddingpick-kakao\]/);
  assert.match(migration, /docker inspect[^\n]+weddingpick-api/);
  assert.match(migration, /npm run migrate --workspace @weddingpick\/db/);

  const detect = jobBlock('api-deploy-needed');
  assert.match(detect, /pr_number != '417'/);
  assert.match(detect, /pr_number != '431'/);
  assert.match(detect, /needs\.migrate-current-backlog-db\.result == 'success'/);
});

test('app-web cutover cannot bypass a failed migration for PR417 or PR431', () => {
  const cutover = jobBlock('auto-cutover-current-backlog-app-web');
  assert.match(cutover, /migrate-current-backlog-db/);
  assert.match(cutover, /pr_number != '417'/);
  assert.match(cutover, /pr_number != '431'/);
  assert.match(cutover, /needs\.migrate-current-backlog-db\.result == 'success'/);
});
