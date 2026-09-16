/**
 * 마케팅 작업 저장소.
 *
 * - 소재 등록/조회/비활성화
 * - 작업 생성·조회·이벤트 기록
 * - 예약 작업 모의 처리 (실제 외부 게시 없음, dry_run만 허용)
 * - FOR UPDATE SKIP LOCKED 로 동시 처리 충돌 방지
 */

import type { PoolClient } from 'pg';

import type { MarketingJob, MarketingSource } from '@weddingpick/api-contract';
import type { Db } from '../db';
import { generateContent } from './content';
import { notFound, ApiError } from '../errors';
import { withTransaction } from '../db';

const MAX_RETRY = 3;

// ── 소재 ────────────────────────────────────────────────────────────────────

export async function registerSource(
  db: Db,
  source: Omit<MarketingSource, 'reviewed' | 'reviewedAt'> & { reviewed?: boolean; reviewedAt?: string | null },
): Promise<void> {
  await db.query(
    `INSERT INTO marketing_sources
       (id, fact_ids, reviewed, reviewed_at, expires_at, next_verify_at, active, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO UPDATE SET
       fact_ids       = EXCLUDED.fact_ids,
       reviewed       = EXCLUDED.reviewed,
       reviewed_at    = EXCLUDED.reviewed_at,
       expires_at     = EXCLUDED.expires_at,
       next_verify_at = EXCLUDED.next_verify_at,
       active         = EXCLUDED.active,
       note           = EXCLUDED.note,
       updated_at     = NOW()`,
    [
      source.id,
      source.factIds,
      source.reviewed ?? false,
      source.reviewedAt ?? null,
      source.expiresAt ?? null,
      source.nextVerifyAt ?? null,
      source.active,
      source.note ?? null,
    ],
  );
}

export async function getSource(db: Db, id: string): Promise<MarketingSource | null> {
  const { rows } = await db.query<{
    id: string; fact_ids: string[]; reviewed: boolean; reviewed_at: string | null;
    expires_at: string | null; next_verify_at: string | null; active: boolean; note: string | null;
  }>('SELECT * FROM marketing_sources WHERE id = $1', [id]);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    factIds: r.fact_ids,
    reviewed: r.reviewed,
    reviewedAt: r.reviewed_at,
    expiresAt: r.expires_at,
    nextVerifyAt: r.next_verify_at,
    active: r.active,
    note: r.note ?? undefined,
  };
}

export async function listSources(db: Db): Promise<MarketingSource[]> {
  const { rows } = await db.query<{
    id: string; fact_ids: string[]; reviewed: boolean; reviewed_at: string | null;
    expires_at: string | null; next_verify_at: string | null; active: boolean; note: string | null;
  }>('SELECT * FROM marketing_sources ORDER BY created_at DESC');
  return rows.map((r) => ({
    id: r.id,
    factIds: r.fact_ids,
    reviewed: r.reviewed,
    reviewedAt: r.reviewed_at,
    expiresAt: r.expires_at,
    nextVerifyAt: r.next_verify_at,
    active: r.active,
    note: r.note ?? undefined,
  }));
}

export async function deactivateSource(db: Db, id: string): Promise<void> {
  await db.query(
    'UPDATE marketing_sources SET active = FALSE, updated_at = NOW() WHERE id = $1',
    [id],
  );
}

// ── 작업 ────────────────────────────────────────────────────────────────────

function rowToJob(r: Record<string, unknown>): MarketingJob {
  return {
    id: r['id'] as string,
    sourceId: r['source_id'] as string,
    channel: r['channel'] as MarketingJob['channel'],
    format: r['format'] as MarketingJob['format'],
    title: r['title'] as string,
    body: r['body'] as string,
    utmUrl: r['utm_url'] as string | null,
    status: r['status'] as MarketingJob['status'],
    scheduledAt: r['scheduled_at'] as string | null,
    simulatedAt: r['simulated_at'] as string | null,
    failedAt: r['failed_at'] as string | null,
    failReason: r['fail_reason'] as string | null,
    retryCount: r['retry_count'] as number,
    createdAt: r['created_at'] as string,
  };
}

export async function createJob(
  db: Db,
  params: {
    sourceId: string;
    channel: MarketingJob['channel'];
    format: MarketingJob['format'];
    title: string;
    body: string;
    utmUrl: string | null;
    scheduledAt?: string;
  },
): Promise<MarketingJob> {
  const { rows } = await db.query<Record<string, unknown>>(
    `INSERT INTO marketing_jobs (source_id, channel, format, title, body, utm_url, scheduled_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      params.sourceId,
      params.channel,
      params.format,
      params.title,
      params.body,
      params.utmUrl ?? null,
      params.scheduledAt ?? null,
    ],
  );
  return rowToJob(rows[0]!);
}

export async function getJob(db: Db, id: string): Promise<MarketingJob | null> {
  const { rows } = await db.query<Record<string, unknown>>(
    'SELECT * FROM marketing_jobs WHERE id = $1 AND deleted_at IS NULL',
    [id],
  );
  const r = rows[0];
  return r ? rowToJob(r) : null;
}

export async function listJobs(db: Db, limit = 50): Promise<MarketingJob[]> {
  const { rows } = await db.query<Record<string, unknown>>(
    'SELECT * FROM marketing_jobs WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1',
    [limit],
  );
  return rows.map(rowToJob);
}

export async function listJobEvents(
  db: Db,
  jobId: string,
): Promise<{ id: string; event_type: string; payload: unknown; created_at: string }[]> {
  const { rows } = await db.query<{
    id: string; event_type: string; payload: unknown; created_at: string;
  }>(
    'SELECT id, event_type, payload, created_at FROM marketing_events WHERE job_id = $1 ORDER BY created_at',
    [jobId],
  );
  return rows;
}

async function recordEvent(
  client: PoolClient,
  jobId: string,
  eventType: string,
  payload?: unknown,
): Promise<void> {
  await client.query(
    'INSERT INTO marketing_events (job_id, event_type, payload) VALUES ($1,$2,$3)',
    [jobId, eventType, payload ? JSON.stringify(payload) : null],
  );
}

/**
 * 예약 시각이 된 작업을 모의 처리한다.
 * dry_run만 허용 — 실제 외부 게시 없음.
 * FOR UPDATE SKIP LOCKED 로 동시 호출 충돌 방지.
 */
export async function processScheduled(db: Db, jobId?: string): Promise<{ ok: number; failed: number }> {
  const client = await db.connect();
  let ok = 0;
  let failed = 0;

  try {
    await client.query('BEGIN');
    const { rows } = await client.query<Record<string, unknown>>(
      `SELECT * FROM marketing_jobs
       WHERE status = 'queued' AND deleted_at IS NULL AND ($1::uuid IS NULL OR id=$1)
         AND (scheduled_at IS NULL OR scheduled_at <= NOW())
       ORDER BY scheduled_at NULLS LAST
       LIMIT 10
       FOR UPDATE SKIP LOCKED`, [jobId ?? null],
    );
    if (jobId && rows.length === 0) throw new ApiError('invalid_request', '지금 모의 실행할 수 있는 작업이 아니에요');

    for (const row of rows) {
      const job = rowToJob(row);

      // 실행 시점 소재 재검사
      const src = await getSource(db, job.sourceId);
      if (!src || !src.active) {
        await client.query(
          "UPDATE marketing_jobs SET status='failed', failed_at=NOW(), fail_reason=$1 WHERE id=$2",
          ['소재 비활성', job.id],
        );
        await recordEvent(client, job.id, 'failed', { reason: '소재 비활성' });
        failed++;
        continue;
      }

      const result = generateContent(src, job.channel, job.format, job.id);
      if (!result.ok) {
        const retryCount = job.retryCount + 1;
        if (retryCount >= MAX_RETRY) {
          await client.query(
            "UPDATE marketing_jobs SET status='failed', failed_at=NOW(), fail_reason=$1, retry_count=$2 WHERE id=$3",
            [result.error, retryCount, job.id],
          );
          await recordEvent(client, job.id, 'failed', { reason: result.error, retryCount });
          failed++;
        } else {
          await client.query(
            'UPDATE marketing_jobs SET retry_count=$1 WHERE id=$2',
            [retryCount, job.id],
          );
          await recordEvent(client, job.id, 'retry', { reason: result.error, retryCount });
        }
        continue;
      }

      // 실행 전 출처만 다시 검증한다. 관리자가 검토·수정한 본문을 재생성으로 덮지 않는다.

      await client.query(
        "UPDATE marketing_jobs SET status='simulated', simulated_at=NOW() WHERE id=$1",
        [job.id],
      );
      await recordEvent(client, job.id, 'simulated', { mode: 'dry_run' });
      ok++;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { ok, failed };
}

/** 실패 작업 재시도 */
export async function retryJob(db: Db, id: string): Promise<void> {
  const result = await db.query(
    "UPDATE marketing_jobs SET status='queued', failed_at=NULL, fail_reason=NULL, retry_count=0 WHERE id=$1 AND status='failed' AND deleted_at IS NULL RETURNING id",
    [id],
  );
  if (!result.rows[0]) throw new ApiError('invalid_request', '실패한 작업만 다시 실행할 수 있어요');
}

/** 마케팅 요약 통계 */
export async function getSummary(
  db: Db,
): Promise<{ generated: number; simulated: number; failed: number; failRate: number }> {
  const { rows } = await db.query<{ status: string; cnt: string }>(
    'SELECT status, COUNT(*) AS cnt FROM marketing_jobs WHERE deleted_at IS NULL GROUP BY status',
  );
  const map = Object.fromEntries(rows.map((r) => [r.status, Number(r.cnt)]));
  const generated = Object.values(map).reduce((a, b) => a + b, 0);
  const simulated = map['simulated'] ?? 0;
  const failed = map['failed'] ?? 0;
  return {
    generated,
    simulated,
    failed,
    failRate: generated > 0 ? failed / generated : 0,
  };
}

export async function editJob(db: Db, id: string, input: { title: string; body: string }, by: string): Promise<void> {
  await withTransaction(db, async (client) => {
    const result = await client.query(`UPDATE marketing_jobs SET title=$2,body=$3,status='queued',
      simulated_at=NULL,failed_at=NULL,fail_reason=NULL,retry_count=0 WHERE id=$1 AND deleted_at IS NULL RETURNING id`,
    [id, input.title, input.body]);
    if (!result.rows[0]) throw notFound('마케팅 소재');
    await recordEvent(client, id, 'edited', { by });
  });
}

export async function deleteJob(db: Db, id: string, by: string): Promise<void> {
  await withTransaction(db, async (client) => {
    const result = await client.query('UPDATE marketing_jobs SET deleted_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id', [id]);
    if (!result.rows[0]) throw notFound('마케팅 소재');
    await recordEvent(client, id, 'deleted', { by });
  });
}
