import { RETENTION_POLICY } from '@weddingpick/domain';
import type { Pool } from 'pg';

import { createClaudeAnalyzer } from './analysis/claude-analyzer';
import { runForever } from './analysis/worker';
import type { Config } from './config';
import { createExpoPush } from './push/expo';
import { sendPriceChangeNudges, sendTaskNudges } from './notify/nudges';
import { alertOperators } from './retention/alert';
import { listRetentionAttention, sweepExpiredDocuments } from './retention/worker';
import type { Storage } from './storage/port';
import { completeWithdrawals } from './withdrawal';

const RETENTION_SWEEP_MS = 10 * 60 * 1000;

/*
 * 사용자 알림은 자주 볼 필요가 없다. 일정 알림은 하루 단위이고, 가격 변동은
 * 하루 한 번까지다 — 10분마다 도는 파기 정리에 얹으면 같은 질의를 하루 144번
 * 하게 된다.
 */
const NUDGE_MS = 60 * 60 * 1000;

export type WorkerDeps = {
  pool: Pool;
  storage: Storage;
  config: Config;
  /** 멈출 신호. 프로세스가 끝날 때 abort한다. */
  signal: AbortSignal;
};

/**
 * 주기 작업 전부 — 파기 정리 · 알림 · 문서 분석.
 *
 * **독립 프로세스(`worker.ts`)와 API 프로세스(`index.ts`) 둘 다 이 함수를 부른다.**
 * 원래는 워커 프로세스 하나뿐이었는데 그 프로세스가 배포된 적이 없었다 —
 * `render.yaml`에 `type: worker` 서비스가 없어서, 처리방침이 약속한 24시간
 * 자동파기가 한 번도 돌지 않았고 올린 견적서는 «분석 중»에서 나오지 못했다
 * (Release Audit 1차 P0-2 · P0-3, 2026-09-09).
 *
 * 그래서 이미 떠 있는 API 안에서도 돌린다. 두 번 도는 것은 위험하지 않다 —
 * 분석 잡기는 `FOR UPDATE SKIP LOCKED`(analysis/worker.ts `claim`)이고 파기 ·
 * 알림도 처리한 행에 표시를 남기고 지나간다. 워커 서비스를 따로 띄우게 되면
 * API 쪽만 `RUN_WORKER_IN_API=false`로 끄면 된다.
 *
 * 돌려주는 약속은 분석 루프가 끝날 때 끝난다 — API에서는 기다리지 않는다.
 */
export function startWorkerLoops({ pool, storage, config, signal }: WorkerDeps): Promise<void> {
  const controller = { signal };

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

  /*
   * 준비 알림과 가격 변동 알림. v2.0 36·37번.
   *
   * 실패해도 워커를 멈추지 않는다 — 알림이 곁가지라서가 아니라, 여기서 죽으면
   * 파기 정리까지 함께 멈추기 때문이다.
   */
  const nudges = setInterval(() => {
    void (async () => {
      try {
        const tasks = await sendTaskNudges({ pool, push });
        const prices = await sendPriceChangeNudges({ pool, push });

        if (tasks.stored + prices.stored > 0) {
          console.log(
            `알림 ${tasks.stored + prices.stored}건 남김 ` +
              `(일정 ${tasks.stored} · 가격 ${prices.stored}), ` +
              `푸시 ${tasks.pushed + prices.pushed}건 닿음`
          );
        }
      } catch (error) {
        console.error('알림을 보내지 못했다:', error);
      }
    })();
  }, NUDGE_MS);

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
         * 탈퇴하고 원본이 다 지워진 계정을 지운다. **두 모드 모두에서 돈다** —
         * 여기서 지우는 것은 파일이 아니라 계정 행이고, 파일이 하나라도 남아
         * 있으면 `deletable_accounts`에 애초에 뜨지 않는다. 지울 것이 없는데
         * 남겨두면 탈퇴한 사람의 계정만 남는다.
         */
        await completeWithdrawals(pool);

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

  controller.signal.addEventListener('abort', () => {
    clearInterval(sweep);
    clearInterval(nudges);
  });

  console.log('분석 워커 시작');

  return runForever(
    {
      pool,
      storage,
      analyzer: createClaudeAnalyzer({ model: config.analysisModel }),
      model: config.analysisModel,
      dailyCallLimit: config.aiDailyCallLimit,
    },
    { signal: controller.signal }
  );
}

