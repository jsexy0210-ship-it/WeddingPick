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
