import type { Pool } from 'pg';

import { withTransaction } from '../db';
import type { Storage } from '../storage/port';

export type RetentionDeps = {
  pool: Pool;
  storage: Storage;
};

type ExpiredDocument = {
  id: string;
  storage_keys: string[];
};

export type SweepResult = {
  deleted: number;
  failed: number;
};

/**
 * 보관 기간이 지난 원본을 지운다. 서비스정책서 4번.
 *
 * 지우는 것은 **파일**이고, 문서 행은 남긴다. 언제 무엇을 지웠는지가 파기 기록이 된다
 * (법률검토 체크리스트 — 파기 절차와 로그 보관).
 *
 * 구조화 데이터는 그대로다. 핵심 자산은 원본이 아니라 구조화된 거래 데이터다
 * (사업계획서 28번).
 */
export async function sweepExpiredDocuments(
  deps: RetentionDeps,
  limit = 50
): Promise<SweepResult> {
  const { rows } = await deps.pool.query<ExpiredDocument>(
    'SELECT id, storage_keys FROM originals.expired_documents ORDER BY retention_until LIMIT $1',
    [limit]
  );

  let deleted = 0;
  let failed = 0;

  for (const document of rows) {
    try {
      // 파일부터 지운다. 여기서 실패하면 기록을 바꾸지 않아 다음 차례에 다시 시도한다.
      for (const key of document.storage_keys) {
        await deps.storage.delete(key);
      }

      await withTransaction(deps.pool, async (client) => {
        await client.query(
          `UPDATE originals.raw_documents
           SET status = 'deleted', deleted_at = now()
           WHERE id = $1`,
          [document.id]
        );

        // 키가 남아 있으면 없는 파일을 가리키게 된다.
        await client.query('DELETE FROM originals.raw_document_pages WHERE raw_document_id = $1', [
          document.id,
        ]);
      });

      deleted += 1;
    } catch (error) {
      // 자동삭제 실패는 사람이 봐야 한다. 조용히 넘어가지 않는다.
      await deps.pool.query(
        `UPDATE originals.raw_documents
         SET status = 'delete_failed', delete_attempts = delete_attempts + 1
         WHERE id = $1`,
        [document.id]
      );

      failed += 1;
      console.error(`원본 삭제 실패 (${document.id}):`, error);
    }
  }

  return { deleted, failed };
}

/** 손이 필요한 문서들. 운영자가 확인한다. */
export async function listFailedDeletions(pool: Pool): Promise<{ id: string; attempts: number }[]> {
  const { rows } = await pool.query<{ id: string; delete_attempts: number }>(
    `SELECT id, delete_attempts FROM originals.raw_documents
     WHERE status = 'delete_failed' ORDER BY delete_attempts DESC`
  );

  return rows.map((row) => ({ id: row.id, attempts: row.delete_attempts }));
}

export type AttentionReason = 'delete_failed' | 'unreachable';

export type AttentionDocument = {
  id: string;
  ownerUserId: string;
  retentionUntil: Date;
  attempts: number;
  personalInfoKinds: string[];
  reason: AttentionReason;
};

/**
 * 사람 손이 필요한 원본 전부. 서비스정책서 4번의 수동 처리 대상이다.
 *
 * 두 가지가 섞여 있다. 지우려다 실패한 것(delete_failed)과, 삭제 작업이 아예
 * 집어가지 못하는 것(unreachable — 페이지 기록이 없어 목록에 오르지 않는다).
 * 후자는 실패조차 하지 않으므로 delete_attempts로는 드러나지 않는다.
 */
export async function listRetentionAttention(pool: Pool): Promise<AttentionDocument[]> {
  const { rows } = await pool.query<{
    id: string;
    owner_user_id: string;
    retention_until: Date;
    delete_attempts: number;
    personal_info_kinds: string[];
    reason: AttentionReason;
  }>(
    `SELECT id, owner_user_id, retention_until, delete_attempts, personal_info_kinds, reason
     FROM originals.retention_attention
     ORDER BY retention_until`
  );

  return rows.map((row) => ({
    id: row.id,
    ownerUserId: row.owner_user_id,
    retentionUntil: row.retention_until,
    attempts: row.delete_attempts,
    personalInfoKinds: row.personal_info_kinds,
    reason: row.reason,
  }));
}

/**
 * 삭제 작업이 집어가지 못하던 문서를 집어갈 수 있게 만든다.
 *
 * 페이지 기록이 없다는 것은 지울 파일을 우리가 모른다는 뜻이다. 파일이 어딘가
 * 남아 있을 수 있으므로 "지웠다"고 기록하는 것은 거짓말이 된다. 대신
 * delete_failed로 표시해 목록에 남기고, 스토리지를 사람이 직접 확인하게 한다.
 *
 * 이 함수는 되돌릴 수 있는 것만 한다 — 어떤 파일도 지우지 않고, 어떤 문서도
 * 지워졌다고 기록하지 않는다.
 */
export async function markUnreachableForReview(pool: Pool): Promise<number> {
  // 이미 목록에 올라 있는 것은 건드리지 않는다. 안 그러면 아무것도 하지 않고도
  // "올렸다"고 말하게 되고, 운영자는 매번 새 문제가 생긴 줄 안다.
  const { rowCount } = await pool.query(
    `UPDATE originals.raw_documents
     SET status = 'delete_failed'
     WHERE id IN (SELECT id FROM originals.unreachable_expired_documents)
       AND status <> 'delete_failed'`
  );

  return rowCount ?? 0;
}
