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

  /*
   * **어느 DB를 보고 있는지 먼저 밝힌다.** 접속 문자열은 절대 찍지 않는다 — DB 이름과
   * 마이그레이션 진도만으로도 둘을 가려낼 수 있고, 그 둘은 비밀이 아니다.
   * 2026-09-07에 「앱과 배포 파이프라인이 서로 다른 DB를 보고 있던」 일이 있었다.
   */
  console.log('신원');
  await count('DB 이름', 'SELECT current_database() AS 이름');
  await count(
    '적용된 마이그레이션',
    'SELECT count(*) AS 개수, max(version) AS 마지막 FROM public.schema_migrations',
  );

  console.log('\n업체');
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
  /*
   * **저작권과 업체 매칭은 다른 값이다.** copyright_basis는 「이 그림을 써도 되는가」,
   * match_confidence는 「이 그림이 정말 그 업체 것인가」를 말한다. 0이면 매칭을 아예
   * 하지 않았다는 뜻이다 — 노출하면 남의 사진을 그 업체 사진으로 보여주는 것이 된다.
   */
  await count(
    '업체 매칭 신뢰도',
    `SELECT match_confidence AS 신뢰도, count(*) AS 건수
       FROM structured.vendor_images GROUP BY match_confidence ORDER BY match_confidence`,
  );
  await count(
    '출처 메모(앞 40자)별',
    `SELECT left(copyright_note, 40) AS 메모, count(*) AS 건수
       FROM structured.vendor_images GROUP BY left(copyright_note, 40) ORDER BY count(*) DESC LIMIT 5`,
  );
  await count(
    '업체당 이미지 장수',
    `SELECT 장수, count(*) AS 업체수 FROM (
       SELECT vendor_id, count(*) AS 장수 FROM structured.vendor_images GROUP BY vendor_id
     ) t GROUP BY 장수 ORDER BY 장수`,
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

  /*
   * **샘플과 진짜를 갈라 센다.** 합계만 세면 「후기 1,603건」이 실제 이용자가 쓴 것처럼
   * 읽힌다. 시드(`seed-samples.ts`)가 «표본N» · «제보자N»이라는 이름으로 회원과 후기 ·
   * 제보를 함께 심어 두었고, 그 계정은 소셜 로그인(identities)이 붙어 있지 않다 —
   * 그것이 사람과 시드를 가르는 유일하게 확실한 표식이다.
   */
  const SEEDED_USER = `u.display_name_user_set = false
       AND (u.display_name ~ '^(표본|제보자)[0-9]+$' OR u.display_name IN ('운영자', '표본운영'))
       AND NOT EXISTS (SELECT 1 FROM identity.identities i WHERE i.user_id = u.id)`;

  console.log('\n이용자가 넣은 것 — 시드와 사람을 가른다');
  await count(
    '회원',
    `SELECT count(*) FILTER (WHERE ${SEEDED_USER}) AS 시드,
            count(*) FILTER (WHERE NOT (${SEEDED_USER})) AS 사람
       FROM structured.users u`,
  );
  await count(
    '로그인이 붙은 계정',
    `SELECT count(DISTINCT user_id) AS 건수 FROM identity.identities`,
  );
  await count(
    '후기',
    `SELECT count(*) FILTER (WHERE EXISTS (
              SELECT 1 FROM structured.users u WHERE u.id = r.author_user_id AND ${SEEDED_USER})) AS 시드,
            count(*) FILTER (WHERE NOT EXISTS (
              SELECT 1 FROM structured.users u WHERE u.id = r.author_user_id AND ${SEEDED_USER})) AS 사람
       FROM structured.reviews r`,
  );
  await count(
    '업체가 시드인 후기',
    `SELECT count(*) AS 건수 FROM structured.reviews r
      WHERE EXISTS (SELECT 1 FROM structured.vendor_source_records s
                     WHERE s.vendor_id = r.vendor_id AND s.source_key = 'sample')`,
  );
  await count('웨딩', 'SELECT count(*) AS 건수 FROM structured.weddings');
  await count('제보(견적·결제)', 'SELECT count(*) AS 건수 FROM structured.quotes');
  await count(
    '업체가 시드인 제보',
    `SELECT count(*) AS 건수 FROM structured.quotes q
      WHERE EXISTS (SELECT 1 FROM structured.vendor_source_records s
                     WHERE s.vendor_id = q.vendor_id AND s.source_key = 'sample')`,
  );
  await count(
    '시드 표시가 붙은 업체',
    `SELECT count(*) AS 건수 FROM structured.vendor_source_records WHERE source_key = 'sample'`,
  );

  /*
   * 보존 3건 규칙(docs/retention-policy.md)이 겨누는 표들이다. 운영 데이터가 아니라
   * **수집·사용량 이력**이고, 오래된 것을 지우는 계획이 여기 숫자를 근거로 선다.
   *
   * DB에서 행을 지우는 것은 되돌릴 수 없다. 그래서 지우기 전에 여기서 먼저 세고,
   * 계획서의 숫자와 맞는지 확인한 뒤 사용자 승인을 받는다. **이 스크립트는 세기만 한다.**
   *
   * 가장 오래된 것과 가장 새것의 시각을 함께 찍는 것은, 건수만으로는 「90일 보존」 같은
   * 기준이 몇 건을 지우게 되는지 알 수 없기 때문이다. 시각은 UTC로 담기고 UTC로 찍는다 —
   * 사람에게 말할 때만 KST로 바꾼다.
   */
  console.log('\n보존 대상 이력 — 지우지 않는다, 세기만 한다');
  await count(
    '수집 실행(import_runs)',
    `SELECT count(*) AS 건수, min(started_at) AS 가장오래됨, max(started_at) AS 가장최근
       FROM structured.import_runs`,
  );
  await count(
    '수집 실행 · 출처별',
    `SELECT source_key AS 출처, count(*) AS 건수
       FROM structured.import_runs GROUP BY source_key ORDER BY count(*) DESC`,
  );
  await count('수집 오류(import_errors)', 'SELECT count(*) AS 건수 FROM structured.import_errors');
  await count(
    '출처 원본 행(vendor_source_records)',
    'SELECT count(*) AS 건수, count(DISTINCT vendor_id) AS 업체수 FROM structured.vendor_source_records',
  );
  await count(
    '모델 사용량(ai_usage)',
    `SELECT count(*) AS 건수, min(requested_at) AS 가장오래됨, max(requested_at) AS 가장최근
       FROM structured.ai_usage`,
  );
  await count('요금 스냅샷(infra_costs)', 'SELECT count(*) AS 건수 FROM structured.infra_costs');
  await count('광고 개시 보고서(ads.launch_reports)', 'SELECT count(*) AS 건수 FROM ads.launch_reports');
  await count(
    '업체 변경 이력(vendor_change_log)',
    'SELECT count(*) AS 건수 FROM structured.vendor_change_log',
  );

  await pool.end();
}

main().catch((error: Error) => {
  console.error(`::error::조회 실패: ${error.message.split('\n')[0]}`);
  process.exit(1);
});
