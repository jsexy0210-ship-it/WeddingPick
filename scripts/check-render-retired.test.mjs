import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { inspectDeploymentFiles, retiredPaths, checkRepository } from './check-render-retired.mjs';

for (const path of retiredPaths) {
  test(`rejects restored entry point: ${path}`, () => {
    assert.equal(inspectDeploymentFiles([{ path, content: '' }]).length, 1);
  });
}

test('rejects Render deploy requests in another workflow', () => {
  assert.equal(inspectDeploymentFiles([{ path: '.github/workflows/other.yml', content: 'run: curl -X POST https://api.render.com/v1/services/test/deploys' }]).length, 1);
});
test('rejects environment sync secrets in another job', () => {
  assert.equal(inspectDeploymentFiles([{ path: '.github/workflows/other.yml', content: 'TOKEN: ${{ secrets.RENDER_API_KEY }}' }]).length, 1);
});
test('rejects the retired application webhook', () => {
  assert.equal(inspectDeploymentFiles([{ path: 'apps/api/src/routes/publish.ts', content: 'const hook = process.env.RENDER_WEB_DEPLOY_HOOK;' }]).length, 1);
});
test('rejects retired script invocation even without credentials', () => {
  assert.equal(inspectDeploymentFiles([{ path: 'package.json', content: '"publish": "python3 scripts/render-trigger-deploy.py"' }]).length, 1);
});
test('rejects the old API as health or APK default', () => {
  assert.equal(inspectDeploymentFiles([{ path: '.github/workflows/api-health.yml', content: 'default: https://weddingpickl-sg.onrender.com' }]).length, 1);
});
test('preserves existing static origins and OAuth callback', () => {
  assert.deepEqual(inspectDeploymentFiles([{ path: '.github/workflows/android-apk.yml', content: 'API: https://210.109.82.212\nWEB: https://weddingpick-app-web.onrender.com\nCALLBACK: https://weddingpickl-sg.onrender.com/v1/auth/naver/callback' }]), []);
});
test('a legacy callback does not hide another obsolete API URL', () => {
  assert.equal(inspectDeploymentFiles([{ path: '.github/workflows/other.yml', content: 'CALLBACK: https://weddingpickl-sg.onrender.com/v1/auth/naver/callback\nAPI: https://weddingpickl-sg.onrender.com' }]).length, 1);
});
test('historical documents, comments and test fixtures are not executable entry points', () => {
  assert.deepEqual(inspectDeploymentFiles([
    { path: 'docs/archive/history.md', content: 'RENDER_API_KEY api.render.com' },
    { path: 'scripts/infra-cost.ts', content: '// RENDER_API_KEY is not used\nconst enabled = false;' },
    { path: 'apps/api/src/test/publish.test.ts', content: 'RENDER_WEB_DEPLOY_HOOK' },
  ]), []);
});
test('rejects an obsolete frontend publication button', () => {
  assert.equal(inspectDeploymentFiles([{ path: 'apps/mobile/src/app/admin/og-card.tsx', content: "apiFetch('/v1/admin/site-meta/publish')" }]).length, 1);
});
test('allows protected Kakao deployment and an explicit retired API response', () => {
  assert.deepEqual(inspectDeploymentFiles([
    { path: '.github/workflows/main.yml', content: 'uses: ./.github/workflows/deploy-kakao-api.yml' },
    { path: 'apps/api/src/routes/site-meta.ts', content: "app.post('/v1/admin/site-meta/publish', auth, async () => { throw new ApiError('conflict', 'deployment retired'); });" },
  ]), []);
});
test('Kakao API revision guard runs before and after candidate build', () => {
  const workflow = readFileSync(
    join(process.cwd(), '.github', 'workflows', 'deploy-kakao-api.yml'),
    'utf8'
  );

  const guardCalls = workflow.match(/^\s+deploy_revision_is_current \|\|/gm) ?? [];
  assert.equal(guardCalls.length, 2);
  assert.doesNotMatch(workflow, /^\s+current_main \|\|/m);
});

test('repository scan does not read untracked secret files', () => {
  const root = mkdtempSync(join(tmpdir(), 'deployment-policy-'));
  try {
    execFileSync('git', ['init', '-q', root]);
    mkdirSync(join(root, 'scripts'));
    writeFileSync(join(root, 'scripts', 'safe.mjs'), 'export const ok = true;');
    writeFileSync(join(root, '.env.kakao-prod'), 'RENDER_API_KEY=must-not-read');
    execFileSync('git', ['add', 'scripts/safe.mjs'], { cwd: root });
    assert.deepEqual(checkRepository(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
