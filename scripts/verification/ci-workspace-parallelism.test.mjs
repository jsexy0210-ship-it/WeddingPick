import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/main.yml', 'utf8').replaceAll('\r\n', '\n');

function jobBlock(name) {
  const marker = `  ${name}:\n`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `job ${name} must exist`);
  const rest = workflow.slice(start + marker.length);
  const next = rest.search(/\n  [a-zA-Z0-9_-]+:\n/);
  return next === -1 ? workflow.slice(start) : workflow.slice(start, start + marker.length + next);
}

function assertNeeds(block, expected) {
  const match = block.match(/needs:\s*\[([^\]]+)\]/);
  assert.ok(match, 'job must declare bracket-list needs');
  const actual = match[1].split(',').map((item) => item.trim());
  for (const dependency of expected) {
    assert.ok(actual.includes(dependency), `missing dependency: ${dependency}; actual=${actual.join(', ')}`);
  }
}

test('mobile/web/api-contract/domain tests run as independent matrix jobs', () => {
  const block = jobBlock('non-db-tests');
  assert.match(block, /workspace: \[mobile, web, api-contract, domain\]/);
  assert.match(block, /npm run test --workspace @weddingpick\/\$\{\{ matrix\.workspace \}\}/);
  assert.match(block, /cancel-in-progress: true/);
});

test('DB tests keep their isolated PostgreSQL service', () => {
  const block = jobBlock('db-tests');
  assert.match(block, /image: postgres:16/);
  assert.match(block, /DATABASE_URL: postgres:\/\/weddingpick:weddingpick@localhost:5432\/weddingpick_test/);
  assert.match(block, /npm run test --workspace @weddingpick\/db/);
});

test('root harnesses remain in the primary CI job', () => {
  const block = jobBlock('ci');
  assert.match(block, /name: Root harness tests/);
  assert.match(block, /run: npm run pretest/);
  assert.doesNotMatch(block, /npm run test --workspace @weddingpick\/mobile/);
  assert.doesNotMatch(block, /npm run test --workspace @weddingpick\/web/);
});

test('runner repair and static staging wait for all workspace tests', () => {
  const repair = jobBlock('repair-kakao-runner');
  assertNeeds(repair, ['ci', 'api-tests', 'non-db-tests', 'db-tests']);

  const stage = jobBlock('stage-kakao-static');
  assertNeeds(stage, ['ci', 'api-tests', 'non-db-tests', 'db-tests', 'repair-kakao-runner']);
  assert.match(stage, /needs\.non-db-tests\.result == 'success'/);
  assert.match(stage, /needs\.db-tests\.result == 'success'/);
});

test('API deployment path cannot bypass non-API workspace tests or migration gates', () => {
  const detect = jobBlock('api-deploy-needed');
  const deploy = jobBlock('deploy-kakao');
  assertNeeds(detect, [
    'ci',
    'api-tests',
    'non-db-tests',
    'db-tests',
    'repair-kakao-runner',
  ]);
  assertNeeds(deploy, [
    'ci',
    'api-tests',
    'non-db-tests',
    'db-tests',
    'repair-kakao-runner',
    'api-deploy-needed',
  ]);
});
