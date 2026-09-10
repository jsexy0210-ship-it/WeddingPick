/**
 * 시드가 심은 **업체 사진만** 지운다. 업체 · 회원 · 후기 · 제보는 건드리지 않는다.
 *
 * 왜 별도 도구인가 — `seed:samples --remove`는 이 일을 하지 않는다. 그것은
 * `DELETE FROM structured.vendors`로 **업체를 지우고**, 후기 · 사진 · 후보가 CASCADE로
 * 따라간다(seed-samples.ts remove()). 운영에서 그것을 돌리면 업체 240곳과 함께
 * 후기 1,603건 · 제보 1,260건이 사라진다. 지금 지워야 할 것은 사진뿐이다.
 *
 * 지우는 대상은 「업종 검색 결과를 업체마다 잘라 붙인 것」이다(2026-09-10 실측).
 *
 *   저작권 근거      unknown   — 쓸 수 있는지 확인하지 않았다
 *   업체 매칭 신뢰도   0         — 그 업체 것인지 확인하지 않았다. 검색어에 업체명이 없었다
 *
 * 둘 다인 행만 지운다. 하나라도 아니면 사람이 넣었거나 검증을 거친 것이라 남긴다.
 *
 *   확인만:  npx tsx scripts/remove-sample-images.ts
 *   실제로:  npx tsx scripts/remove-sample-images.ts --yes
 */
import { Pool } from 'pg';

const url = process.env.DATABASE_URL;
const APPLY = process.argv.includes('--yes');

if (!url) {
  console.error('::error::DATABASE_URL이 없다.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: url.includes('localhost') || url.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
});

/** 검증을 하나도 거치지 않은 사진. 이 조건 밖은 절대 건드리지 않는다. */
const TARGET = `copyright_basis = 'unknown' AND match_confidence = 0`;

async function main(): Promise<void> {
  const { rows: before } = await pool.query<{ 전체: string; 지울것: string; 남길것: string }>(
    `SELECT count(*) AS 전체,
            count(*) FILTER (WHERE ${TARGET}) AS 지울것,
            count(*) FILTER (WHERE NOT (${TARGET})) AS 남길것
       FROM structured.vendor_images`,
  );

  console.log('업체 사진');
  console.log(`  전체        ${before[0]?.전체}`);
  console.log(`  지울 것      ${before[0]?.지울것}  (저작권 unknown + 매칭 0)`);
  console.log(`  남길 것      ${before[0]?.남길것}`);

  const { rows: vendors } = await pool.query<{ 건수: string }>(
    'SELECT count(*) AS 건수 FROM structured.vendors',
  );

  console.log(`\n업체는 건드리지 않는다 — 지금 ${vendors[0]?.건수}곳, 그대로 남는다.`);

  if (!APPLY) {
    console.log('\n확인만 했다. 실제로 지우려면 --yes를 붙인다.');
    await pool.end();
    return;
  }

  const { rowCount } = await pool.query(`DELETE FROM structured.vendor_images WHERE ${TARGET}`);

  console.log(`\n지웠다: 사진 ${rowCount}장.`);

  const { rows: after } = await pool.query<{ 사진: string; 업체: string }>(
    `SELECT (SELECT count(*) FROM structured.vendor_images) AS 사진,
            (SELECT count(*) FROM structured.vendors) AS 업체`,
  );

  console.log(`남은 것: 사진 ${after[0]?.사진}장 · 업체 ${after[0]?.업체}곳.`);

  await pool.end();
}

main().catch((error: Error) => {
  console.error(`::error::실패: ${error.message.split('\n')[0]}`);
  process.exit(1);
});
