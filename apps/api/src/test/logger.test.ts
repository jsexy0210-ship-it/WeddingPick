import { Pool } from 'pg';

import { loadConfig } from '../config';
import { buildServer } from '../server';
import { createLocalStorage } from '../storage/local';

/**
 * 로거가 켜져 있는지 지킨다.
 *
 * `Fastify({ logger: false })`로 두면 `app.log.error`가 조용히 아무 일도 하지
 * 않는다. 오류 처리기는 멀쩡해 보이는데 500이 나도 배포 로그에 한 줄도 남지
 * 않아, 무엇이 터졌는지 아무도 볼 수 없다 — 실제로 그 상태로 운영됐고, 카카오
 * 로그인이 500으로 막혔을 때 단서를 하나도 찾을 수 없었다.
 *
 * DB는 쓰지 않는다. 서버를 세우기만 하고 로거 설정만 본다.
 */
describe('서버 로그', () => {
  it('로거가 켜져 있고 기본 수준은 warn이다', async () => {
    const config = loadConfig({ DATABASE_URL: 'postgres://x/y', STORAGE_DRIVER: 'local' } as never);
    const pool = new Pool({ connectionString: 'postgres://x/y' });
    const app = buildServer({ pool, config, storage: createLocalStorage(), providers: {} } as never);

    try {
      await app.ready();
      expect(app.log.level).toBe('warn');
    } finally {
      await app.close();
      await pool.end();
    }
  });
});
