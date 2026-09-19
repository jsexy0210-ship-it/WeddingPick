import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { infraRegressionTests } from './infra-transactions.test-list.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const verificationDir = join(repoRoot, 'scripts', 'verification');

const discoveryPattern = /(rollback|cutover|transaction).*\.test\.mjs$/;

const discovered = readdirSync(verificationDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && discoveryPattern.test(entry.name))
  .map((entry) => `scripts/verification/${entry.name}`)
  .sort();

const classified = [
  ...infraRegressionTests.transaction,
  ...infraRegressionTests.source,
].sort();

const duplicates = classified.filter(
  (file, index) => classified.indexOf(file) !== index,
);
const unclassified = discovered.filter((file) => !classified.includes(file));
const stale = classified.filter((file) => !discovered.includes(file));
const missingFiles = classified.filter((file) => !existsSync(join(repoRoot, file)));

if (duplicates.length || unclassified.length || stale.length || missingFiles.length) {
  console.error('[infra-regression] manifest mismatch');

  if (duplicates.length) {
    console.error('  duplicate entries:');
    for (const file of [...new Set(duplicates)]) console.error(`    - ${file}`);
  }

  if (unclassified.length) {
    console.error('  discovered but not classified:');
    for (const file of unclassified) console.error(`    - ${file}`);
  }

  if (stale.length) {
    console.error('  classified but not matched by the naming rule:');
    for (const file of stale) console.error(`    - ${file}`);
  }

  if (missingFiles.length) {
    console.error('  classified but missing from the checkout:');
    for (const file of missingFiles) console.error(`    - ${file}`);
  }

  process.exit(1);
}

function runGroup(label, files) {
  if (!files.length) {
    console.log(`[infra-regression] ${label}: no tests on this revision`);
    return;
  }

  console.log(`[infra-regression] ${label}: ${files.length} file(s)`);
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.platform === 'win32') {
  console.log(
    '[infra-regression] transaction: skipped on Windows; GitHub ubuntu CI is authoritative for shell/mock transaction tests',
  );
} else {
  runGroup('transaction', infraRegressionTests.transaction);
}

runGroup('source', infraRegressionTests.source);
