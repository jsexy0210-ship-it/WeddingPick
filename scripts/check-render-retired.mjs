#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// These entry points are retired, not temporarily disabled. Git history retains their contents.
export const retiredPaths = [
  '.github/workflows/render-env-sync.yml',
  '.github/workflows/render-trigger-deploy.yml',
  '.github/workflows/render-deploy-status.yml',
  '.github/workflows/keep-warm.yml',
  'scripts/render-env-sync.py',
  'scripts/render-trigger-deploy.py',
  'scripts/render-deploy-status.py',
  'scripts/test-render-env-sync.py',
  'render.yaml',
  'infra/render-env.yml',
];

const policyFiles = new Set([
  'scripts/check-render-retired.mjs',
  'scripts/check-render-retired.test.mjs',
]);

function runtimeFile(path) {
  if (policyFiles.has(path) || /(?:^|\/)(?:test|tests|__tests__)\//.test(path)
      || /(?:\.test\.|\.spec\.|\/test-)/.test(path)) return false;
  return path === 'package.json' || path === 'apps/mobile/eas.json' || (
    /^(?:\.github\/workflows\/|scripts\/|apps\/api\/src\/|apps\/mobile\/src\/)/.test(path)
    && /\.(?:ya?ml|[cm]?js|py|tsx?|json|sh)$/.test(path)
  );
}

export function inspectDeploymentFiles(files) {
  const violations = [];
  for (const { path, content } of files) {
    if (retiredPaths.includes(path)) {
      violations.push(`${path}: retired deployment entry point exists`);
      continue;
    }
    if (!runtimeFile(path)) continue;
    const active = content.split('\n').filter(line => !/^\s*(?:#|\/\/|\*|\/\*)/.test(line)).join('\n');
    if (/\bapi\.render\.com\b/i.test(active)
        || /\bRENDER_(?:API_KEY|WEB_DEPLOY_HOOK)\b/.test(active)
        || /(?:scripts\/render-(?:env-sync|trigger-deploy|deploy-status)\.py|infra\/render-env\.yml)/.test(active)) {
      violations.push(`${path}: retired Render deployment dependency`);
    }
    if (/https:\/\/weddingpickl-sg\.onrender\.com/.test(active)) {
      violations.push(`${path}: obsolete Render API default`);
    }
    if (path.startsWith('apps/mobile/src/') && active.includes('/v1/admin/site-meta/publish')) {
      violations.push(`${path}: retired site publication action`);
    }
  }
  return violations;
}

export function checkRepository(root = process.cwd()) {
  const paths = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const files = paths.filter(path => retiredPaths.includes(path) || runtimeFile(path))
    .map(path => ({ path, content: readFileSync(resolve(root, path), 'utf8') }));
  return inspectDeploymentFiles(files);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const failures = checkRepository();
    for (const failure of failures) console.error(failure);
    if (failures.length) process.exitCode = 1;
    else console.log('Deployment policy OK: no active Render deployment entry points.');
  } catch {
    console.error('Deployment policy check could not inspect tracked source files.');
    process.exitCode = 1;
  }
}
