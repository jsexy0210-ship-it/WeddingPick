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
