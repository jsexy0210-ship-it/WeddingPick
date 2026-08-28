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


export type DueDocument = {
  id: string;
  ownerUserId: string;
  retentionUntil: Date;
  personalInfoKinds: string[];
  storageKeys: string[];
  /**
   * 아직 결론이 나지 않은 인증 신청의 증빙인지.
   *
   * 보관 기간(30일)과 인증 심사는 서로 모른다. 심사가 늦어지는 사이 증빙 파일이
   * 파기 예정일에 닿으면, 지우는 순간 그 신청은 확인할 근거를 잃는다.
   *
   * 그렇다고 보관 기간을 늘리지는 않는다 — 그건 정해진 정책이다. 대신 지우는
   * 사람에게 보인다. 심사를 먼저 끝내든, 그대로 지우든 사람이 정한다.
   */
  blocksOpenVerification: boolean;
};

/** 파기 예정일이 지난 원본. 사람이 지운다. */
export async function listDueDocuments(pool: Pool): Promise<DueDocument[]> {
  const { rows } = await pool.query<{
    id: string;
    owner_user_id: string;
    retention_until: Date;
    personal_info_kinds: string[];
    storage_keys: string[] | null;
    blocks_open_verification: boolean;
  }>(
    `SELECT
       d.id, d.owner_user_id, d.retention_until, d.personal_info_kinds,
       COALESCE(
         (SELECT array_agg(p.storage_key ORDER BY p.page_index)
            FROM originals.raw_document_pages p WHERE p.raw_document_id = d.id),
         ARRAY[]::text[]
       ) AS storage_keys,
       EXISTS (
         SELECT 1
           FROM structured.verification_evidence e
           JOIN structured.verification_requests r ON r.id = e.request_id
          WHERE e.raw_document_id = d.id
            AND r.status IN ('received', 'in_review')
       ) AS blocks_open_verification
     FROM originals.documents_due_for_deletion d
     ORDER BY d.retention_until`
  );

  return rows.map((row) => ({
    id: row.id,
    ownerUserId: row.owner_user_id,
    retentionUntil: row.retention_until,
    personalInfoKinds: row.personal_info_kinds,
    storageKeys: row.storage_keys ?? [],
    blocksOpenVerification: row.blocks_open_verification,
  }));
}

export type DeleteOutcome =
  | { ok: true; keysDeleted: number }
  | { ok: false; reason: string };

/**
 * 원본 하나를 지운다. 사람이 고른 것만 지운다.
 *
 * 자동 청소(sweepExpiredDocuments)와 같은 순서를 따른다 — 파일을 먼저 지우고,
 * 다 지워진 뒤에야 기록을 남긴다. 반대로 하면 기록은 "지웠다"인데 파일은 남는
 * 상태가 생기고, 그건 파기 기록이 거짓이 되는 것이다.
 *
 * 페이지 기록이 없는 문서는 거절한다. 지울 파일을 우리가 모르는 상태에서
 * "지웠다"고 적을 수는 없다.
 */
export async function deleteDocument(
  deps: RetentionDeps,
  documentId: string
): Promise<DeleteOutcome> {
  const { rows } = await deps.pool.query<{
    retention_until: Date | null;
    deleted_at: Date | null;
    storage_keys: string[] | null;
  }>(
    `SELECT
       d.retention_until, d.deleted_at,
       (SELECT array_agg(p.storage_key ORDER BY p.page_index)
          FROM originals.raw_document_pages p WHERE p.raw_document_id = d.id) AS storage_keys
     FROM originals.raw_documents d WHERE d.id = $1`,
    [documentId]
  );

  const found = rows[0];

  if (!found) return { ok: false, reason: '없는 문서다.' };
  if (found.deleted_at) return { ok: false, reason: '이미 지워진 문서다.' };

  if (!found.retention_until) {
    return { ok: false, reason: '보관 기간이 정해지지 않아 파기 예정일이 없다.' };
  }

  if (found.retention_until > new Date()) {
    // 예정일 전에 지우는 것은 사용자와의 약속을 깨는 일이다. 앱이 그 날짜를
    // 화면에 보여주고 있다.
    return { ok: false, reason: '아직 파기 예정일이 아니다.' };
  }

  const keys = found.storage_keys ?? [];

  if (keys.length === 0) {
    return {
      ok: false,
      reason: '페이지 기록이 없어 지울 파일을 알 수 없다. 스토리지를 직접 확인해야 한다.',
    };
  }

  for (const key of keys) {
    await deps.storage.delete(key);
  }

  await withTransaction(deps.pool, async (client) => {
    await client.query(
      `UPDATE originals.raw_documents
       SET status = 'deleted', deleted_at = now()
       WHERE id = $1`,
      [documentId]
    );

    await client.query('DELETE FROM originals.raw_document_pages WHERE raw_document_id = $1', [
      documentId,
    ]);
  });

  return { ok: true, keysDeleted: keys.length };
}


export type HeldDocument = {
  id: string;
  ownerUserId: string;
  uploadedAt: Date;
  personalInfoKinds: string[];
};

/**
 * 심사가 열려 있어 파기 일정이 서지 않는 원본.
 *
 * 검증 완료 후를 기준으로 삼은 대가다. 심사에 결론이 날 때까지 원본이 남고,
 * 그 기간에 상한이 없다. 심사가 적체되면 개인정보가 그만큼 오래 남는다.
 *
 * 파기 목록이 비어 있는 것을 안전하다고 읽으면 안 되는 이유가 여기 있다 —
 * 지울 것이 없어서가 아니라 아직 셈이 시작되지 않아서일 수 있다.
 */
export async function listHeldForVerification(pool: Pool): Promise<HeldDocument[]> {
  const { rows } = await pool.query<{
    id: string;
    owner_user_id: string;
    uploaded_at: Date;
    personal_info_kinds: string[];
  }>(
    `SELECT id, owner_user_id, uploaded_at, personal_info_kinds
     FROM originals.retention_held_for_verification
     ORDER BY uploaded_at`
  );

  return rows.map((row) => ({
    id: row.id,
    ownerUserId: row.owner_user_id,
    uploadedAt: row.uploaded_at,
    personalInfoKinds: row.personal_info_kinds,
  }));
}
