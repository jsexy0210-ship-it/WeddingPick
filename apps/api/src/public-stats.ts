import { PUBLIC_STAT_SOURCE_URL_PATTERN, type PublicStat } from '@weddingpick/domain';
import type { Pool } from 'pg';
import { z } from 'zod';

/**
 * 공공 통계 표(`structured.public_stats`, 0431)를 읽고 쓴다.
 *
 * 값은 사람이 공공데이터포털 원본에서 옮긴 JSON으로 넣는다(`public-stats-import.ts`).
 * 파일 모양을 실제로 열어 확인하기 전에 파서를 추측해 짜지 않는다 — 엉뚱한 칸을
 * 읽은 숫자가 피드에 「공공 통계」로 박히는 것이 비어 있는 것보다 나쁘다.
 */
export const publicStatSchema = z.object({
  key: z.string().regex(/^[a-z0-9_.]+$/),
  label: z.string().trim().min(1).max(60),
  value: z.number().finite().nonnegative(),
  unit: z.string().trim().min(1).max(10),
  period: z.string().trim().min(1).max(30),
  sourceName: z.string().trim().min(1).max(60),
  sourceUrl: z.string().regex(PUBLIC_STAT_SOURCE_URL_PATTERN),
});

type Row = {
  key: string;
  label: string;
  value: string;
  unit: string;
  period: string;
  source_name: string;
  source_url: string;
};

export async function listStatKeys(pool: Pool): Promise<string[]> {
  const { rows } = await pool.query<{ key: string }>('SELECT key FROM structured.public_stats');

  return rows.map((row) => row.key);
}

export async function loadStats(pool: Pool, keys: readonly string[]): Promise<PublicStat[]> {
  if (keys.length === 0) return [];

  const { rows } = await pool.query<Row>(
    `SELECT key, label, value::text, unit, period, source_name, source_url
     FROM structured.public_stats WHERE key = ANY($1::text[]) ORDER BY key`,
    [keys]
  );

  return rows.map((row) => ({
    key: row.key,
    label: row.label,
    value: Number(row.value),
    unit: row.unit,
    period: row.period,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
  }));
}

export async function upsertStats(pool: Pool, stats: readonly PublicStat[]): Promise<number> {
  for (const stat of stats) {
    await pool.query(
      `INSERT INTO structured.public_stats
         (key, label, value, unit, period, source_name, source_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (key) DO UPDATE SET
         label = EXCLUDED.label, value = EXCLUDED.value, unit = EXCLUDED.unit,
         period = EXCLUDED.period, source_name = EXCLUDED.source_name,
         source_url = EXCLUDED.source_url, updated_at = now()`,
      [stat.key, stat.label, stat.value, stat.unit, stat.period, stat.sourceName, stat.sourceUrl]
    );
  }

  return stats.length;
}
