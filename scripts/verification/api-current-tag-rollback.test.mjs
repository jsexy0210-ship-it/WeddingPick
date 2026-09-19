import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = readFileSync(
  path.join(repoRoot, '.github/workflows/deploy-kakao-api.yml'),
  'utf8',
);

function position(fragment) {
  const index = workflow.indexOf(fragment);
  assert.notEqual(index, -1, `missing workflow fragment: ${fragment}`);
  return index;
}

test('captures previous API image before cutover starts', () => {
  const oldId = position('OLD_ID="$(sudo -n docker inspect -f');
  const oldImage = position('OLD_IMAGE="$(sudo -n docker inspect -f');
  const cutover = position('CUTOVER_STARTED=1');
  assert.ok(oldId < oldImage);
  assert.ok(oldImage < cutover);
  assert.match(
    workflow,
    /OLD_IMAGE="\$\(sudo -n docker inspect -f '\{\{\.Image\}\}' "\$OLD_ID"\)"/,
  );
  assert.match(workflow, /test -n "\$OLD_IMAGE"/);
});

test('rollback restores kakao-current only after previous API is healthy', () => {
  const previousHealthy = position(
    'docker start "$OLD_ID" >/dev/null && health_ok http://127.0.0.1:3001/health 30 2',
  );
  const restoreTag = position(
    'docker tag "$OLD_IMAGE" weddingpick-api:kakao-current',
  );
  assert.ok(previousHealthy < restoreTag);
  assert.match(
    workflow,
    /Previous API container and current image tag restored\./,
  );
});

test('new current tag is still written before dedicated worker handoff', () => {
  const newTag = position('docker tag "$IMAGE" weddingpick-api:kakao-current');
  const worker = position('bash scripts/update-kakao-worker.sh "$WORKER_IMAGE"');
  assert.ok(newTag < worker);
});

test('deployment is only marked successful after dedicated worker handoff', () => {
  const worker = position('bash scripts/update-kakao-worker.sh "$WORKER_IMAGE"');
  const deployed = position('DEPLOYED=1');
  assert.ok(worker < deployed);
});
