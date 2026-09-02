import { Pool } from 'pg';

/** `apps/api/src/db.ts`와 같은 자리. 이 서버는 쓰기를 하지 않아 트랜잭션 헬퍼는 없다. */
export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString, max: 5 });
}
