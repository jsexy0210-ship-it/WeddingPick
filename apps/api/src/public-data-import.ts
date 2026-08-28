import { readFile } from 'node:fs/promises';

import { backfillVendorMatches } from './analysis/vendor-matching';
import { loadConfig } from './config';
import { createPool, withTransaction } from './db';
import { MissingColumnError, parseLocaldataCsv } from './public-data/localdata';

/**
 * 공개 인허가 자료로 업체를 등록한다.
 *
 *   npm run public-data:import --workspace @weddingpick/api -- --file 예식장.csv --inspect
 *   npm run public-data:import --workspace @weddingpick/api -- --file 예식장.csv --category hall
 *   ... --dry-run          # 쓰지 않고 무엇이 들어갈지만 본다
 *   ... --region 서울       # 지역 이름이 포함된 것만 (없으면 전국)
 *
 * 파일은 지방행정 인허가 데이터(localdata.go.kr)에서 업종별로 내려받는다.
 * 특정 사이트를 긁어오지 않고 공개 자료만 쓴다 — 사업계획서 20번.
 *
 * **모르는 파일은 --inspect 부터.** 업종과 배포 시점에 따라 컬럼 이름과 내용이
 * 다르고, 어떤 업종이 우리 분류 중 무엇에 해당하는지도 파일을 봐야 안다.
 * 잘못 넣으면 미용실 전부가 스드메로 들어오는 식의 일이 생긴다.
 */

const CATEGORIES = ['wedding_info_company', 'hall', 'sdm', 'planner_agency', 'snap', 'goods', 'etc'];

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
    return cp949.includes('\uFFFD') ? bytes.toString('utf8') : cp949;
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

  const { vendors, skipped } = parseLocaldataCsv(await readFile(file));
  const selected = regionFilter
    ? vendors.filter((vendor) => vendor.region.includes(regionFilter))
    : vendors;

  console.log(
    `읽음 ${vendors.length}건 (영업 아님·정보 부족 ${skipped}건 제외)` +
      (regionFilter ? ` → 지역 '${regionFilter}' ${selected.length}건` : '')
  );

  if (dryRun) {
    for (const vendor of selected.slice(0, 20)) {
      console.log(`  ${vendor.name} · ${vendor.region} · 확인 ${vendor.lastVerifiedAt}`);
    }

    if (selected.length > 20) {
      console.log(`  … 외 ${selected.length - 20}건`);
    }

    console.log('--dry-run 이므로 저장하지 않았다.');
    return;
  }

  const pool = createPool(loadConfig().databaseUrl);

  let created = 0;
  let updated = 0;
  let linked = 0;

  try {
    for (const vendor of selected) {
      const result = await withTransaction(pool, async (client) => {
        // 같은 지역·같은 이름이면 새로 만들지 않고 확인일만 갱신한다.
        const inserted = await client.query<{ id: string; created: boolean }>(
          `INSERT INTO structured.vendors (category, name, region, source, last_verified_at)
           VALUES ($1, $2, $3, 'public_data', $4)
           ON CONFLICT (normalized_name, region)
           DO UPDATE SET last_verified_at = EXCLUDED.last_verified_at
           RETURNING id, (xmax = 0) AS created`,
          [category, vendor.name, vendor.region, vendor.lastVerifiedAt]
        );

        const row = inserted.rows[0]!;

        // 등록 전에 들어온 견적들을 이제 연결할 수 있다.
        const matched = row.created ? await backfillVendorMatches(client, row.id) : 0;

        return { created: row.created, matched };
      });

      if (result.created) {
        created += 1;
        linked += result.matched;
      } else {
        updated += 1;
      }
    }

    console.log(`등록 ${created}건, 갱신 ${updated}건, 기다리던 문서 연결 ${linked}건`);
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
