import type { PoolClient } from 'pg';

import { createPool } from './db';

/**
 * 한 업종의 업체를 운영 DB에서 지우는 CLI(2026-09-24 대표 지시 — 「결정사는
 * 필요없다」 · 「지워」).
 *
 *   npm run vendors:purge-category --workspace @weddingpick/api -- --category wedding_info_company
 *   npm run vendors:purge-category --workspace @weddingpick/api -- --category wedding_info_company --apply
 *
 * `--apply`가 없으면 몇 곳이 지워질지만 센다. **되돌릴 수 없다.**
 *
 * 사용자가 남긴 기록(Pick 후보 · 후기 · 제보 금액 · Pick 결정)이 달린 업체는 기본으로
 * 건너뛰고 목록만 보여준다 — 업체를 지우면 그 기록이 CASCADE로 함께 사라지기
 * 때문이다. 그것까지 지우려면 `--include-used`를 붙인다.
 *
 * `vendor_source_records`는 업체를 CASCADE 없이 잡고 있어 먼저 지운다. 다른 업체가
 * 이 업체로 병합돼 있으면(`merged_into_vendor_id`, RESTRICT) 그 연결을 끊는다.
 */

const USER_LINKED = [
  ['vendor_candidates', 'Pick 후보'],
  ['reviews', '후기'],
  ['price_reports', '제보 금액'],
  ['category_decisions', 'Pick 결정'],
] as const;

function argValue(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

async function usedVendorIds(client: PoolClient, ids: string[]): Promise<Map<string, string[]>> {
  const used = new Map<string, string[]>();
  for (const [table, label] of USER_LINKED) {
    const { rows } = await client.query<{ vendor_id: string }>(
      `SELECT DISTINCT vendor_id FROM structured.${table} WHERE vendor_id = ANY($1::uuid[])`,
      [ids]
    );
    for (const { vendor_id } of rows) used.set(vendor_id, [...(used.get(vendor_id) ?? []), label]);
  }
  return used;
}

async function main(): Promise<void> {
  const category = argValue('category');
  if (!category) {
    console.error('--category로 지울 업종 키를 준다. 예: --category wedding_info_company');
    process.exitCode = 1;
    return;
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL이 없다.');
    process.exitCode = 1;
    return;
  }

  const apply = process.argv.includes('--apply');
  const includeUsed = process.argv.includes('--include-used');
  const pool = createPool(databaseUrl);
  const client = await pool.connect();

  try {
    const { rows: vendors } = await client.query<{ id: string; name: string; region: string | null }>(
      `SELECT id, name, region FROM structured.vendors WHERE category = $1 ORDER BY region, name`,
      [category]
    );
    const ids = vendors.map((vendor) => vendor.id);
    const used = ids.length ? await usedVendorIds(client, ids) : new Map<string, string[]>();
    const targets = includeUsed ? ids : ids.filter((id) => !used.has(id));

    const byRegion = new Map<string, number>();
    for (const vendor of vendors) {
      const region = vendor.region ?? '지역 없음';
      byRegion.set(region, (byRegion.get(region) ?? 0) + 1);
    }
    console.log(`업종 ${category}: ${vendors.length}곳 · ${[...byRegion].map(([k, v]) => `${k} ${v}`).join(' · ')}`);
    console.log(`사용자 기록이 달린 업체 ${used.size}곳${includeUsed ? ' — 함께 지운다(--include-used)' : ' — 건너뛴다'}`);
    for (const vendor of vendors.filter((v) => used.has(v.id))) {
      console.log(`  ${vendor.name} (${vendor.region ?? '지역 없음'}) · ${used.get(vendor.id)?.join(' · ')}`);
    }
    console.log(`지울 업체 ${targets.length}곳`);

    if (!apply) {
      console.log('세기만 했다. 실제로 지우려면 --apply를 붙일 것.');
      return;
    }
    if (targets.length === 0) return;

    await client.query('BEGIN');
    const sources = await client.query(
      `DELETE FROM structured.vendor_source_records WHERE vendor_id = ANY($1::uuid[])`,
      [targets]
    );
    await client.query(
      `UPDATE structured.vendors SET merged_into_vendor_id = NULL WHERE merged_into_vendor_id = ANY($1::uuid[])`,
      [targets]
    );
    const deleted = await client.query(`DELETE FROM structured.vendors WHERE id = ANY($1::uuid[])`, [targets]);
    await client.query('COMMIT');
    console.log(`업체 ${deleted.rowCount}곳을 지웠다(출처 기록 ${sources.rowCount}건 포함).`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
