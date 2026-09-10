import type { Pool, PoolClient } from 'pg';
import { withTransaction } from '../db';
import { contentHash, type CollectedVendor } from './collect';

type Existing = {
  id: string; name: string; region: string; category: string; source: string;
  source_url: string | null; data_published_at: string | null; admin_locked: boolean;
};

export function replacementDecision(old: Existing, incoming: CollectedVendor): 'same' | 'update' | 'hold' {
  if (old.admin_locked) return 'hold';
  if (old.name === incoming.name && old.region === incoming.region && old.category === incoming.category) return 'same';
  // A snapshot date is not a comparable field modification timestamp across providers.
  if (old.source_url !== incoming.sourceUrl || old.category !== incoming.category
    || !old.data_published_at || !incoming.publishedOn || incoming.publishedOn <= old.data_published_at) return 'hold';
  return 'update';
}

type HoldReason = 'admin_locked' | 'multiple_matches' | 'ambiguous_name' | 'insert_conflict' | 'field_conflict';

/**
 * 보류를 남긴다. 전에는 그냥 `return 'held'`로 끝나서 무엇이 왜 걸렸는지
 * 아무 데도 안 남았다 — 건수만 skipped_count에 뭉쳐 들어갔다. 보류는 대부분
 * 사람이 봐야 하는 것이라, 되살릴 수 없으면 없는 것과 같다.
 *
 * 여기 쓰는 트랜잭션은 그대로 커밋된다 — 보류는 실패가 아니라 판정이다.
 */
async function holdRecord(client: PoolClient, v: CollectedVendor, runId: string, recordKey: string,
  reason: HoldReason, vendorId?: string, field?: { name: string; old: string | null; next: string | null }) {
  await client.query(`INSERT INTO structured.vendor_import_holds
    (import_run_id,source_key,record_key,vendor_id,reason,field_name,old_value,new_value)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [runId, v.sourceKey, recordKey, vendorId ?? null, reason, field?.name ?? null, field?.old ?? null, field?.next ?? null]);
  return 'held' as const;
}

async function syncOne(client: PoolClient, v: CollectedVendor, runId: string) {
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
  if (selected.rows.length > 1) return holdRecord(client, v, runId, recordKey, 'multiple_matches');
  let old = selected.rows[0];
  // Existing aliases and region granularity differences require verification, not duplicate creation.
  if (!old) {
    const ambiguous = await client.query<{ id: string }>(
      `SELECT v.id FROM structured.vendors v LEFT JOIN structured.vendor_aliases a ON a.vendor_id=v.id
        WHERE v.normalized_name=structured.normalize_vendor_name($1)
           OR a.normalized_alias=structured.normalize_vendor_name($1) LIMIT 1`, [v.name]);
    if (ambiguous.rowCount) return holdRecord(client, v, runId, recordKey, 'ambiguous_name', ambiguous.rows[0]?.id);
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
    if (!old) return holdRecord(client, v, runId, recordKey, 'insert_conflict');
    action = 'created';
    for (const [field, value] of Object.entries({name:v.name,region:v.region,category:v.category,source_url:v.sourceUrl})) {
      await client.query(`INSERT INTO structured.vendor_change_log(vendor_id,field_name,new_value,cause,import_run_id)
        VALUES($1,$2,$3,'import',$4)`, [old.id,field,value,runId]);
    }
  } else {
    const decision = replacementDecision(old, v);
    if (decision === 'hold') {
      // 잠금과 값 충돌은 사람이 할 일이 다르다 — 잠금은 풀지 말지를, 충돌은 어느 쪽이
      // 맞는지를 정해야 한다. 업종 변경이 vendor_change_log에 안 남는 것도 이 자리다.
      const changed = (['category', 'name', 'region'] as const).find((f) => old![f] !== v[f]);
      return old.admin_locked
        ? holdRecord(client, v, runId, recordKey, 'admin_locked', old.id)
        : holdRecord(client, v, runId, recordKey, 'field_conflict', old.id,
            changed ? { name: changed, old: old[changed], next: v[changed] } : undefined);
    }
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
  /*
   * 다시 나타났으면 되살린다.
   *
   * `vendor-retire-missing`이 「응답에 없다」로 끊은 업체는 원천 매핑을 그대로 남긴다.
   * 그 업체가 다음 수집에 다시 잡히면 여기로 온다 — 되살리지 않으면 영영 안 보이는
   * 채로 남는다. 상권정보는 폐업을 알려주지 않으므로 「없었다가 다시 있다」는
   * 「잠깐 못 받았다」인 경우가 많고, 그것을 되돌릴 자리가 여기밖에 없다.
   *
   * 조건 셋이 전부 맞을 때만 손댄다. `collection_status='closed'`는 **수집이 끊었다**는
   * 표시이므로, 사람이 다른 이유로 내린 업체(그 표시가 없다)는 되살아나지 않는다.
   */
  const revived = await client.query(
    `UPDATE structured.vendors SET is_active=true, closed_at=NULL, collection_status='needs_verification'
      WHERE id=$1 AND admin_locked=false AND is_active=false AND collection_status='closed'`, [old.id]);
  if (revived.rowCount) {
    await client.query(`INSERT INTO structured.vendor_change_log
      (vendor_id,field_name,old_value,new_value,cause,import_run_id)
      VALUES($1,'collection_status','closed','needs_verification','import',$2)`, [old.id, runId]);
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

export async function syncCollected(pool: Pool, vendors: CollectedVendor[]) {
  const counts = { created:0, updated:0, unchanged:0, held:0, errors:0 };
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
        counts[action]++;
      } catch {
        counts.errors++;
        // Never copy raw DB errors/rows (which may contain personal information) into logs.
        await pool.query(`INSERT INTO structured.import_errors(run_id,error_type,error_message)
          VALUES($1,'sync_error','공공데이터 반영 실패: 스키마·중단 스위치·충돌 확인')`, [runId]);
      }
    }
  } finally {
    await pool.query(`UPDATE structured.import_runs SET status=$2,created_count=$3,updated_count=$4,
      skipped_count=$5,error_count=$6,finished_at=now() WHERE id=$1`,
      [runId,counts.errors ? 'failed':'completed',counts.created,counts.updated,counts.unchanged+counts.held,counts.errors]);
  }
  return counts;
}
