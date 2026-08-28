import { createClaudeAnalyzer } from './analysis/claude-analyzer';
import { runForever } from './analysis/worker';
import { loadConfig } from './config';
import { createPool } from './db';
import { listRetentionAttention, sweepExpiredDocuments } from './retention/worker';
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

  /*
   * 보관 정리는 자주 볼 필요가 없다. 분석 루프와 나란히 돌린다.
   *
   * 한 바퀴 돌 때마다 손이 필요한 문서가 있는지 함께 본다 — 서비스정책서 4번이
   * 요구하는 "알림"이다. 실패가 조용히 쌓이면 개인정보가 보관 기간을 넘겨
   * 남아 있는데 아무도 모르는 상태가 된다. 그래서 있으면 매번 말한다.
   * 시끄러운 편이 낫다.
   */
  const sweep = setInterval(() => {
    void (async () => {
      try {
        await sweepExpiredDocuments({ pool, storage });

        const attention = await listRetentionAttention(pool);

        if (attention.length > 0) {
          const stuck = attention.filter((doc) => doc.reason === 'unreachable').length;

          console.error(
            `보관 기간이 지났는데 남아 있는 원본 ${attention.length}건 — 사람이 처리해야 한다. ` +
              `npm run retention -- --list` +
              (stuck > 0 ? ` (그중 ${stuck}건은 삭제 작업이 집어가지도 못한다)` : '')
          );
        }
      } catch (error) {
        console.error('보관 정리 실패:', error);
      }
    })();
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
