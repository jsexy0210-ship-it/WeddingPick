import { createClaudeAnalyzer } from './analysis/claude-analyzer';
import { runForever } from './analysis/worker';
import { loadConfig } from './config';
import { createPool } from './db';
import { sweepExpiredDocuments } from './retention/worker';
import { createLocalStorage } from './storage/local';
import { createS3Storage } from './storage/s3';

const RETENTION_SWEEP_MS = 10 * 60 * 1000;

async function main() {
  const config = loadConfig();
  const controller = new AbortController();

  process.on('SIGTERM', () => controller.abort());
  process.on('SIGINT', () => controller.abort());

  const pool = createPool(config.databaseUrl);
  const storage =
    config.storage.driver === 's3' ? createS3Storage(config.storage) : createLocalStorage();

  if (config.originalRetentionDays) {
    console.log(`원본 보관 ${config.originalRetentionDays}일 후 자동삭제`);
  } else {
    console.warn(
      'ORIGINAL_RETENTION_DAYS가 없어 원본을 자동삭제하지 않는다. 보관 기간을 정한 뒤 설정할 것.'
    );
  }

  // 보관 정리는 자주 볼 필요가 없다. 분석 루프와 나란히 돌린다.
  const sweep = setInterval(() => {
    sweepExpiredDocuments({ pool, storage }).catch((error: Error) => {
      console.error('보관 정리 실패:', error);
    });
  }, RETENTION_SWEEP_MS);

  controller.signal.addEventListener('abort', () => clearInterval(sweep));

  console.log('분석 워커 시작');

  await runForever(
    {
      pool,
      storage,
      analyzer: createClaudeAnalyzer({ model: process.env.ANALYSIS_MODEL }),
    },
    { signal: controller.signal }
  );
}

main().catch((error: Error) => {
  console.error(error);
  process.exit(1);
});
