import { Pool, type PoolClient } from 'pg';

export type Db = Pool;

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString, max: 10 });
}

/** 여러 쓰기를 한 트랜잭션으로 묶는다. 중간까지만 반영된 상태를 남기지 않는다. */
export async function withTransaction<T>(pool: Pool, run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
