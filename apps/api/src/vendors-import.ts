import { readFile } from 'node:fs/promises';

import { backfillVendorMatches } from './analysis/vendor-matching';
import { loadConfig } from './config';
import { createPool, withTransaction } from './db';

/**
 * 업체 목록을 CSV로 등록한다.
 *
 *   npm run vendors:import --workspace @weddingpick/api -- vendors.csv
 *
 * 형식: category,name,region,source[,alias1;alias2]
 * 예:   hall,더채플앳청담,서울 강남구,vendor_official,채플앳청담;더채플
 *
 * 이미 있는 업체(같은 지역·같은 정규화 이름)는 건너뛴다. 등록하면 그 이름으로 남아
 * 있던 문서들을 자동으로 연결한다.
 */
function parseCsvLine(line: string): string[] {
  return line.split(',').map((cell) => cell.trim());
}

async function main() {
  const path = process.argv[2];

  if (!path) {
    throw new Error('CSV 파일 경로가 필요하다.');
  }

  const config = loadConfig();
  const pool = createPool(config.databaseUrl);

  const lines = (await readFile(path, 'utf8'))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  let created = 0;
  let skipped = 0;
  let linked = 0;

  try {
    for (const line of lines) {
      const [category, name, region, source, aliases] = parseCsvLine(line);

      if (!category || !name || !region || !source) {
        throw new Error(`형식이 올바르지 않다: ${line}`);
      }

      const result = await withTransaction(pool, async (client) => {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO structured.vendors (category, name, region, source)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (normalized_name, region) DO NOTHING
           RETURNING id`,
          [category, name, region, source]
        );

        const vendorId = inserted.rows[0]?.id;

        if (!vendorId) {
          return null;
        }

        for (const alias of (aliases ?? '').split(';').filter(Boolean)) {
          await client.query(
            `INSERT INTO structured.vendor_aliases (vendor_id, alias) VALUES ($1, $2)
             ON CONFLICT (normalized_alias) DO NOTHING`,
            [vendorId, alias.trim()]
          );
        }

        // 등록 전에 들어온 문서들을 이제 연결할 수 있다.
        return { vendorId, matched: await backfillVendorMatches(client, vendorId) };
      });

      if (result) {
        created += 1;
        linked += result.matched;
      } else {
        skipped += 1;
      }
    }

    console.log(`등록 ${created}건, 건너뜀 ${skipped}건, 기존 문서 연결 ${linked}건`);
  } finally {
    await pool.end();
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
