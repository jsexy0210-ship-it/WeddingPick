/**
 * 공공데이터 수집이 **무엇을 바꿨는지** 본다. 아무것도 바꾸지 않는다.
 *
 * 왜 별도 도구인가 — `structured.vendor_change_log`는 0048부터 있었고 sync가
 * 수집 때마다 이름 · 지역 · 업종 · 출처주소를 `cause='import'`로 적어왔다.
 * **그런데 그걸 읽는 것이 하나도 없었다.** 적히기만 하고 아무도 안 보는 표였다.
 *
 * 나누어 보여주는 이유는 세 가지가 사람이 할 일이 서로 다르기 때문이다:
 *
 *   이름이 바뀐 것    상호 변경인지 다른 업체를 잘못 붙인 것인지 봐야 한다
 *   지역이 바뀐 것    이전인지 주소 표기가 달라진 것인지 봐야 한다
 *   보류된 것        수집이 판단을 포기한 것이다. 사람이 정해야 한다
 *
 * **업종이 바뀐 것은 변경이 아니라 보류에 있다.** `replacementDecision`이 업종이
 * 다르면 곧바로 'hold'로 빠뜨리므로(sync.ts) vendor_change_log에는 만들어질 때를
 * 빼면 업종 행이 들어오지 않는다. 두 곳을 다 읽어야 답이 나온다.
 *
 * 출력은 집계 숫자 · 사유 이름 · vendor_id뿐이다. **업체명과 바뀐 값은 찍지 않는다** —
 * 이 로그는 GitHub Actions에 남고, 남으면 지우기 어렵다(db-inventory.ts와 같은 이유).
 * 무엇이 무엇으로 바뀌었는지는 vendor_id로 관리자에서 연다.
 *
 *   npx tsx scripts/vendor-collection-monitor.ts
 *   npx tsx scripts/vendor-collection-monitor.ts --days 30 --source sbiz-all
 */
import { Pool } from 'pg';

const url = process.env.DATABASE_URL;

if (!url) {
  console.error('::error::DATABASE_URL이 없다.');
  process.exit(1);
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
}

/** 며칠치를 볼 것인가. 주 1회 실행이 전제라 기본값은 그 두 배로 둔다. */
const DAYS = Number(arg('--days') ?? 14);
/** 비우면 모든 출처. */
const SOURCE = arg('--source') ?? null;
/** 목록으로 찍을 최대 줄 수. 넘으면 건수만 남긴다 — 로그가 수천 줄이 되면 아무도 안 읽는다. */
const MAX_ROWS = 40;

if (!Number.isFinite(DAYS) || DAYS <= 0) {
  console.error('::error::--days는 1 이상의 숫자여야 한다.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: url.includes('localhost') || url.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
});

const SINCE = `now() - ($1 || ' days')::interval`;

function heading(text: string): void {
  console.log(`\n${text}`);
  console.log('─'.repeat(text.length + 8));
}

async function runs(): Promise<string[]> {
  heading(`최근 ${DAYS}일 수집 실행`);

  const { rows } = await pool.query<{
    id: string; source_key: string; status: string; started_at: string;
    created_count: number; updated_count: number; skipped_count: number; error_count: number;
  }>(
    `SELECT id, source_key, status, to_char(started_at,'MM-DD HH24:MI') AS started_at,
            created_count, updated_count, skipped_count, error_count
       FROM structured.import_runs
      WHERE started_at >= ${SINCE}
        AND ($2::text IS NULL OR source_key = $2)
      ORDER BY started_at DESC`,
    [String(DAYS), SOURCE],
  );

  if (rows.length === 0) {
    console.log('  실행 없음.');
    return [];
  }

  console.log('  시각         출처            상태        새로  바뀜  넘김  실패');
  for (const r of rows.slice(0, MAX_ROWS)) {
    console.log(
      `  ${r.started_at}  ${r.source_key.padEnd(14)}  ${r.status.padEnd(10)}` +
        `  ${String(r.created_count).padStart(4)}  ${String(r.updated_count).padStart(4)}` +
        `  ${String(r.skipped_count).padStart(4)}  ${String(r.error_count).padStart(4)}`,
    );
  }
  if (rows.length > MAX_ROWS) console.log(`  … 그 밖 ${rows.length - MAX_ROWS}건`);

  return rows.map((r) => r.id);
}

/**
 * 무엇이 바뀌었나. 업체가 **처음 만들어질 때도** 네 필드가 전부 적히므로
 * (sync.ts의 created 분기), 그것까지 「바뀌었다」로 세면 신규 수집 때마다
 * 수천 건이 바뀐 것처럼 보인다. old_value가 있는 행만 실제 변경이다.
 */
async function changes(): Promise<void> {
  heading(`최근 ${DAYS}일 변경`);

  const { rows } = await pool.query<{ field_name: string; 변경: string; 신규: string; 업체수: string }>(
    `SELECT c.field_name,
            count(*) FILTER (WHERE c.old_value IS NOT NULL) AS 변경,
            count(*) FILTER (WHERE c.old_value IS NULL)     AS 신규,
            count(DISTINCT c.vendor_id) FILTER (WHERE c.old_value IS NOT NULL) AS 업체수
       FROM structured.vendor_change_log c
       LEFT JOIN structured.import_runs r ON r.id = c.import_run_id
      WHERE c.cause = 'import' AND c.changed_at >= ${SINCE}
        AND ($2::text IS NULL OR r.source_key = $2)
      GROUP BY c.field_name
      ORDER BY 2 DESC, 1`,
    [String(DAYS), SOURCE],
  );

  const label: Record<string, string> = {
    name: '이름이 바뀐 것', region: '지역이 바뀐 것',
    category: '업종이 바뀐 것', source_url: '출처 주소가 바뀐 것',
    collection_status: '다시 나타나 되살린 것',
  };

  if (rows.length === 0) {
    console.log('  기록 없음.');
  } else {
    for (const r of rows) {
      console.log(`  ${(label[r.field_name] ?? r.field_name).padEnd(20)} ${String(r.변경).padStart(5)}건` +
        `  (업체 ${r.업체수}곳 · 새로 등록되며 적힌 것 ${r.신규}건은 뺀 수)`);
    }
  }

  // 업종 행은 만들어질 때만 적힌다. 0이 「업종이 안 바뀌었다」로 읽히면 안 된다.
  if (!rows.some((r) => r.field_name === 'category' && Number(r.변경) > 0)) {
    console.log('\n  업종 변경은 위에 안 잡힌다 — 업종이 다르면 수집이 반영하지 않고 보류로 넘긴다.');
    console.log('  아래 「보류」의 field_conflict · category를 본다.');
  }

  const { rows: vendors } = await pool.query<{ vendor_id: string; 필드: string }>(
    `SELECT c.vendor_id, string_agg(DISTINCT c.field_name, ',' ORDER BY c.field_name) AS 필드
       FROM structured.vendor_change_log c
       LEFT JOIN structured.import_runs r ON r.id = c.import_run_id
      WHERE c.cause = 'import' AND c.changed_at >= ${SINCE} AND c.old_value IS NOT NULL
        AND ($2::text IS NULL OR r.source_key = $2)
      GROUP BY c.vendor_id
      ORDER BY 2, 1
      LIMIT ${MAX_ROWS + 1}`,
    [String(DAYS), SOURCE],
  );

  if (vendors.length) {
    console.log('\n  바뀐 업체 (vendor_id · 바뀐 필드)');
    for (const v of vendors.slice(0, MAX_ROWS)) console.log(`    ${v.vendor_id}  ${v.필드}`);
    if (vendors.length > MAX_ROWS) console.log(`    … 더 있다. --days를 줄여 좁힌다`);
  }
}

/**
 * 사람이 정해야 하는 것. 0098 이전 실행은 이 표에 아무것도 없다 —
 * 그때는 보류가 기록되지 않았고, 없는 것을 있는 것처럼 보이면 안 된다.
 */
async function holds(): Promise<void> {
  heading(`최근 ${DAYS}일 보류 — 사람 확인 필요`);

  const exists = await pool.query<{ n: string }>(
    `SELECT count(*) AS n FROM information_schema.tables
      WHERE table_schema='structured' AND table_name='vendor_import_holds'`,
  );
  if (exists.rows[0]?.n === '0') {
    console.log('  보류 표가 아직 없다 — 0098 마이그레이션이 적용되지 않은 DB다.');
    return;
  }

  const { rows } = await pool.query<{ reason: string; field_name: string | null; 건수: string }>(
    `SELECT reason, field_name, count(*) AS 건수
       FROM structured.vendor_import_holds
      WHERE created_at >= ${SINCE} AND ($2::text IS NULL OR source_key = $2)
      GROUP BY reason, field_name
      ORDER BY 3 DESC`,
    [String(DAYS), SOURCE],
  );

  const why: Record<string, string> = {
    admin_locked: '사람이 잠근 업체를 수집이 덮으려 했다',
    multiple_matches: '같은 이름·지역 후보가 둘 이상이다',
    ambiguous_name: '기존 업체·별칭과 이름이 겹친다',
    insert_conflict: '넣는 순간 같은 이름이 먼저 들어갔다',
    field_conflict: '값이 달라졌는데 더 최신이라는 근거가 없다',
  };

  if (rows.length === 0) {
    console.log('  보류 없음.');
    return;
  }

  for (const r of rows) {
    const field = r.field_name ? ` · ${r.field_name}` : '';
    console.log(`  ${(r.reason + field).padEnd(28)} ${String(r.건수).padStart(5)}건   ${why[r.reason] ?? ''}`);
  }

  const { rows: list } = await pool.query<{ vendor_id: string | null; reason: string; field_name: string | null }>(
    `SELECT DISTINCT vendor_id, reason, field_name
       FROM structured.vendor_import_holds
      WHERE created_at >= ${SINCE} AND ($2::text IS NULL OR source_key = $2)
      ORDER BY 2, 3, 1
      LIMIT ${MAX_ROWS + 1}`,
    [String(DAYS), SOURCE],
  );

  console.log('\n  보류된 업체 (vendor_id · 사유)');
  for (const h of list.slice(0, MAX_ROWS)) {
    console.log(`    ${h.vendor_id ?? '(업체 없음)'.padEnd(36)}  ${h.reason}${h.field_name ? ` · ${h.field_name}` : ''}`);
  }
  if (list.length > MAX_ROWS) console.log('    … 더 있다. --days를 줄여 좁힌다');
}

async function main(): Promise<void> {
  console.log(`업체 수집 모니터 — 읽기만 한다  (출처: ${SOURCE ?? '전체'})`);
  await runs();
  await changes();
  await holds();
  console.log('');
  await pool.end();
}

main().catch((error: Error) => {
  console.error(`::error::실패: ${error.message.split('\n')[0]}`);
  process.exit(1);
});
