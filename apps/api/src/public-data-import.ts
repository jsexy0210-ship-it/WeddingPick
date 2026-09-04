import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { backfillVendorMatches } from './analysis/vendor-matching';
import { loadConfig } from './config';
import { createPool, withTransaction } from './db';
import { MissingColumnError, parseLocaldataCsv } from './public-data/localdata';
import { runPublicCollection } from './public-data/run';

/**
 * 공개 인허가 자료로 업체를 등록한다.
 *
 *   npm run public-data:import --workspace @weddingpick/api -- --file 예식장.csv --inspect
 *   npm run public-data:import --workspace @weddingpick/api -- --file 예식장.csv --category hall
 *   ... --dry-run          # 쓰지 않고 무엇이 들어갈지만 본다
 *   ... --region 서울       # 지역 이름이 포함된 것만 (없으면 전국)
 *
 * 파일은 공공데이터포털(data.go.kr)에서 "행정안전부 지방행정 인허가 데이터"로 검색해 업종별로 내려받는다.
 * 2026년 4월부터 기존 localdata.go.kr 서비스가 종료되고 공공데이터포털로 통합됐다.
 * 특정 사이트를 긁어오지 않고 공개 자료만 쓴다 — 사업계획서 20번.
 *
 * **모르는 파일은 --inspect 부터.** 업종과 배포 시점에 따라 컬럼 이름과 내용이
 * 다르고, 어떤 업종이 우리 분류 중 무엇에 해당하는지도 파일을 봐야 안다.
 * 잘못 넣으면 미용실 전부가 스드메로 들어오는 식의 일이 생긴다.
 */

const CATEGORIES = ['wedding_info_company', 'hall', 'sdm', 'planner_agency', 'snap', 'goods', 'etc'];

const SOURCE_KEY = 'localdata';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);

  return index === -1 ? undefined : process.argv[index + 1];
}

/**
 * 파일을 들여다보기만 한다.
 *
 * 컬럼 이름과 몇 줄을 보여준다. 이걸 먼저 보면 --category를 고를 수 있고,
 * 컬럼 이름이 우리가 아는 것과 다르면 여기서 드러난다.
 */
async function inspect(file: string): Promise<void> {
  const bytes = await readFile(file);
  const iconv = await import('iconv-lite');

  // 파일은 CP949로 내려온다. UTF-8로 온 것도 있어 둘 다 시도한다.
  const decoded = ((): string => {
    const cp949 = iconv.default.decode(bytes, 'cp949');

    // CP949로 읽었는데 한글이 깨지면 UTF-8이었던 것이다.
    return cp949.includes('�') ? bytes.toString('utf8') : cp949;
  })();

  const lines = decoded.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headers = (lines[0] ?? '').split(',').map((header) => header.trim().replace(/^"|"$/g, ''));

  console.log(`줄 수: ${lines.length - 1}건 (머리줄 제외)`);
  console.log(`\n컬럼 ${headers.length}개:`);
  for (const header of headers) console.log(`  ${header}`);

  console.log('\n앞 3줄:');
  for (const line of lines.slice(1, 4)) console.log(`  ${line.slice(0, 200)}`);

  console.log(
    '\n이 파일이 우리 분류 중 무엇인지 정한 뒤 --category로 넣는다:' +
      `\n  ${CATEGORIES.join(', ')}`
  );
}

async function main() {
  if (process.argv.includes('--source')) {
    await runPublicCollection(process.argv.slice(2));
    return;
  }
  // Legacy localdata files require per-dataset review; they may not silently bypass the allowlist.
  if (!process.argv.includes('--inspect') && !process.argv.includes('--dry-run')) {
    throw new Error('저장에는 검증된 --source가 필요합니다. public-data/README.md 확인');
  }
  const file = argument('file');
  const category = argument('category');
  const regionFilter = argument('region');

  if (file && process.argv.includes('--inspect')) {
    await inspect(file);
    return;
  }
  const dryRun = process.argv.includes('--dry-run');

  if (!file || !category) {
    throw new Error('--file 과 --category 가 필요하다.');
  }

  if (!CATEGORIES.includes(category)) {
    throw new Error(`--category 는 다음 중 하나여야 한다: ${CATEGORIES.join(', ')}`);
  }

  const { vendors, skipped: csvSkipped } = parseLocaldataCsv(await readFile(file));
  const selected = regionFilter
    ? vendors.filter((vendor) => vendor.region.includes(regionFilter))
    : vendors;

  console.log(
    `읽음 ${vendors.length}건 (영업 아님·정보 부족 ${csvSkipped}건 제외)` +
      (regionFilter ? ` → 지역 '${regionFilter}' ${selected.length}건` : '')
  );

  if (dryRun) {
    for (const vendor of selected.slice(0, 20)) {
      console.log(`  ${vendor.name} · ${vendor.region} · 원본기준일 ${vendor.lastVerifiedAt}`);
    }

    if (selected.length > 20) {
      console.log(`  … 외 ${selected.length - 20}건`);
    }

    console.log('--dry-run 이므로 저장하지 않았다.');
    return;
  }

  const pool = createPool(loadConfig().databaseUrl);
  let runId: string | null = null;

  try {
    // 즉시 중단 스위치 확인. 레코드가 없으면(새 환경) 기본 허용.
    const sw = await pool.query<{ enabled: boolean }>(
      `SELECT enabled FROM structured.import_switches WHERE source_key = $1`,
      [SOURCE_KEY]
    );

    if (sw.rows[0] && !sw.rows[0].enabled) {
      console.error(
        `[${SOURCE_KEY}] 임포트 중단 스위치가 꺼져 있다. ` +
          `import_switches 테이블에서 enabled = true로 바꾼 뒤 다시 실행한다.`
      );
      process.exit(1);
    }

    // 실행 이력 생성.
    const runRow = await pool.query<{ id: string }>(
      `INSERT INTO structured.import_runs (source_key, category, file_name, status, total_rows)
       VALUES ($1, $2, $3, 'running', $4)
       RETURNING id`,
      [SOURCE_KEY, category, path.basename(file), selected.length]
    );
    runId = runRow.rows[0]!.id;

    let created = 0;
    let updated = 0;
    let linked = 0;
    let errors = 0;

    for (const vendor of selected) {
      try {
        const result = await withTransaction(pool, async (client) => {
          // last_verified_at = 우리가 확인한 날(now).
          // data_published_at = CSV 행의 데이터갱신일자(원본 기준일).
          // admin_locked = true인 행은 어떤 필드도 갱신하지 않는다.
          const upsert = await client.query<{ id: string; created: boolean }>(
            `INSERT INTO structured.vendors
               (category, name, region, source, last_verified_at, data_published_at, is_active, updated_at)
             VALUES ($1, $2, $3, 'public_data', now(), $4, true, now())
             ON CONFLICT (normalized_name, region)
             DO UPDATE SET
               last_verified_at  = now(),
               data_published_at = EXCLUDED.data_published_at,
               is_active         = true,
               updated_at        = now()
             WHERE NOT structured.vendors.admin_locked
             RETURNING id, (xmax = 0) AS created`,
            [category, vendor.name, vendor.region, vendor.lastVerifiedAt]
          );

          if (upsert.rows.length === 0) {
            // admin_locked 행 — 건너뜀.
            return { created: false, matched: 0, locked: true };
          }

          const row = upsert.rows[0]!;
          const matched = row.created ? await backfillVendorMatches(client, row.id) : 0;

          return { created: row.created, matched, locked: false };
        });

        if (result.created) {
          created += 1;
          linked += result.matched;
        } else if (!result.locked) {
          updated += 1;
        }
      } catch (err) {
        errors += 1;
        const message = err instanceof Error ? err.message : String(err);

        await pool.query(
          `INSERT INTO structured.import_errors
             (run_id, vendor_name, region, error_type, error_message)
           VALUES ($1, $2, $3, 'db_error', $4)`,
          [runId, vendor.name, vendor.region, message]
        );
      }
    }

    await pool.query(
      `UPDATE structured.import_runs
       SET status        = 'completed',
           created_count = $2,
           updated_count = $3,
           skipped_count = $4,
           error_count   = $5,
           finished_at   = now()
       WHERE id = $1`,
      [runId, created, updated, csvSkipped, errors]
    );

    console.log(
      `등록 ${created}건, 갱신 ${updated}건, 기다리던 문서 연결 ${linked}건` +
        (errors > 0 ? `, 오류 ${errors}건 (import_errors 테이블 확인)` : '')
    );
  } catch (fatalErr) {
    if (runId) {
      await pool
        .query(
          `UPDATE structured.import_runs
           SET status = 'failed', finished_at = now()
           WHERE id = $1`,
          [runId]
        )
        .catch(() => undefined);
    }

    throw fatalErr;
  } finally {
    await pool.end();
  }
}

main().catch((error: Error) => {
  if (error instanceof MissingColumnError) {
    console.error(
      `${error.message}\n\n` +
        '이 파일의 컬럼 이름이 알고 있는 후보와 다르다. ' +
        'src/public-data/localdata.ts 의 COLUMN_ALIASES 에 실제 이름을 더하면 된다.'
    );
  } else {
    console.error(error.message);
  }

  process.exit(1);
});
