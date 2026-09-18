import { loadConfig } from './config';
import { createPool } from './db';
import { createLocalStorage } from './storage/local';
import { createS3Storage } from './storage/s3';
import { startWorkerLoops } from './worker-loops';

/**
 * 주기 작업 전용 프로세스.
 *
 * 루프 자체는 `worker-loops.ts`에 있다 — API 프로세스도 같은 것을 돌리기
 * 때문이다(`index.ts`). 이 파일은 그 루프에 필요한 것(설정 · DB · 저장소)을
 * 만들어 넘기고 종료 신호를 잇는 껍데기다.
 *
 * 운영에서는 KakaoCloud VM의 별도 `weddingpick-worker` 컨테이너가 이 진입점을
 * 사용한다. API 컨테이너는 `RUN_WORKER_IN_API=false`를 유지해 중복 루프를 막고,
 * API 배포 시 `scripts/update-kakao-worker.sh`가 같은 이미지로 worker를 함께 갱신한다.
 */
async function main() {
  const config = loadConfig();
  const controller = new AbortController();

  process.on('SIGTERM', () => controller.abort());
  process.on('SIGINT', () => controller.abort());

  const pool = createPool(config.databaseUrl);
  const storage =
    config.storage.driver === 's3' ? createS3Storage(config.storage) : createLocalStorage();

  await startWorkerLoops({ pool, storage, config, signal: controller.signal });
}

main().catch((error: Error) => {
  console.error(error);
  process.exit(1);
});
