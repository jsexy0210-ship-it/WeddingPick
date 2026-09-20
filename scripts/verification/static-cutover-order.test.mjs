import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync('.github/workflows/main.yml', 'utf8').replaceAll('\r\n', '\n');
const stage = readFileSync('.github/workflows/stage-kakao-static.yml', 'utf8').replaceAll('\r\n', '\n');

function jobBlock(source, name) {
  const marker = `  ${name}:\n`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `job ${name} must exist`);
  const rest = source.slice(start + marker.length);
  const next = rest.search(/\n  [a-zA-Z0-9_-]+:\n/);
  return next === -1 ? source.slice(start) : source.slice(start, start + marker.length + next);
}

test('admin/web cutover waits for validation and exact staged candidate when staging is required', () => {
  const cutover = jobBlock(main, 'cutover-kakao-admin-web');
  assert.match(cutover, /needs: \[ci, api-tests, repair-kakao-runner, stage-kakao-static\]/);
  assert.match(cutover, /always\(\)/);
  assert.match(cutover, /needs\.ci\.result == 'success'/);
  assert.match(cutover, /needs\.api-tests\.result == 'success'/);
  assert.match(cutover, /needs\.ci\.outputs\.stage_static != 'true'/);
  assert.match(cutover, /needs\.stage-kakao-static\.result == 'success'/);
  assert.match(cutover, /needs\.stage-kakao-static\.outputs\.candidate_sha == github\.sha/);
});

test('staging publishes the validated candidate SHA only after the candidate marker is replaced', () => {
  assert.match(stage, /workflow_call:\n    outputs:\n      candidate_sha:/);
  assert.match(stage, /candidate_sha: \$\{\{ steps\.publish_candidate\.outputs\.candidate_sha \}\}/);
  assert.match(stage, /id: publish_candidate/);
  const markerMove = stage.indexOf('mv -f "$candidate_marker_tmp" "$candidate_marker"');
  const outputWrite = stage.indexOf('echo "candidate_sha=$GITHUB_SHA" >> "$GITHUB_OUTPUT"');
  assert.ok(markerMove >= 0, 'candidate marker atomic replace must exist');
  assert.ok(outputWrite > markerMove, 'candidate SHA output must be emitted only after marker publication');
});

test('a static-changing cutover cannot treat a stale/no-op staging run as current', () => {
  const cutover = jobBlock(main, 'cutover-kakao-admin-web');
  assert.match(
    cutover,
    /needs\.ci\.outputs\.stage_static != 'true' \|\| \(needs\.stage-kakao-static\.result == 'success' && needs\.stage-kakao-static\.outputs\.candidate_sha == github\.sha\)/,
  );
});


test('staging rechecks current main immediately before publishing latest-candidate', () => {
  const publishStart = stage.indexOf('- name: Publish validated static candidate');
  assert.ok(publishStart >= 0, 'publish candidate step must exist');
  const publish = stage.slice(publishStart);
  const recheck = publish.indexOf('git ls-remote https://github.com/jsexy0210-ship-it/WeddingPick.git refs/heads/main');
  const markerWrite = publish.indexOf('printf \'%s\\n\' "$GITHUB_SHA" > "$candidate_marker_tmp"');
  assert.ok(recheck >= 0, 'publish step must recheck current main');
  assert.ok(markerWrite > recheck, 'main recheck must happen before candidate marker write');
  assert.match(publish, /if \[ "\$current" != "\$GITHUB_SHA" \]; then[\s\S]*exit 0/);
});
