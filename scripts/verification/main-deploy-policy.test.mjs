import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/main.yml', 'utf8').replaceAll('\r\n', '\n');
const apiWorkflow = readFileSync('.github/workflows/deploy-kakao-api.yml', 'utf8');
const dbWorkflow = readFileSync('.github/workflows/db-migrate.yml', 'utf8');
const cutoverWorkflow = readFileSync('.github/workflows/cutover-kakao-app-web.yml', 'utf8');
const installAppWeb = readFileSync('scripts/install-kakao-app-web.sh', 'utf8');

function jobBlock(name) {
  const marker = `  ${name}:\n`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `job ${name} must exist`);
  const rest = workflow.slice(start + marker.length);
  const next = rest.search(/\n  [a-zA-Z0-9_-]+:\n/);
  return next === -1 ? workflow.slice(start) : workflow.slice(start, start + marker.length + next);
}

test('every validated main revision can catch up API deployment', () => {
  assert.doesNotMatch(workflow, /ALLOWED_PRS|current-backlog-production/);

  const repair = jobBlock('repair-kakao-runner');
  assert.match(repair, /needs: \[ci, api-tests, non-db-tests, db-tests\]/);
  assert.match(repair, /needs\.db-tests\.result == 'success'/);

  const detect = jobBlock('api-deploy-needed');
  assert.match(detect, /needs\.repair-kakao-runner\.result/);
  assert.match(detect, /spec\/\(glossary\|font-subsets\|strings\\\.ko\)/);

  const deploy = jobBlock('deploy-kakao');
  assert.match(deploy, /needs\.api-deploy-needed\.outputs\.changed == 'true'/);
  assert.match(deploy, /environment_name: production/);
});

test('static changes cut over only the exact fully validated candidate', () => {
  const cutover = jobBlock('cutover-kakao-app-web');
  assert.match(cutover, /needs\.ci\.outputs\.stage_static == 'true'/);
  assert.match(cutover, /needs\.stage-kakao-static\.result == 'success'/);
  assert.match(cutover, /needs\.stage-kakao-static\.outputs\.candidate_sha == github\.sha/);
  assert.match(cutover, /needs\.deploy-kakao\.result == 'success'/);
  assert.match(cutover, /needs\.deploy-kakao\.result == 'skipped'/);
  assert.doesNotMatch(cutover, /head_commit\.message/);
});

test('runtime inputs and database writes use the production deployment boundary', () => {
  assert.match(apiWorkflow, /spec\/\(glossary\|font-subsets\|strings\\\.ko\)/);
  assert.match(dbWorkflow, /group: weddingpick-kakao-vm-write/);
  assert.match(dbWorkflow, /cancel-in-progress: false/);
  assert.match(dbWorkflow, /paths:\s*\n\s*- packages\/db\/migrations\/0426_expo_collection_thumbnail\\.sql/);
  assert.doesNotMatch(dbWorkflow, /packages\/db\/migrations\/\*\*/);
});

test('admin smoke separates candidate identity from public route checks', () => {
  assert.doesNotMatch(cutoverWorkflow, /grep -Fq '웨딩픽 관리자' \/tmp\/admin\.html/);
  assert.match(cutoverWorkflow, /\/_expo\/static\/js\/web\//);
  assert.match(cutoverWorkflow, /관리자 콘솔 주소가 바뀌었어요/);
  assert.match(installAppWeb, /grep -Fq '웨딩픽 관리자' "\$admin_smoke"/);
  assert.match(installAppWeb, /grep -RFq '\\uc6e8\\ub529\\ud53d \\uad00\\ub9ac\\uc790'/);
});
