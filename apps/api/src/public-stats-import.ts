import { readFile } from 'node:fs/promises';

import { z } from 'zod';

import { loadConfig } from './config';
import { createPool } from './db';
import { publicStatSchema, upsertStats } from './public-stats';

/**
 * 공공 통계를 표에 넣는다 — 웨딩피드 통계 주제가 이 값을 쓴다.
 *
 *   npm run public-stats:import --workspace @weddingpick/api -- --file stats.json --dry-run
 *   npm run public-stats:import --workspace @weddingpick/api -- --file stats.json
 *
 * 파일은 배열이다. 한 칸의 모양:
 *
 *   { "key": "seoul.marriage.count", "label": "서울 혼인 건수", "value": 36324,
 *     "unit": "건", "period": "2025년", "sourceName": "서울특별시",
 *     "sourceUrl": "https://www.data.go.kr/data/<번호>/fileData.do" }
 *
 * 값은 공공데이터포털 원본에서 사람이 옮긴다. 하나라도 틀린 칸이 있으면 아무것도
 * 넣지 않는다.
 */
async function main() {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf('--file');
  const file = fileIndex >= 0 ? args[fileIndex + 1] : undefined;
  const dryRun = args.includes('--dry-run');

  if (!file) throw new Error('--file <stats.json>이 필요하다.');

  const stats = z.array(publicStatSchema).min(1).parse(JSON.parse(await readFile(file, 'utf8')));

  for (const stat of stats) {
    console.log(`${stat.key}: ${stat.value}${stat.unit} (${stat.period} · ${stat.sourceName})`);
  }

  if (dryRun) {
    console.log(`--dry-run: ${stats.length}건을 넣지 않고 끝낸다.`);
    return;
  }

  const pool = createPool(loadConfig().databaseUrl);

  try {
    console.log(`${await upsertStats(pool, stats)}건을 넣었다.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
