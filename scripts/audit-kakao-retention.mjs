#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_ROOT = '/home/ubuntu/WeddingPick';
const DEFAULT_RETAIN = 3;

export function recoveryFamily(name) {
  if (/^weddingpick-api-previous-/.test(name)) return 'api';
  if (/^weddingpick-worker-previous-/.test(name)) return 'worker';
  if (/^weddingpick-api-cors-previous-/.test(name)) return 'api-cors';
  return null;
}

export function classifyRetention(items, { retain = DEFAULT_RETAIN, protectedNames = new Set() } = {}) {
  const groups = new Map();
  for (const item of items) {
    const family = item.family ?? recoveryFamily(item.name);
    if (!family) continue;
    const group = groups.get(family) ?? [];
    group.push({ ...item, family });
    groups.set(family, group);
  }

  const result = [];
  for (const family of [...groups.keys()].sort()) {
    const group = groups.get(family).sort((a, b) => {
      const timeDiff = Number(b.timestamp ?? 0) - Number(a.timestamp ?? 0);
      return timeDiff || a.name.localeCompare(b.name);
    });
    let recentCount = 0;
    for (const item of group) {
      const protectedByMarker = protectedNames.has(item.name);
      const running = item.running === true;
      const recent = !protectedByMarker && !running && recentCount < retain;
      if (recent) recentCount += 1;
      result.push({
        ...item,
        disposition: protectedByMarker || running || recent ? 'KEEP' : 'CANDIDATE',
        reason: protectedByMarker
          ? 'referenced-by-marker'
          : running
            ? 'running'
            : recent
              ? `recent-${retain}`
              : 'older-than-retention',
      });
    }
  }
  return result;
}

export function parseMarkerValue(content, key) {
  const values = {};
  for (const raw of String(content ?? '').split(/\r?\n/)) {
    const index = raw.indexOf('=');
    if (index <= 0) continue;
    values[raw.slice(0, index).trim()] = raw.slice(index + 1).trim();
  }
  return values[key] || null;
}

export function parseCorsMarker(content) {
  return parseMarkerValue(content, 'container');
}

export function classifyBackups(files, { retain = DEFAULT_RETAIN, protectedPaths = new Set() } = {}) {
  const groups = new Map();
  for (const file of files) {
    const prefix = file.name.replace(/-\d{8}T\d{6}Z\.conf$/, '');
    const group = groups.get(prefix) ?? [];
    group.push({ ...file, prefix });
    groups.set(prefix, group);
  }

  const result = [];
  for (const prefix of [...groups.keys()].sort()) {
    const group = groups.get(prefix).sort((a, b) => {
      const timeDiff = Number(b.timestamp ?? 0) - Number(a.timestamp ?? 0);
      return timeDiff || a.name.localeCompare(b.name);
    });
    let recentCount = 0;
    for (const file of group) {
      const protectedByMarker = protectedPaths.has(resolve(file.path));
      const recent = !protectedByMarker && recentCount < retain;
      if (recent) recentCount += 1;
      result.push({
        ...file,
        disposition: protectedByMarker || recent ? 'KEEP' : 'CANDIDATE',
        reason: protectedByMarker ? 'referenced-by-marker' : recent ? `recent-${retain}` : 'older-than-retention',
      });
    }
  }
  return result;
}

function readMarker(root, name) {
  const path = join(root, name);
  if (!existsSync(path)) return null;
  const value = readFileSync(path, 'utf8').trim();
  return value || null;
}

function dockerContainers() {
  const output = execFileSync(
    'sudo',
    ['-n', 'docker', 'ps', '-a', '--format', '{{json .}}'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return output.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}

function collectRecoveryContainers(root) {
  const protectedNames = new Set();
  const corsMarker = readMarker(root, '.cors-cutover-backup');
  const corsContainer = parseCorsMarker(corsMarker);
  if (corsContainer) protectedNames.add(corsContainer);

  const containers = dockerContainers()
    .map(row => {
      const name = row.Names ?? row.Name ?? '';
      const family = recoveryFamily(name);
      if (!family) return null;
      const created = Date.parse(row.CreatedAt ?? '') || 0;
      const state = String(row.State ?? row.Status ?? '').toLowerCase();
      return {
        name,
        family,
        timestamp: created,
        running: state === 'running' || state.startsWith('up '),
        image: row.Image ?? '',
        status: row.Status ?? row.State ?? '',
      };
    })
    .filter(Boolean);

  return { containers, protectedNames };
}

function collectNginxBackups(root) {
  const dir = join(root, 'nginx-backups');
  const protectedPaths = new Set();

  for (const markerName of [
    '.app-web-cutover-backup',
    '.weddingpick-static-sites-backup',
    '.preview-routes-backup',
    '.static-port-probe-backup',
  ]) {
    const marker = readMarker(root, markerName);
    if (marker && marker !== 'NONE') protectedPaths.add(resolve(marker));
  }

  const appWebUpdateMarker = readMarker(root, '.app-web-update-backup');
  const appWebUpdateBackup = parseMarkerValue(appWebUpdateMarker, 'config');
  if (appWebUpdateBackup && appWebUpdateBackup !== 'NONE') {
    protectedPaths.add(resolve(appWebUpdateBackup));
  }

  if (!existsSync(dir)) return { files: [], protectedPaths };

  const files = readdirSync(dir)
    .filter(name => name.endsWith('.conf'))
    .map(name => {
      const path = join(dir, name);
      const stat = statSync(path);
      return { name, path, timestamp: stat.mtimeMs, size: stat.size };
    });

  return { files, protectedPaths };
}

function printSection(title, rows) {
  console.log(`#### ${title}`);
  if (!rows.length) {
    console.log('- none');
    return;
  }
  for (const row of rows) {
    const extra = row.image ? ` | image=${row.image}` : row.size != null ? ` | bytes=${row.size}` : '';
    console.log(`- ${row.disposition} | ${row.name} | ${row.reason}${extra}`);
  }
}

export function buildAudit({ containers, protectedContainerNames, backupFiles, protectedBackupPaths, retain = DEFAULT_RETAIN }) {
  return {
    containers: classifyRetention(containers, { retain, protectedNames: protectedContainerNames }),
    backups: classifyBackups(backupFiles, { retain, protectedPaths: protectedBackupPaths }),
  };
}

function main() {
  const root = process.env.WEDDINGPICK_ROOT || DEFAULT_ROOT;
  const retain = Number(process.env.WEDDINGPICK_RETENTION_KEEP || DEFAULT_RETAIN);
  if (!Number.isInteger(retain) || retain < 1 || retain > 20) {
    throw new Error('WEDDINGPICK_RETENTION_KEEP must be an integer between 1 and 20');
  }

  const recovery = collectRecoveryContainers(root);
  const backups = collectNginxBackups(root);
  const audit = buildAudit({
    containers: recovery.containers,
    protectedContainerNames: recovery.protectedNames,
    backupFiles: backups.files,
    protectedBackupPaths: backups.protectedPaths,
    retain,
  });

  console.log('Kakao retention audit (READ-ONLY)');
  console.log(`root=${root}`);
  console.log(`retain=${retain}`);
  console.log('No containers, images, markers, or files are deleted by this command.');
  printSection('Recovery containers', audit.containers);
  printSection('Nginx backups', audit.backups);

  const candidates = [...audit.containers, ...audit.backups].filter(item => item.disposition === 'CANDIDATE');
  console.log('');
  console.log(`candidate-count=${candidates.length}`);
  console.log('Deletion requires a separate production-approved manual workflow; this audit never deletes.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
