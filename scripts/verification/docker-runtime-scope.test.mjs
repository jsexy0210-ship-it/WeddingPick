import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const dockerfile = readFileSync(resolve(root, 'Dockerfile'), 'utf8');
const dockerignore = readFileSync(resolve(root, '.dockerignore'), 'utf8');
const worker = readFileSync(resolve(root, 'scripts/update-kakao-worker.sh'), 'utf8');
const deploy = readFileSync(resolve(root, '.github/workflows/deploy-kakao-api.yml'), 'utf8');

function sourceFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path));
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) files.push(path);
  }
  return files;
}

test('production image installs only API production workspace dependencies', () => {
  assert.match(dockerfile, /FROM node:22-alpine AS runtime-deps/);
  assert.match(dockerfile, /npm ci[\s\\]+--omit=dev[\s\\]+--workspace @weddingpick\/api[\s\\]+--include-workspace-root=false/);
  assert.doesNotMatch(dockerfile, /COPY \. \./);
  assert.doesNotMatch(dockerfile, /\nRUN npm ci\s*\n/);
});

test('active API and worker runtimes exclude ffmpeg while the dormant media target preserves it', () => {
  assert.match(dockerfile, /tsx@4\.19\.2/);
  assert.match(dockerfile, /FROM node:22-alpine AS runtime-base/);
  assert.match(dockerfile, /COPY apps\/api\/src \.\/apps\/api\/src/);
  assert.match(dockerfile, /COPY packages\/db\/migrations \.\/packages\/db\/migrations/);
  assert.match(dockerfile, /COPY spec\/glossary\.json \.\/spec\/glossary\.json/);
  assert.match(dockerfile, /COPY spec\/font-subsets\.json \.\/spec\/font-subsets\.json/);
  assert.match(dockerfile, /COPY spec\/strings\.ko\.json \.\/spec\/strings\.ko\.json/);

  const workerStart = dockerfile.indexOf('FROM runtime-base AS worker-runtime');
  const mediaStart = dockerfile.indexOf('FROM runtime-base AS media-worker-runtime');
  const apiStart = dockerfile.indexOf('FROM runtime-base AS runtime');
  assert.ok(workerStart >= 0 && mediaStart > workerStart && apiStart > mediaStart);

  const workerStage = dockerfile.slice(workerStart, mediaStart);
  const mediaStage = dockerfile.slice(mediaStart, apiStart);
  const apiStage = dockerfile.slice(apiStart);
  assert.doesNotMatch(workerStage, /apk add .*ffmpeg/);
  assert.match(workerStage, /CMD \["\/opt\/tsx\/node_modules\/\.bin\/tsx", "apps\/api\/src\/worker\.ts"\]/);
  assert.match(mediaStage, /RUN apk add --no-cache ffmpeg/);
  assert.doesNotMatch(apiStage, /apk add .*ffmpeg/);
  assert.match(apiStage, /CMD \["\/opt\/tsx\/node_modules\/\.bin\/tsx", "apps\/api\/src\/index\.ts"\]/);

  assert.doesNotMatch(dockerfile, /COPY apps\/mobile/);
  assert.doesNotMatch(dockerfile, /COPY apps\/web/);
  assert.doesNotMatch(dockerfile, /COPY packages\/ui/);
});

test('ffmpeg-backed consultation reader is not reachable from current production source modules', () => {
  const apiRoot = resolve(root, 'apps/api/src');
  const allowed = new Set([
    'analysis/audio-clip.ts',
    'analysis/consultation-reader.ts',
  ]);
  const offenders = [];

  for (const file of sourceFiles(apiRoot)) {
    const path = relative(apiRoot, file).replaceAll('\\', '/');
    if (allowed.has(path) || /(?:^|\/)(?:test|__tests__)(?:\/|$)/.test(path) || /\.test\.[tj]sx?$/.test(path)) continue;
    const source = readFileSync(file, 'utf8');
    if (/consultation-reader|audio-clip/.test(source)) offenders.push(path);
  }

  assert.deepEqual(
    offenders,
    [],
    'ffmpeg-backed consultation code entered an active source module; use media-worker-runtime or restore ffmpeg to production runtime',
  );
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

test('Kakao deploy builds the ffmpeg-free worker target separately and hands it to worker cutover', () => {
  assert.match(deploy, /WORKER_IMAGE="weddingpick-worker:\$\{GITHUB_SHA\}"/);
  assert.match(deploy, /docker build --target worker-runtime[^\n]*-t "\$WORKER_IMAGE"/);
  assert.match(deploy, /bash scripts\/update-kakao-worker\.sh "\$WORKER_IMAGE"/);
  assert.doesNotMatch(deploy, /media-worker-runtime/);
});

test('Kakao worker still uses the pinned tsx runtime instead of API devDependencies', () => {
  assert.match(worker, /"\$IMAGE" \/opt\/tsx\/node_modules\/\.bin\/tsx apps\/api\/src\/worker\.ts/);
  assert.doesNotMatch(worker, /"\$IMAGE" npm run worker/);
});
