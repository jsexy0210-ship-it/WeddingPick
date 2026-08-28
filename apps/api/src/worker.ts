import { RETENTION_POLICY } from '@weddingpick/domain';

import { createClaudeAnalyzer } from './analysis/claude-analyzer';
import { runForever } from './analysis/worker';
import { loadConfig } from './config';
import { createPool } from './db';
import { createExpoPush } from './push/expo';
import { alertOperators } from './retention/alert';
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

  console.log(
    `원본 보관: 검증이 끝난 날로부터 ${RETENTION_POLICY.originalDays}일` +
      (config.retentionMode === 'automatic'
        ? ' 후 자동삭제'
        : ' 후 파기 예정. 지우는 것은 사람이 하고, 서버는 운영자에게 알린다.')
  );

  /*
   * 보관 정리는 자주 볼 필요가 없다. 분석 루프와 나란히 돌린다.
   *
   * 한 바퀴 돌 때마다 손이 필요한 문서가 있는지 함께 본다 — 서비스정책서 4번이
   * 요구하는 "알림"이다. 실패가 조용히 쌓이면 개인정보가 보관 기간을 넘겨
   * 남아 있는데 아무도 모르는 상태가 된다. 그래서 있으면 매번 말한다.
   * 시끄러운 편이 낫다.
   */
  const push = createExpoPush();

  const sweep = setInterval(() => {
    void (async () => {
      try {
        /*
         * manual 모드에서는 아무것도 지우지 않는다. 예정일이 됐다고 알리기만
         * 하고, 지우는 것은 사람이 한다.
         */
        if (config.retentionMode === 'automatic') {
          await sweepExpiredDocuments({ pool, storage });
        }

        /*
         * 알림은 두 모드 모두에서 돈다. 심사 적체는 삭제 방식과 무관하고,
         * 자동 모드에서 파기 알림이 뜬다면 그건 청소가 실패하고 있다는 뜻이라
         * 오히려 알아야 한다.
         */
        const alerts = await alertOperators({
          pool,
          push,
          reminderAfterHours: config.retentionReminderHours,
        });

        for (const [kind, result] of Object.entries(alerts)) {
          if (result.dueCount === 0) continue;

          const what =
            kind === 'retention_due'
              ? { label: '파기 예정 원본', how: 'npm run retention -- --due' }
              : { label: '밀린 인증 심사', how: 'npm run verifications -- --backlog' };

          if (result.notified === 0) {
            // 알릴 사람이 없으면 알림은 없는 것과 같다. 조용히 넘어가면
            // 아무도 모르는 채 개인정보가 쌓인다.
            console.error(
              `${what.label} ${result.dueCount}건 — 알릴 운영자가 없거나 이미 알렸다. ${what.how}`
            );
          } else if (result.delivered === 0) {
            console.error(
              `${what.label} ${result.dueCount}건을 알렸으나 어떤 기기에도 닿지 않았다. ` +
                '운영자 기기가 등록되어 있는지 확인할 것.'
            );
          }
        }

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
