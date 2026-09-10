import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createPool } from '../db';
import { downloadPublicCsv, downloadSbizApiVendors, parsePublicCsv } from './collect';
import { PUBLIC_SOURCES, sourceKey } from './sources';
import { syncCollected } from './sync';

/**
 * 한 번에 넘기는 업체 수. 예전에는 이 수를 넘으면 던지고 「지역·업종별로 나누세요」라고
 * 안내했는데, 그건 할 수 없는 일을 시키는 말이었다 — `sbiz-seoul`은 이미 시도 하나이고
 * 서울을 더 쪼갤 출처 정의가 없다. 업종 코드를 고쳐 서울 전수가 들어오는 순간 코드를
 * 바꾸기 전에는 영원히 반영이 안 되는 상태였다.
 *
 * 그래서 거절하는 대신 이 수만큼 잘라서 반복한다. 한 번에 너무 많이 쓰지 않는다는
 * 원래 의도는 그대로다 — `syncCollected`는 어차피 행마다 따로 트랜잭션을 열므로
 * (`sync.ts`) 이 값이 지키는 것은 트랜잭션 크기가 아니라 사고 시 되돌릴 크기다.
 */
const APPLY_CHUNK = 2000;

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
  let vendors: Awaited<ReturnType<typeof parsePublicCsv>>['vendors'];
  let total: number;
  let rejected: number;
  let duplicates: number;
  /** sbiz 전용 — 페이지 상한에 걸려 다 못 받은 업종코드. 비어 있어야 전수다. */
  let truncated: { code: string; got: number; total: number }[] = [];

  if (source.format === 'sbiz-api') {
    if (!sbizApiKey) throw new Error('SBIZ_API_KEY 환경변수 또는 --sbiz-api-key 옵션이 필요합니다.');
    // 업종코드는 하드코딩하지 않는다 — CLI 또는 SBIZ_UPJONG_CODES에서 온다.
    const result = await downloadSbizApiVendors(key, sbizApiKey, at,
      upjongCodes ? { divId: upjongDivId ?? 'indsLclsCd', codes: upjongCodes.split(',') } : undefined);
    vendors = result.vendors;
    // total은 API가 돌려준 원본 건수다. accepted가 0인데 total이 크면 지역·분류
    // 필터가 응답 필드와 어긋난 것이므로 리포트만 보고 구분할 수 있어야 한다.
    total = result.fetched;
    rejected = result.rejected;
    duplicates = result.duplicates;
    truncated = result.truncated;
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
    const pool = createPool(process.env.DATABASE_URL!);
    try {
      db = {created: 0, updated: 0, unchanged: 0, held: 0, errors: 0};
      for (let from = 0; from < vendors.length; from += APPLY_CHUNK) {
        const counts = await syncCollected(pool, vendors.slice(from, from + APPLY_CHUNK));
        for (const field of Object.keys(db) as (keyof typeof db)[]) db[field] += counts[field];
      }
    } finally { await pool.end(); }
  }
  const report = {source: key, sourceUrl: source.url, collectedAt: at.toISOString(),
    total, accepted: vendors.length, rejected, duplicates, truncated, databaseApplied: apply, db};
  await writeFile(join(output, `${key}-report.json`), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report));
  if (db?.errors) throw new Error('일부 DB 반영 실패. import_errors 확인');
}
