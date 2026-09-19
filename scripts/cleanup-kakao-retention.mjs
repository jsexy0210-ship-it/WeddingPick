#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  DEFAULT_RETAIN,
  DEFAULT_ROOT,
  buildAudit,
  collectNginxBackups,
  collectRecoveryContainers,
  recoveryFamily,
} from './audit-kakao-retention.mjs';

export function candidateRows(audit) {
  return {
    containers: audit.containers.filter((item) => item.disposition === 'CANDIDATE'),
    backups: audit.backups.filter((item) => item.disposition === 'CANDIDATE'),
  };
}

export function candidateKeys(audit) {
  const rows = candidateRows(audit);
  return [
    ...rows.containers.map((item) => `container:${item.name}`),
    ...rows.backups.map((item) => `backup:${resolve(item.path)}`),
  ].sort();
}

function parseRetain() {
  const retain = Number(process.env.WEDDINGPICK_RETENTION_KEEP || DEFAULT_RETAIN);
  if (!Number.isInteger(retain) || retain < 1 || retain > 20) {
    throw new Error('WEDDINGPICK_RETENTION_KEEP must be an integer between 1 and 20');
  }
  return retain;
}

function collectAudit(root, retain) {
  const recovery = collectRecoveryContainers(root);
  const backups = collectNginxBackups(root);
  return buildAudit({
    containers: recovery.containers,
    protectedContainerNames: recovery.protectedNames,
    backupFiles: backups.files,
    protectedBackupPaths: backups.protectedPaths,
    retain,
  });
}

function diskUsage(root) {
  return execFileSync('df', ['-Pk', root], { encoding: 'utf8' }).trim().split(/\r?\n/).at(-1) ?? '';
}

function printPlan(label, root, audit) {
  const rows = candidateRows(audit);
  const retainedContainers = audit.containers.filter((item) => item.disposition === 'KEEP').length;
  const retainedBackups = audit.backups.filter((item) => item.disposition === 'KEEP').length;

  console.log(`${label}-disk=${diskUsage(root)}`);
  console.log(`${label}-retained-containers=${retainedContainers}`);
  console.log(`${label}-retained-backups=${retainedBackups}`);
  console.log(`${label}-candidate-containers=${rows.containers.length}`);
  console.log(`${label}-candidate-backups=${rows.backups.length}`);
  for (const item of rows.containers) console.log(`CANDIDATE container ${item.name}`);
  for (const item of rows.backups) console.log(`CANDIDATE backup ${item.path}`);
}

function assertBackupInsideRoot(root, path) {
  const backupRoot = resolve(root, 'nginx-backups');
  const target = resolve(path);
  const rel = relative(backupRoot, target);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Refusing backup path outside nginx-backups: ${target}`);
  }
  return target;
}

function assertStillCandidate(root, retain, kind, key) {
  const fresh = candidateRows(collectAudit(root, retain));
  const found = kind === 'container'
    ? fresh.containers.some((item) => item.name === key)
    : fresh.backups.some((item) => resolve(item.path) === resolve(key));
  if (!found) throw new Error(`Retention state changed; refusing to delete ${kind} ${key}`);
}

function removeContainer(root, retain, name) {
  if (!recoveryFamily(name)) throw new Error(`Refusing unknown recovery container family: ${name}`);
  assertStillCandidate(root, retain, 'container', name);
  execFileSync('sudo', ['-n', 'docker', 'rm', name], { stdio: 'inherit' });
}

function removeBackup(root, retain, path) {
  const target = assertBackupInsideRoot(root, path);
  assertStillCandidate(root, retain, 'backup', target);
  rmSync(target);
}

export function requireApplyApproval(apply, env = process.env) {
  if (!apply) return;
  if (env.WP_RETENTION_APPROVED !== '1') {
    throw new Error('Apply mode requires WP_RETENTION_APPROVED=1 from the production-approved workflow');
  }
}

function main() {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => arg !== '--apply');
  if (unknown.length) throw new Error(`Unknown argument: ${unknown.join(', ')}`);

  const apply = args.includes('--apply');
  requireApplyApproval(apply);

  const root = process.env.WEDDINGPICK_ROOT || DEFAULT_ROOT;
  const retain = parseRetain();
  const before = collectAudit(root, retain);
  const plannedKeys = candidateKeys(before);

  console.log(`mode=${apply ? 'apply' : 'dry-run'}`);
  console.log(`root=${root}`);
  console.log(`retain=${retain}`);
  printPlan('before', root, before);

  if (!apply) {
    console.log('dry-run only: no containers, images, markers, or files were deleted');
    return;
  }

  // 승인 대기 중 상태가 바뀌었으면 전체 계획을 폐기한다.
  const approved = collectAudit(root, retain);
  const approvedKeys = candidateKeys(approved);
  if (JSON.stringify(plannedKeys) !== JSON.stringify(approvedKeys)) {
    throw new Error('Retention candidate set changed before apply; rerun dry-run and approve again');
  }

  const rows = candidateRows(approved);
  for (const item of rows.containers) removeContainer(root, retain, item.name);
  for (const item of rows.backups) removeBackup(root, retain, item.path);

  const after = collectAudit(root, retain);
  printPlan('after', root, after);
  console.log('cleanup=ok');
  console.log('Docker images, running containers, markers, databases, and object storage were not modified.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
