import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const dockerfile = readFileSync(resolve(root, 'Dockerfile'), 'utf8');
const dockerignore = readFileSync(resolve(root, '.dockerignore'), 'utf8');
const worker = readFileSync(resolve(root, 'scripts/update-kakao-worker.sh'), 'utf8');

test('production image installs only API production workspace dependencies', () => {
  assert.match(dockerfile, /FROM node:22-alpine AS runtime-deps/);
  assert.match(dockerfile, /npm ci[\s\\]+--omit=dev[\s\\]+--workspace @weddingpick\/api[\s\\]+--include-workspace-root=false/);
  assert.doesNotMatch(dockerfile, /COPY \. \./);
  assert.doesNotMatch(dockerfile, /\nRUN npm ci\s*\n/);
});

test('runtime image contains only API runtime source and the pinned tsx tool', () => {
  assert.match(dockerfile, /tsx@4\.19\.2/);
  assert.match(dockerfile, /COPY apps\/api\/src \.\/apps\/api\/src/);
  assert.match(dockerfile, /COPY packages\/db\/migrations \.\/packages\/db\/migrations/);
  assert.match(dockerfile, /COPY spec\/glossary\.json \.\/spec\/glossary\.json/);
  assert.match(dockerfile, /COPY spec\/font-subsets\.json \.\/spec\/font-subsets\.json/);
  assert.match(dockerfile, /COPY spec\/strings\.ko\.json \.\/spec\/strings\.ko\.json/);
  assert.match(dockerfile, /CMD \["\/opt\/tsx\/node_modules\/\.bin\/tsx", "apps\/api\/src\/index\.ts"\]/);
  assert.doesNotMatch(dockerfile, /COPY apps\/mobile/);
  assert.doesNotMatch(dockerfile, /COPY apps\/web/);
  assert.doesNotMatch(dockerfile, /COPY packages\/ui/);
});

test('Docker context excludes frontend, docs, tests and local build debris', () => {
  for (const entry of ['apps/mobile', 'apps/web', 'packages/ui', 'docs', 'spec/*', 'scripts', '**/node_modules']) {
    assert.ok(dockerignore.split(/\r?\n/).includes(entry), 'missing dockerignore entry: ' + entry);
  }
  assert.match(dockerignore, /^\*\*\/\*\.test\.ts$/m);
  assert.match(dockerignore, /^\*\*\/\*\.test\.tsx$/m);
  for (const file of ['!spec/glossary.json', '!spec/font-subsets.json', '!spec/strings.ko.json']) {
    assert.ok(dockerignore.split(/\r?\n/).includes(file), 'missing runtime spec include: ' + file);
  }
});

test('Kakao worker uses the same minimal tsx runtime instead of API devDependencies', () => {
  assert.match(worker, /"\$IMAGE" \/opt\/tsx\/node_modules\/\.bin\/tsx apps\/api\/src\/worker\.ts/);
  assert.doesNotMatch(worker, /"\$IMAGE" npm run worker/);
});
