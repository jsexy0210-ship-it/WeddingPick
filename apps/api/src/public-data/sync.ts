import type { Pool, PoolClient } from 'pg';
import { withTransaction } from '../db';
import { contentHash, type CollectedVendor } from './collect';

type Existing = {
  id: string; name: string; region: string; category: string; source: string;
  source_url: string | null; data_published_at: string | null; admin_locked: boolean;
};

/**
 * 보류 사유를 나눠서 돌려준다. 예전에는 셋 다 'hold' 하나였는데, 그러면 실행
 * 요약만 보고 «사람이 봐야 하는 건이 있는가»를 판단할 수 없다 —
 * `locked`(관리자가 잠근 정상 동작)와 `stale`(출처 날짜가 과거라 안 바꾼 정상
 * 동작)은 검토 대상이 아니고, 중복·모호(`held_ambiguous`)만 검토 대상이다.
 */
export function replacementDecision(old: Existing, incoming: CollectedVendor): 'same' | 'update' | 'locked' | 'stale' {
  if (old.admin_locked) return 'locked';
  if (old.name === incoming.name && old.region === incoming.region && old.category === incoming.category) return 'same';
  // A snapshot date is not a comparable field modification timestamp across providers.
  if (old.source_url !== incoming.sourceUrl || old.category !== incoming.category
    || !old.data_published_at || !incoming.publishedOn || incoming.publishedOn <= old.data_published_at) return 'stale';
  return 'update';
}

/** syncOne 한 건의 결과. held_* 는 반영하지 않고 넘긴 건이며 사유가 서로 다르다. */
type SyncOutcome = 'created' | 'updated' | 'unchanged'
  | 'held_locked' | 'held_stale' | 'held_ambiguous' | 'held_conflict';

const HELD_REASON = {
  held_locked: 'locked', held_stale: 'stale',
  held_ambiguous: 'ambiguous', held_conflict: 'conflict',
} as const;

async function syncOne(client: PoolClient, v: CollectedVendor, runId: string): Promise<SyncOutcome> {
  // Global import lock serializes concurrent provider runs; still rely on DB unique constraints.
  await client.query(`SELECT pg_advisory_xact_lock(7140904)`);
  const enabled = await client.query(`SELECT enabled FROM structured.import_switches WHERE source_key=$1`, [v.sourceKey]);
  if (enabled.rows[0]?.enabled !== true) throw new Error('SOURCE_DISABLED');
  const recordKey = v.sourceRecordId ?? `${v.name}|${v.region}`;
  const mapped = await client.query<{ vendor_id: string }>(
    `SELECT vendor_id FROM structured.vendor_source_records WHERE source_key=$1 AND record_key=$2`,
    [v.sourceKey, recordKey]);
  const selected = await client.query<Existing>(
    `SELECT v.id,v.name,v.region,v.category,v.source,v.source_url,
       GREATEST(v.data_published_at,(SELECT max(r.published_on) FROM structured.vendor_source_records r
         WHERE r.vendor_id=v.id AND r.source_url=v.source_url))::text AS data_published_at,v.admin_locked
       FROM structured.vendors v WHERE v.id=$1 OR (v.normalized_name=structured.normalize_vendor_name($2) AND v.region=$3)
       FOR UPDATE OF v`, [mapped.rows[0]?.vendor_id ?? null, v.name, v.region]);
  // 같은 이름·지역에 여러 행이 걸리면 지점인지 동명 업체인지 여기서 못 가른다.
  if (selected.rows.length > 1) return 'held_ambiguous';
  let old = selected.rows[0];
  // Existing aliases and region granularity differences require verification, not duplicate creation.
  if (!old) {
    const ambiguous = await client.query(
      `SELECT v.id FROM structured.vendors v LEFT JOIN structured.vendor_aliases a ON a.vendor_id=v.id
        WHERE v.normalized_name=structured.normalize_vendor_name($1)
           OR a.normalized_alias=structured.normalize_vendor_name($1) LIMIT 1`, [v.name]);
    if (ambiguous.rowCount) return 'held_ambiguous';
  }
  let action: 'created' | 'updated' | 'unchanged' = 'unchanged';
  if (!old) {
    const inserted = await client.query<Existing>(
      `INSERT INTO structured.vendors(category,name,region,source,source_url,data_published_at,last_verified_at,collection_status)
       VALUES($1,$2,$3,'public_data',$4,$5,$6,'needs_verification')
       ON CONFLICT(normalized_name,region) DO NOTHING
       RETURNING id,name,region,category,source,source_url,data_published_at::text,admin_locked`,
      [v.category,v.name,v.region,v.sourceUrl,v.publishedOn,v.collectedAt]);
    old = inserted.rows[0];
    if (!old) return 'held_conflict';
    action = 'created';
    for (const [field, value] of Object.entries({name:v.name,region:v.region,category:v.category,source_url:v.sourceUrl})) {
      await client.query(`INSERT INTO structured.vendor_change_log(vendor_id,field_name,new_value,cause,import_run_id)
        VALUES($1,$2,$3,'import',$4)`, [old.id,field,value,runId]);
    }
  } else {
    const decision = replacementDecision(old, v);
    if (decision === 'locked') return 'held_locked';
    if (decision === 'stale') return 'held_stale';
    if (decision === 'update') {
      for (const field of ['name','region'] as const) {
        if (old[field] === v[field]) continue;
        await client.query(`INSERT INTO structured.vendor_change_log(vendor_id,field_name,old_value,new_value,cause,import_run_id)
          VALUES($1,$2,$3,$4,'import',$5)`, [old.id,field,old[field],v[field],runId]);
      }
      await client.query(`UPDATE structured.vendors SET name=$2,region=$3,data_published_at=$4,last_verified_at=$5 WHERE id=$1`,
        [old.id,v.name,v.region,v.publishedOn,v.collectedAt]);
      action = 'updated';
    }
  }
  await client.query(`INSERT INTO structured.vendor_source_records
    (source_key,record_key,vendor_id,source_url,published_on,collected_at,content_hash)
    VALUES($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT(source_key,record_key) DO UPDATE SET collected_at=EXCLUDED.collected_at,
      published_on=CASE WHEN EXCLUDED.published_on >= vendor_source_records.published_on
        OR vendor_source_records.published_on IS NULL THEN EXCLUDED.published_on ELSE vendor_source_records.published_on END,
      content_hash=EXCLUDED.content_hash`,
    [v.sourceKey,recordKey,old.id,v.sourceUrl,v.publishedOn,v.collectedAt,contentHash(v)]);
  return action;
}

/**
 * 실행 요약. `held`는 합계고 `heldBy`가 사유별 내역이다 — 수동 검토 큐가
 * 필요한지는 `heldBy.ambiguous`(중복·모호 alias) 숫자로 판단한다. locked·stale은
 * 설계대로 안 바꾼 것이라 검토 대상이 아니다.
 */
export async function syncCollected(pool: Pool, vendors: CollectedVendor[]) {
  const counts = { created:0, updated:0, unchanged:0, held:0, errors:0,
    heldBy: { locked:0, stale:0, ambiguous:0, conflict:0 } };
  if (!vendors.length) return counts;
  const source = vendors[0]!;
  if (vendors.some((v) => v.sourceKey !== source.sourceKey)) throw new Error('출처별 실행을 분리하세요.');
  const run = await pool.query<{id:string}>(`INSERT INTO structured.import_runs(source_key,category,total_rows)
    VALUES($1,'mixed',$2) RETURNING id`, [source.sourceKey,vendors.length]);
  const runId = run.rows[0]!.id;
  try {
    for (const v of vendors) {
      try {
        const action = await withTransaction(pool, (client) => syncOne(client,v,runId));
        const heldReason = HELD_REASON[action as keyof typeof HELD_REASON];
        if (heldReason) { counts.held++; counts.heldBy[heldReason]++; }
        else counts[action as 'created'|'updated'|'unchanged']++;
      } catch {
        counts.errors++;
        // Never copy raw DB errors/rows (which may contain personal information) into logs.
        await pool.query(`INSERT INTO structured.import_errors(run_id,error_type,error_message)
          VALUES($1,'sync_error','공공데이터 반영 실패: 스키마·중단 스위치·충돌 확인')`, [runId]);
      }
    }
  } finally {
    // skipped_count는 기존 의미(반영 안 한 전체)를 유지하고, 그중 보류만 held_count로
    // 따로 남긴다 — 산출물 JSON은 7일 뒤 만료되므로 DB가 유일한 영구 기록이다.
    await pool.query(`UPDATE structured.import_runs SET status=$2,created_count=$3,updated_count=$4,
      skipped_count=$5,held_count=$6,error_count=$7,finished_at=now() WHERE id=$1`,
      [runId,counts.errors ? 'failed':'completed',counts.created,counts.updated,
       counts.unchanged+counts.held,counts.held,counts.errors]);
  }
  return counts;
}
