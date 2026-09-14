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
 * **이 프로세스는 아직 어디에도 배포돼 있지 않다.** `render.yaml`에 워커
 * 서비스를 적어 뒀지만 Blueprint 동기화가 깨져 있어 사람이 대시보드에서
 * 만들어야 한다. 만들기 전까지 실제로 도는 것은 API 안쪽이다.
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
