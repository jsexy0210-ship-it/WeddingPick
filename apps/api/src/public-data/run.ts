import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createPool } from '../db';
import { downloadPublicCsv, downloadSbizApiVendors, parsePublicCsv } from './collect';
import { PUBLIC_SOURCES, sourceKey } from './sources';
import { syncCollected } from './sync';

/** Invoked through the existing public-data:import CLI. --apply is an explicit DB write. */
export async function runPublicCollection(args: string[]) {
  function arg(name: string) { const i=args.indexOf(name); return i<0 ? undefined : args[i+1]; }
  const key = sourceKey(arg('--source') ?? '');
  const file = arg('--file');
  const sbizApiKey = arg('--sbiz-api-key') ?? process.env.SBIZ_API_KEY;
  const upjongCodes = arg('--upjong-codes');
  const upjongDivId = arg('--upjong-div-id');
  const apply = args.includes('--apply');
  if (apply && args.includes('--dry-run')) throw new Error('--apply와 --dry-run은 함께 사용할 수 없습니다.');
  if (apply && !process.env.DATABASE_URL) throw new Error('DATABASE_URL 없음: --apply를 제외하면 수집·검증 가능합니다.');

  const source = PUBLIC_SOURCES[key];
  const at = new Date();
  let vendors: Awaited<ReturnType<typeof downloadSbizApiVendors>>;
  let total: number;
  let rejected: number;
  let duplicates: number;

  if (source.format === 'sbiz-api') {
    if (!sbizApiKey) throw new Error('SBIZ_API_KEY 환경변수 또는 --sbiz-api-key 옵션이 필요합니다.');
    // 업종코드는 하드코딩하지 않는다 — CLI 또는 SBIZ_UPJONG_CODES에서 온다.
    vendors = await downloadSbizApiVendors(key, sbizApiKey, at,
      upjongCodes ? { divId: upjongDivId ?? 'indsLclsCd', codes: upjongCodes.split(',') } : undefined);
    total = vendors.length;
    rejected = 0;
    duplicates = 0;
  } else {
    if (file && (await stat(file)).size > 64 * 1024 * 1024) throw new Error('64 MiB 이하 지역별 CSV가 필요합니다.');
    const bytes = file ? await readFile(file) : await downloadPublicCsv(key);
    const result = parsePublicCsv(bytes, key, at);
    vendors = result.vendors;
    total = result.total;
    rejected = result.rejected;
    duplicates = result.duplicates;
  }

  const output = arg('--out') ?? '.collection';
  await mkdir(output, {recursive: true});
  // Only the whitelist projection is saved; no phone, address, coordinates, HTML or original CSV.
  await writeFile(join(output, `${key}.json`), JSON.stringify({vendors, total, rejected, duplicates}, null, 2) + '\n', 'utf8');

  let db = null;
  if (apply) {
    if (vendors.length > 2000) throw new Error('1회 DB 반영은 최대 2,000개입니다. 지역·업종별로 나누세요.');
    const pool = createPool(process.env.DATABASE_URL!);
    try { db = await syncCollected(pool, vendors); } finally { await pool.end(); }
  }
  const report = {source: key, sourceUrl: source.url, collectedAt: at.toISOString(),
    total, accepted: vendors.length, rejected, duplicates, databaseApplied: apply, db};
  await writeFile(join(output, `${key}-report.json`), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report));
  if (db?.errors) throw new Error('일부 DB 반영 실패. import_errors 확인');
}
