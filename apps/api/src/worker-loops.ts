import { RETENTION_POLICY } from '@weddingpick/domain';
import type { Pool } from 'pg';

import { createGeminiAnalyzer } from './analysis/gemini-analyzer';
import { runForever } from './analysis/worker';
import { createGeminiFeedWriter } from './analysis/wedding-feed-writer';
import type { Config } from './config';
import { createGeminiExpoDiscoverer, runExpoCollection } from './expo-collector';
import { createExpoPush } from './push/expo';
import { sendPriceChangeNudges, sendTaskNudges } from './notify/nudges';
import { alertOperators } from './retention/alert';
import { sweepExpiredConsultationAudio } from './retention/consultation-audio';
import { sweepEndedExpos } from './retention/expo-sweep';
import { listRetentionAttention, sweepExpiredDocuments } from './retention/worker';
import type { Storage } from './storage/port';
import { completeWithdrawals } from './withdrawal';
import { runGeneration as runWeddingFeedGeneration } from './wedding-feed';

const RETENTION_SWEEP_MS = 10 * 60 * 1000;

/** 종료 박람회 정리는 하루 1회면 충분하다(`docs/expo-agent-spec.md` 21절 권장 주기). */
const EXPO_SWEEP_MS = 24 * 60 * 60 * 1000;
/** 신규 박람회 탐색·검증도 정본 권장대로 하루 1회. */
const EXPO_COLLECTION_MS = 24 * 60 * 60 * 1000;

/*
 * 사용자 알림은 자주 볼 필요가 없다. 일정 알림은 하루 단위이고, 가격 변동은
 * 하루 한 번까지다 — 10분마다 도는 파기 정리에 얹으면 같은 질의를 하루 144번
 * 하게 된다.
 */
const NUDGE_MS = 60 * 60 * 1000;

/*
 * 웨딩피드 자동 작성도 급하지 않다 — 목표(공개 8건)를 채우는 것이 목적이지 실시간
 * 발행이 아니다. 알림과 같은 한 시간 간격을 쓴다. `shouldGenerate`가 매번 다시
 * 봐서, 이미 목표를 채웠거나 초안이 쌓여 있으면 아무것도 쓰지 않고 지나간다.
 */
const WEDDING_FEED_MS = 60 * 60 * 1000;

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
 * 원래는 워커 프로세스 하나뿐이었는데 독립 워커가 운영에 배포되지 않은 기간이 있어,
 * 처리방침이 약속한 24시간
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

  console.log(
    config.expoAutoDeleteEnabled
      ? '박람회 종료 자동 삭제: 켜짐 — 하루 1회 종료된 박람회를 지운다.'
      : '박람회 종료 자동 삭제: 꺼짐(기본값) — EXPO_AUTO_DELETE_ENABLED=true로 켠다. ' +
          '몇 건이 지워질지는 `npm run expo-cleanup -- --dry-run`으로 미리 볼 수 있다.'
  );

  /*
   * 종료 박람회 자동 삭제(사양 15절). **되돌릴 수 없어 기본값이 꺼짐이다** —
   * 운영에서 처음 켜는 것은 대표님 판단이고, 이 워커가 스스로 켜지 않는다.
   *
   * 신규 수집 루프보다 먼저 돌아야 한다(사양 21절 "종료 행사 정리를 신규 수집보다
   * 먼저 실행한다") — 아직 자동 수집 루프가 없어 순서를 다툴 상대가 없지만, 나중에
   * 수집 루프를 붙일 때 이 정리를 그 앞에 둔다.
   */
  const expoSweep = config.expoAutoDeleteEnabled
    ? setInterval(() => {
        void sweepEndedExpos(pool)
          .then((result) => {
            if (result.deleted > 0) {
              console.log(`종료된 박람회 ${result.deleted}건을 지웠다.`);
            }
          })
          .catch((error) => {
            console.error('박람회 종료 정리 실패:', error);
          });
      }, EXPO_SWEEP_MS)
    : null;

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
         * 상담 녹음은 **두 모드 모두에서 지운다.**
         *
         * `manual` 모드가 있는 이유는 문서에 **사람이 보는 과정**이 붙어 있기
         * 때문이다 — 인증 심사가 끝나야 기한이 정해진다. 상담 녹음에는 그 과정이
         * 없고, 처리방침 제2항이 「업로드 시점부터 24시간을 넘겨 보관하지
         * 않습니다」라고 조건 없이 적었다.
         *
         * 모드를 따르면 운영자가 스위치를 만지는 동안 약속한 기한이 지나고,
         * 그 사실은 아무 화면에도 뜨지 않는다.
         */
        await sweepExpiredConsultationAudio({ pool, storage });

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

  /*
   * 제미나이로 쓴다(2026-09-15 대표 지시 — 「클로드 API는 싹다 전면 폐기하고
   * 제미나이로 명시해」). 모델은 `config.geminiModel`이다 — 분석 워커와 같은
   * 칸을 쓴다. 새 설정 칸을 만들지 않는다.
   *
   * **기본은 꺼짐이다.** `WEDDING_FEED_AUTOWRITE=true`를 넣어야 이 루프가
   * 돈다 — 사람이 안 보는 동안에도 계속 글을 쓰는 자리라, 켜고 끄는 것은
   * 대표님 판단이다. 관리자 화면의 「지금 한 번 쓰기」(`POST
   * /v1/admin/wedding-feed/generate`)는 이 스위치와 무관하게 항상 된다 —
   * 사람이 누를 때만 도는 것이라 켜져 있을 필요가 없다.
   *
   * 이 루프 하나만 try/catch로 감싼다 — 한 바퀴가 실패해도 파기 정리 · 알림까지
   * 멈추면 안 된다.
   */
  /*
   * 제미나이 열쇠. **워커를 띄우는 쪽이 한 번만 읽는다** — 부르는 자리마다
   * `process.env`를 다시 읽으면 어디서 빠졌는지 찾기 어려워진다.
   */
  const geminiApiKey = process.env.GEMINI_API_KEY ?? '';

  const expoCollectionEnabled = process.env.EXPO_COLLECTION_ENABLED !== 'false';
  const collectExpos = async () => {
    if (config.expoAutoDeleteEnabled) {
      await sweepEndedExpos(pool);
    }
    const result = await runExpoCollection({
      pool,
      discover: createGeminiExpoDiscoverer({ apiKey: geminiApiKey, model: config.geminiModel }),
      model: config.geminiModel,
      trigger: 'scheduled',
    });
    if (!result.skipped) {
      console.log(
        `박람회 자동 수집: 발견 ${result.discovered} · 신규 ${result.created} · 업데이트 ${result.updated} · 중복/제외 ${result.duplicates}`
      );
    }
  };

  console.log(
    expoCollectionEnabled && geminiApiKey
      ? '박람회 자동 수집 켜짐 (하루 1회, worker 시작 시에도 최근 성공 여부 확인)'
      : expoCollectionEnabled
        ? '박람회 자동 수집 대기 — GEMINI_API_KEY가 없어 실행하지 않는다.'
        : '박람회 자동 수집 꺼짐 — EXPO_COLLECTION_ENABLED=false'
  );

  if (expoCollectionEnabled && geminiApiKey) {
    void collectExpos().catch((error) => console.error('박람회 자동 수집 실패:', error));
  }
  const expoCollection =
    expoCollectionEnabled && geminiApiKey
      ? setInterval(() => {
          void collectExpos().catch((error) => console.error('박람회 자동 수집 실패:', error));
        }, EXPO_COLLECTION_MS)
      : null;

  const feedAutowrite = process.env.WEDDING_FEED_AUTOWRITE === 'true';

  console.log(
    feedAutowrite
      ? '웨딩피드 자동 작성 켜짐 (한 시간 간격)'
      : '웨딩피드 자동 작성 꺼짐 — 켜려면 WEDDING_FEED_AUTOWRITE=true'
  );

  const feedGeneration = feedAutowrite
    ? setInterval(() => {
        void (async () => {
          try {
            const model = config.geminiModel;

            const result = await runWeddingFeedGeneration({
              pool,
              writer: createGeminiFeedWriter({ apiKey: geminiApiKey, model }),
              model,
              trigger: 'schedule',
            });

            if (result.created > 0) {
              console.log(`웨딩피드 자동 작성 ${result.created}건`);
            }
          } catch (error) {
            console.error('웨딩피드 자동 작성 실패:', error);
          }
        })();
      }, WEDDING_FEED_MS)
    : null;

  controller.signal.addEventListener('abort', () => {
    clearInterval(sweep);
    clearInterval(nudges);
    if (feedGeneration) clearInterval(feedGeneration);
    if (expoSweep) clearInterval(expoSweep);
    if (expoCollection) clearInterval(expoCollection);
  });

  console.log('분석 워커 시작');

  return runForever(
    {
      pool,
      storage,
      analyzer: createGeminiAnalyzer({ apiKey: geminiApiKey, model: config.geminiModel }),
      model: config.geminiModel,
      dailyCallLimit: config.aiDailyCallLimit,
    },
    { signal: controller.signal }
  );
}

