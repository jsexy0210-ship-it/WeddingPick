import type { Client } from 'pg';

import { migrate } from './migrate';

/**
 * 시험용 초기화. 스키마를 비우고 마이그레이션을 처음부터 다시 올린다.
 *
 * 전에는 `DROP OWNED BY CURRENT_USER CASCADE` 한 줄이었다. 개발 기계에서는
 * 됐지만 CI에서는 안 됐다 —
 *
 *   cannot drop objects owned by role weddingpick because they are required
 *   by the database system
 *
 * **역할이 가진 것을 다 지우라고 하면 데이터베이스 자체까지 걸린다.** 지우려던
 * 것은 그게 아니라 마이그레이션이 만든 것뿐이었다. 그래서 만든 것만 이름으로
 * 짚어 지운다 — 무엇을 지우는지가 문장에 그대로 적혀 있고, 어느 기계에서 돌든
 * 같게 동작한다.
 */
export async function resetSchema(client: Client): Promise<void> {
  /*
   * 우리가 만든 스키마들(structured·originals·identity·ads·stats). 이름을 적어
   * 두지 않고 찾아서 지우는 이유는, 스키마를 새로 만들 때마다 이 파일을 같이
   * 고쳐야 하는 것을 잊기 때문이다 — 0040에서 ads를 더할 때 실제로 잊었다.
   */
  await client.query(`
    DO $$
    DECLARE target text;
    BEGIN
      FOR target IN
        SELECT nspname FROM pg_namespace
        WHERE nspname <> 'public'
          AND nspname <> 'information_schema'
          AND nspname NOT LIKE 'pg\\_%'
      LOOP
        EXECUTE format('DROP SCHEMA %I CASCADE', target);
      END LOOP;
    END
    $$;
  `);

  /*
   * public에는 enum 마흔 개 남짓과 schema_migrations가 있다. 하나씩 지우는 것보다
   * 통째로 다시 만드는 편이 빠지는 것이 없다 — 새 타입을 더해도 여기는 그대로다.
   */
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');

  await migrate(client);
}
