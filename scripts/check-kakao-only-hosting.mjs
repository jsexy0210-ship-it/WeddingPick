#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const fragments = [
  ['on', 'render.com'].join(''),
  ['RENDER', '_'].join(''),
  ['render', '.yaml'].join(''),
  ['render', '-env'].join(''),
  ['render', '-deploy'].join(''),
  ['render', '-region'].join(''),
  ['render', '-pipeline'].join(''),
  ['render', '.com'].join(''),
];
const providerName = ['Ren', 'der'].join('');

export function inspectTrackedFiles(entries) {
  const violations = [];
  for (const { path, content } of entries) {
    if (path === 'scripts/check-kakao-only-hosting.mjs' || path === 'scripts/check-kakao-only-hosting.test.mjs') continue;
    for (const token of fragments) {
      if (content.includes(token)) violations.push({ path, token });
    }
    if (new RegExp('\\b' + providerName + '\\b').test(content)) violations.push({ path, token: providerName });
  }
  return violations;
}

export function checkRepository() {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  const entries = [];
  for (const path of files) {
    try {
      entries.push({ path, content: readFileSync(path, 'utf8') });
    } catch {
      // Binary/non-UTF8 tracked assets are irrelevant to deployment text policy.
    }
  }
  return inspectTrackedFiles(entries);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'))) {
  const violations = checkRepository();
  if (violations.length) {
    for (const v of violations) console.error(`Kakao-only hosting violation: ${v.path} (${v.token})`);
    process.exit(1);
  }
  console.log('Kakao-only hosting policy OK');
}
