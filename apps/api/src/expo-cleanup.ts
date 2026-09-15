import { loadConfig } from './config';
import { createPool } from './db';
import { listExposDueForDeletion, sweepEndedExpos } from './retention/expo-sweep';

/**
 * 종료 박람회 자동 삭제를 손으로 돌리는 CLI. `docs/expo-agent-spec.md` 15절.
 *
 * **되돌릴 수 없는 삭제다.** `--dry-run`으로 몇 건이 지워질지 먼저 세어 보고,
 * 실제로 지우려면 `--yes`를 붙인다.
 *
 *   npm run expo-cleanup --workspace @weddingpick/api -- --dry-run
 *   npm run expo-cleanup --workspace @weddingpick/api -- --yes
 *
 * 정기 실행은 `EXPO_AUTO_DELETE_ENABLED=true`일 때 `worker-loops.ts`가 하루 한 번
 * 대신 돌린다(기본은 꺼짐 — 운영에서 처음 켜는 것은 대표님 판단이다).
 */

function argv(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main(): Promise<void> {
  const dryRun = argv('dry-run');
  const yes = argv('yes');

  if (!dryRun && !yes) {
    console.error(
      '종료 박람회를 지운다. 몇 건이 지워질지 먼저 보려면 --dry-run, 실제로 지우려면 --yes를 붙일 것.\n' +
        '  npm run expo-cleanup --workspace @weddingpick/api -- --dry-run\n' +
        '  npm run expo-cleanup --workspace @weddingpick/api -- --yes'
    );
    process.exitCode = 1;
    return;
  }

  const pool = createPool(loadConfig().databaseUrl);

  try {
    if (dryRun) {
      const due = await listExposDueForDeletion(pool);
      console.log(`지워질 박람회 ${due.length}건`);
      for (const expo of due) {
        console.log(`  ${expo.title} · ${expo.startsAt} ~ ${expo.endsAt} · ${expo.venue}`);
      }
      return;
    }

    const result = await sweepEndedExpos(pool);
    console.log(`${result.deleted}건을 지웠다.`);
  } finally {
    await pool.end();
  }
}

void main();
