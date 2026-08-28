import { createClaudeAnalyzer } from './analysis/claude-analyzer';
import { runForever } from './analysis/worker';
import { loadConfig } from './config';
import { createPool } from './db';
import { createLocalStorage } from './storage/local';
import { createS3Storage } from './storage/s3';

async function main() {
  const config = loadConfig();
  const controller = new AbortController();

  process.on('SIGTERM', () => controller.abort());
  process.on('SIGINT', () => controller.abort());

  console.log('분석 워커 시작');

  await runForever(
    {
      pool: createPool(config.databaseUrl),
      storage:
        config.storage.driver === 's3' ? createS3Storage(config.storage) : createLocalStorage(),
      analyzer: createClaudeAnalyzer({ model: process.env.ANALYSIS_MODEL }),
    },
    { signal: controller.signal }
  );
}

main().catch((error: Error) => {
  console.error(error);
  process.exit(1);
});
