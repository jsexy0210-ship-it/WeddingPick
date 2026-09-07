import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import type { Client } from 'pg';

export const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

/**
 * 아직 적용되지 않은 마이그레이션을 파일명 순서대로 적용한다.
 * 각 마이그레이션은 한 트랜잭션 안에서 돈다 — 중간까지만 적용된 스키마가 남지 않는다.
 */
export async function migrate(client: Client, dir = MIGRATIONS_DIR): Promise<string[]> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await client.query<{ version: string }>(
    'SELECT version FROM public.schema_migrations'
  );
  const applied = new Set(rows.map((row) => row.version));

  const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();
  const ran: string[] = [];

  for (const file of files) {
    const version = file.replace(/\.sql$/, '');

    if (applied.has(version)) {
      continue;
    }

    const sql = await readFile(path.join(dir, file), 'utf8');

    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO public.schema_migrations (version) VALUES ($1)', [version]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`마이그레이션 ${version} 실패: ${(error as Error).message}`);
    }

    ran.push(version);
  }

  return ran;
}

/**
 * 스키마가 코드와 같은 자리에 있는가.
 *
 * 이 확인이 없어서 운영이 깨진 것을 아무도 못 봤다. `/health`는 `SELECT 1`만 해서
 * 테이블이 하나도 없어도 통과하고, 그동안 인증 API는 전부 500이었다. 연결되는
 * 것과 쓸 수 있는 것은 다르다.
 *
 * 던지지 않는다 — 이 값을 보는 쪽(`/health`)이 판단한다. 확인 자체가 실패해서
 * 서비스가 내려가면 관측하려던 목적과 반대가 된다.
 */
export async function schemaState(
  query: (sql: string) => Promise<{ rows: Array<{ version: string }> }>,
  dir = MIGRATIONS_DIR
): Promise<{ applied: number; expected: number; pending: string[]; ok: boolean; error?: string }> {
  const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();
  const expected = files.map((file) => file.replace(/\.sql$/, ''));

  try {
    const { rows } = await query('SELECT version FROM public.schema_migrations');
    const applied = new Set(rows.map((row) => row.version));
    const pending = expected.filter((version) => !applied.has(version));

    return { applied: applied.size, expected: expected.length, pending, ok: pending.length === 0 };
  } catch (error) {
    // schema_migrations 자체가 없으면 한 번도 적용되지 않은 DB다.
    return {
      applied: 0,
      expected: expected.length,
      pending: expected,
      ok: false,
      error: (error as Error).message.slice(0, 200),
    };
  }
}
