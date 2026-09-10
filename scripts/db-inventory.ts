/**
 * 운영 데이터가 실제로 얼마나 모였는지 **세기만** 한다. 아무것도 바꾸지 않는다.
 *
 * 「썸네일과 업체 이미지가 얼마나 수집됐나」를 묻는 자리다(2026-09-09 사용자). 지금까지
 * 저장소에는 스키마가 어디까지 왔는지 보는 도구(`DB Status`)만 있었고, **내용물이 얼마나
 * 있는지 보는 도구는 없었다** — 그래서 「데이터가 있다」를 화면을 열어보고 짐작해야 했다.
 *
 * 출력은 집계 숫자와 상태 이름뿐이다. 업체명 · 이미지 URL · 사용자 정보는 찍지 않는다 —
 * 이 로그는 GitHub Actions에 남고, 남으면 지우기 어렵다.
 */
import { Pool } from 'pg';

const url = process.env.DATABASE_URL;

if (!url) {
  console.error('::error::DATABASE_URL이 없다.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: url.includes('localhost') || url.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
});

/** 한 줄짜리 집계. 실패해도 나머지는 계속 센다 — 표가 하나 없다고 전체를 포기하지 않는다. */
async function count(label: string, sql: string): Promise<void> {
  try {
    const { rows } = await pool.query<Record<string, string>>(sql);

    if (rows.length === 0) {
      console.log(`  ${label.padEnd(34)} 0`);
      return;
    }

    for (const row of rows) {
      const values = Object.entries(row)
        .map(([key, value]) => `${key}=${value ?? '0'}`)
        .join('  ');

      console.log(`  ${label.padEnd(34)} ${values}`);
    }
  } catch (error) {
    console.log(`  ${label.padEnd(34)} 조회 실패: ${(error as Error).message.split('\n')[0]}`);
  }
}

async function main(): Promise<void> {
  console.log('운영 데이터 현황 — 세기만 한다\n');

  console.log('업체');
  await count('업체 전체', 'SELECT count(*) AS 건수 FROM structured.vendors');
  await count(
    '업종별',
    `SELECT category AS 업종, count(*) AS 건수
       FROM structured.vendors GROUP BY category ORDER BY count(*) DESC`,
  );

  console.log('\n업체 이미지 (structured.vendor_images)');
  await count('이미지 전체', 'SELECT count(*) AS 건수 FROM structured.vendor_images');
  await count(
    '상태별',
    `SELECT status AS 상태, count(*) AS 건수
       FROM structured.vendor_images GROUP BY status ORDER BY count(*) DESC`,
  );
  await count(
    '대표 이미지가 있는 업체',
    `SELECT count(DISTINCT vendor_id) AS 업체수
       FROM structured.vendor_images WHERE is_representative AND status = 'approved'`,
  );
  await count(
    '이미지가 하나라도 있는 업체',
    'SELECT count(DISTINCT vendor_id) AS 업체수 FROM structured.vendor_images',
  );
  await count(
    '대표 이미지가 없는 업체',
    `SELECT count(*) AS 업체수 FROM structured.vendors v
      WHERE NOT EXISTS (
        SELECT 1 FROM structured.vendor_images i
         WHERE i.vendor_id = v.id AND i.is_representative AND i.status = 'approved')`,
  );
  await count(
    '저작권 근거별',
    `SELECT copyright_basis AS 근거, count(*) AS 건수
       FROM structured.vendor_images GROUP BY copyright_basis ORDER BY count(*) DESC`,
  );
  await count(
    '내부 저장소에 올라간 것',
    `SELECT count(*) FILTER (WHERE storage_key IS NOT NULL) AS 저장소,
            count(*) FILTER (WHERE storage_key IS NULL) AS 외부URL만
       FROM structured.vendor_images`,
  );

  console.log('\n썸네일 · 콘텐츠');
  await count(
    '웨딩 정보 썸네일',
    `SELECT count(*) AS 전체,
            count(thumbnail_url) AS 썸네일있음,
            count(*) - count(thumbnail_url) AS 없음
       FROM structured.wedding_info`,
  );

  console.log('\n이용자가 넣은 것');
  await count('회원', 'SELECT count(*) AS 건수 FROM structured.users');
  await count('웨딩', 'SELECT count(*) AS 건수 FROM structured.weddings');
  await count('후기', 'SELECT count(*) AS 건수 FROM structured.reviews');
  await count('제보(견적·결제)', 'SELECT count(*) AS 건수 FROM structured.quotes');

  await pool.end();
}

main().catch((error: Error) => {
  console.error(`::error::조회 실패: ${error.message.split('\n')[0]}`);
  process.exit(1);
});
