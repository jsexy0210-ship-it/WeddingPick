/**
 * 이번 수집 응답에 **없어진** 업체를 정리한다. 확인이 기본이고, `--yes`에만 실제로 쓴다.
 *
 * 왜 조심해야 하는가 — 상권정보 API는 폐업을 알려주지 않는다. 「응답에 없다」가 우리가
 * 가진 유일한 신호인데, 그 신호는 두 가지를 똑같이 만든다:
 *
 *   정말 없어졌다        지워도 되는 것
 *   이번에 못 받았다      지우면 안 되는 것
 *
 * 둘을 가르는 근거가 리포트의 `truncated`다(run.ts). 상한에 걸려 다 못 받은 업종코드가
 * 하나라도 있으면 그 수집으로는 아무것도 판정할 수 없다 — 그래서 거부한다.
 * 비율도 본다. 아는 업체의 10%가 한 주에 동시에 폐업하는 일은 없다. 그런 수가 나오면
 * 폐업이 아니라 수집 사고이므로 역시 거부한다.
 *
 * 없어졌다고 판정해도 전부 지우지는 않는다. `structured.vendors`를 지우면 후기 ·
 * 제보 · Pick 후보 · 결정이 CASCADE로 같이 사라진다(0020 · 0021 · 0026 · 0041).
 * 사람이 남긴 것을 업체가 문 닫았다는 이유로 지울 수는 없다. 그런 업체는 지우지 않고
 * **노출만 멈춘다** — 자료는 그대로 남는다.
 *
 * 멈추는 자리는 0047이 이 일을 하라고 만들어 둔 `is_active` · `closed_at`이다.
 * 「폐업 감지 시 false로 전환하고 closed_at을 기록한다. 즉시 삭제하지 않는다」가
 * 그 컬럼에 붙은 설명이고, 지금 하려는 것이 정확히 그것이다. `collection_status`는
 * **수집이 무엇이라고 봤는지**를 적는 자리라 함께 'closed'로 둔다 — 노출을 가르는 것은
 * 앞의 둘이고, 뒤의 하나는 왜 그렇게 됐는지의 근거다.
 *
 * 출력은 건수와 사유뿐이다. 업체명은 찍지 않는다(db-inventory.ts와 같은 이유).
 *
 *   확인만:  npx tsx scripts/vendor-retire-missing.ts --source sbiz-all --collection .collection
 *   실제로:  npx tsx scripts/vendor-retire-missing.ts --source sbiz-all --collection .collection --yes
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

const SOURCE = arg('--source');
const DIR = arg('--collection') ?? '.collection';
const APPLY = process.argv.includes('--yes');

if (!SOURCE) {
  console.error('::error::--source가 필요하다. 어느 출처의 수집 응답과 맞춰볼 것인지 정해야 한다.');
  process.exit(1);
}

/**
 * 한 번에 사라졌다고 인정할 최대 비율. 이 선을 넘으면 폐업이 아니라 수집이 잘못된 것이다.
 * 넘기고 싶으면 이 수를 고치는 게 아니라 수집이 왜 그랬는지를 먼저 본다.
 */
const MAX_MISSING_RATIO = 0.1;

const pool = new Pool({
  connectionString: url,
  ssl: url.includes('localhost') || url.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
});

type Report = { source: string; accepted: number; total: number; truncated: { code: string; reason: string }[] };
type Collected = { vendors: { name: string; region: string; sourceRecordId?: string | null }[] };

/** 이번 응답을 판정에 쓸 수 있는지 먼저 가른다. 못 쓰면 여기서 끝난다. */
function loadCollection(): Set<string> {
  let report: Report;
  let collected: Collected;
  try {
    report = JSON.parse(readFileSync(join(DIR, `${SOURCE}-report.json`), 'utf8')) as Report;
    collected = JSON.parse(readFileSync(join(DIR, `${SOURCE}.json`), 'utf8')) as Collected;
  } catch (error) {
    console.error(`::error::${DIR}에서 '${SOURCE}' 수집 결과를 읽지 못했다: ${(error as Error).message.split('\n')[0]}`);
    console.error('먼저 같은 실행에서 수집을 돌려야 한다 — 지난주 파일로 이번 폐업을 판정하지 않는다.');
    process.exit(1);
  }

  const truncated = report.truncated ?? [];
  if (truncated.length) {
    console.error(`::error::이번 수집은 전수가 아니다 — 상한에 걸린 업종코드 ${truncated.length}개.`);
    console.error('전수가 아닌 응답에서 「없다」는 폐업이 아니라 못 받은 것이다. 아무것도 판정하지 않는다.');
    process.exit(1);
  }

  if (!report.accepted || report.accepted === 0) {
    console.error('::error::이번 수집이 0건이다. 「전부 없어졌다」로 읽힐 응답으로는 판정하지 않는다.');
    process.exit(1);
  }

  // sync.ts가 쓰는 식별키와 같은 규칙이어야 한다. 다르면 전부 사라진 것으로 보인다.
  return new Set(collected.vendors.map((v) => v.sourceRecordId ?? `${v.name}|${v.region}`));
}

type Row = {
  vendor_id: string;
  admin_locked: boolean;
  manual_source: boolean;
  claimed: boolean;
  other_source: boolean;
  attached: boolean;
  already_closed: boolean;
};

async function main(): Promise<void> {
  console.log(`없어진 업체 정리 — 출처 ${SOURCE}${APPLY ? '' : ' (확인만)'}\n`);

  const present = loadCollection();
  console.log(`이번 응답  ${present.size}건`);

  const { rows: known } = await pool.query<{ record_key: string }>(
    'SELECT record_key FROM structured.vendor_source_records WHERE source_key = $1',
    [SOURCE],
  );
  console.log(`DB가 아는 것  ${known.length}건`);

  if (known.length === 0) {
    console.log('\n이 출처로 반영된 업체가 없다. 할 일이 없다.');
    await pool.end();
    return;
  }

  const missing = known.map((r) => r.record_key).filter((key) => !present.has(key));
  const ratio = missing.length / known.length;
  console.log(`응답에 없는 것  ${missing.length}건  (${(ratio * 100).toFixed(1)}%)`);

  if (missing.length === 0) {
    console.log('\n사라진 것이 없다.');
    await pool.end();
    return;
  }

  if (ratio > MAX_MISSING_RATIO) {
    console.error(
      `\n::error::한 번에 ${(ratio * 100).toFixed(1)}%가 사라졌다 — 상한 ${(MAX_MISSING_RATIO * 100).toFixed(0)}%.`,
    );
    console.error('이만큼이 동시에 폐업하지는 않는다. 폐업이 아니라 수집을 의심한다. 아무것도 바꾸지 않는다.');
    await pool.end();
    process.exit(1);
  }

  /*
   * 같은 업체가 이 출처에서 다른 키로 아직 잡히면 사라진 것이 아니다 —
   * 상가업소번호가 바뀌었을 뿐이다. 그런 업체는 후보에서 뺀다.
   */
  const { rows } = await pool.query<Row>(
    `WITH gone AS (SELECT unnest($2::text[]) AS record_key)
     SELECT DISTINCT v.id AS vendor_id,
            v.admin_locked,
            v.source <> 'public_data' AS manual_source,
            NOT coalesce(v.is_active, true) AS already_closed,
            EXISTS(SELECT 1 FROM structured.vendor_claims c
                    WHERE c.vendor_id = v.id AND c.status = 'approved') AS claimed,
            EXISTS(SELECT 1 FROM structured.vendor_source_records o
                    WHERE o.vendor_id = v.id
                      AND (o.source_key <> $1 OR NOT (o.record_key = ANY($2::text[])))) AS other_source,
            (EXISTS(SELECT 1 FROM structured.reviews x WHERE x.vendor_id = v.id)
          OR  EXISTS(SELECT 1 FROM structured.price_reports x WHERE x.vendor_id = v.id)
          OR  EXISTS(SELECT 1 FROM structured.vendor_candidates x WHERE x.vendor_id = v.id)
          OR  EXISTS(SELECT 1 FROM structured.category_decisions x WHERE x.vendor_id = v.id)
          OR  EXISTS(SELECT 1 FROM structured.vendor_corrections x WHERE x.vendor_id = v.id)
          OR  EXISTS(SELECT 1 FROM ads.placements x WHERE x.vendor_id = v.id)) AS attached
       FROM gone g
       JOIN structured.vendor_source_records r ON r.source_key = $1 AND r.record_key = g.record_key
       JOIN structured.vendors v ON v.id = r.vendor_id`,
    [SOURCE, missing],
  );

  const protectedFrom = (r: Row) => r.admin_locked || r.claimed || r.other_source || r.manual_source;
  const keep = rows.filter(protectedFrom);
  const rest = rows.filter((r) => !protectedFrom(r));
  const close = rest.filter((r) => r.attached && !r.already_closed);
  const closed = rest.filter((r) => r.attached && r.already_closed);
  const remove = rest.filter((r) => !r.attached);

  console.log('\n무엇을 할 것인가');
  console.log(`  손대지 않는다      ${String(keep.length).padStart(5)}곳`);
  console.log(`    · 사람이 잠갔다        ${rows.filter((r) => r.admin_locked).length}`);
  console.log(`    · 업체가 확인했다      ${rows.filter((r) => r.claimed).length}`);
  console.log(`    · 다른 자리에 아직 있다 ${rows.filter((r) => r.other_source).length}`);
  console.log(`    · 수집이 만든 것이 아니다 ${rows.filter((r) => r.manual_source).length}`);
  console.log(`  노출만 멈춘다      ${String(close.length).padStart(5)}곳  (후기·제보·Pick·결정·광고가 매달려 있다)`);
  if (closed.length) console.log(`    · 이미 멈춰 있다      ${closed.length}`);
  console.log(`  지운다            ${String(remove.length).padStart(5)}곳  (매달린 것이 없다)`);

  if (!APPLY) {
    console.log('\n확인만 했다. 실제로 바꾸려면 --yes를 붙인다.');
    await pool.end();
    return;
  }

  // closed_at을 같이 넣지 않으면 vendors_closed_requires_date CHECK에 걸린다(0047).
  let stopped = 0;
  for (const r of close) {
    const { rowCount } = await pool.query(
      `UPDATE structured.vendors
          SET is_active = false, closed_at = coalesce(closed_at, now()), collection_status = 'closed'
        WHERE id = $1 AND admin_locked = false`,
      [r.vendor_id],
    );
    stopped += rowCount ?? 0;
  }

  /*
   * 지우는 순서가 중요하다. `vendor_source_records.vendor_id`의 FK에는 ON DELETE가
   * 없어(0071) 매핑이 남아 있으면 업체 삭제가 그대로 실패한다. 같은 트랜잭션에서
   * 매핑을 먼저 지운다. WHERE의 두 조건은 마지막 방어선이다 — 위에서 걸렀어도 다시 건다.
   */
  let deleted = 0;
  for (const r of remove) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM structured.vendor_source_records WHERE vendor_id = $1', [r.vendor_id]);
      const { rowCount } = await client.query(
        `DELETE FROM structured.vendors
          WHERE id = $1 AND admin_locked = false AND source = 'public_data'`,
        [r.vendor_id],
      );
      await client.query('COMMIT');
      deleted += rowCount ?? 0;
    } catch (error) {
      await client.query('ROLLBACK');
      // 원본 오류에는 행 값이 섞일 수 있어 그대로 남기지 않는다.
      console.log(`  한 곳 실패 — 넘어간다 (${(error as Error).message.split('\n')[0].slice(0, 60)})`);
    } finally {
      client.release();
    }
  }

  console.log(`\n바꿨다: 노출 멈춤 ${stopped}곳 · 삭제 ${deleted}곳.`);

  const { rows: after } = await pool.query<{ 업체: string; 멈춤: string }>(
    `SELECT count(*) AS 업체, count(*) FILTER (WHERE NOT coalesce(is_active, true)) AS 멈춤
       FROM structured.vendors`,
  );
  console.log(`남은 것: 업체 ${after[0]?.업체}곳 (그 중 노출 멈춤 ${after[0]?.멈춤}곳).`);

  await pool.end();
}

main().catch((error: Error) => {
  console.error(`::error::실패: ${error.message.split('\n')[0]}`);
  process.exit(1);
});
