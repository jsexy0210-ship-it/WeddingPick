import type { Pool } from 'pg';

import { withTransaction } from '../db';
import type { Storage } from '../storage/port';
import type { Analyzer, DocumentPage } from './analyzer';
import { persistExtraction } from './persist';

export type WorkerDeps = {
  pool: Pool;
  storage: Storage;
  analyzer: Analyzer;
};

type ClaimedAnalysis = {
  id: string;
  raw_document_id: string;
  wedding_id: string;
};

/**
 * 대기 중인 분석 하나를 잡는다.
 *
 * FOR UPDATE SKIP LOCKED — 워커를 여러 개 띄워도 같은 문서를 두 번 분석하지 않는다.
 * AI 호출은 비용이다.
 */
async function claim(pool: Pool): Promise<ClaimedAnalysis | null> {
  const { rows } = await pool.query<ClaimedAnalysis>(
    `UPDATE structured.analyses
     SET status = 'running', started_at = now()
     WHERE id = (
       SELECT id FROM structured.analyses
       WHERE status = 'pending'
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING id, raw_document_id, wedding_id`
  );

  return rows[0] ?? null;
}

async function loadPages(deps: WorkerDeps, rawDocumentId: string): Promise<DocumentPage[]> {
  const { rows } = await deps.pool.query<{ storage_key: string; mime_type: string }>(
    `SELECT storage_key, mime_type FROM originals.raw_document_pages
     WHERE raw_document_id = $1 ORDER BY page_index`,
    [rawDocumentId]
  );

  return Promise.all(
    rows.map(async (row) => ({
      mimeType: row.mime_type,
      bytes: await deps.storage.download(row.storage_key),
    }))
  );
}

async function fail(
  pool: Pool,
  analysisId: string,
  reason: 'unreadable' | 'not_a_document' | 'internal'
) {
  await pool.query(
    `UPDATE structured.analyses
     SET status = 'failed', failure_reason = $2, finished_at = now()
     WHERE id = $1`,
    [analysisId, reason]
  );
}

/**
 * 대기 중인 분석 하나를 처리한다. 처리했으면 true, 할 일이 없으면 false.
 */
export async function runOnce(deps: WorkerDeps): Promise<boolean> {
  const analysis = await claim(deps.pool);

  if (!analysis) {
    return false;
  }

  try {
    const pages = await loadPages(deps, analysis.raw_document_id);

    if (pages.length === 0) {
      await fail(deps.pool, analysis.id, 'internal');
      return true;
    }

    const { extraction, usage } = await deps.analyzer.analyze(pages);

    if (extraction.unreadable) {
      await fail(deps.pool, analysis.id, 'unreadable');
      return true;
    }

    if (extraction.documentKind === 'not_a_document') {
      await fail(deps.pool, analysis.id, 'not_a_document');
      return true;
    }

    await withTransaction(deps.pool, async (client) => {
      const quoteId = await persistExtraction(client, {
        weddingId: analysis.wedding_id,
        rawDocumentId: analysis.raw_document_id,
        extraction,
      });

      await client.query(
        `UPDATE structured.analyses
         SET status = 'succeeded', quote_id = $2, finished_at = now(),
             input_tokens = $3, output_tokens = $4
         WHERE id = $1`,
        [analysis.id, quoteId, usage.inputTokens, usage.outputTokens]
      );
    });

    return true;
  } catch (error) {
    // 실패해도 running으로 남겨두지 않는다. 남으면 아무도 다시 집어가지 않는다.
    await fail(deps.pool, analysis.id, 'internal');
    throw error;
  }
}

/** 대기열이 빌 때까지 계속 처리한다. */
export async function drain(deps: WorkerDeps, limit = 100): Promise<number> {
  let processed = 0;

  while (processed < limit && (await runOnce(deps))) {
    processed += 1;
  }

  return processed;
}

/** 상시 구동 워커. 할 일이 없으면 잠깐 쉬었다 다시 본다. */
export async function runForever(
  deps: WorkerDeps,
  options: { idleMs?: number; signal?: AbortSignal } = {}
): Promise<void> {
  const idleMs = options.idleMs ?? 2000;

  while (!options.signal?.aborted) {
    let worked = false;

    try {
      worked = await runOnce(deps);
    } catch (error) {
      // 한 건이 실패해도 워커는 계속 돈다. 그 건은 이미 failed로 표시됐다.
      console.error('분석 실패:', error);
    }

    if (!worked) {
      await new Promise((resolve) => setTimeout(resolve, idleMs));
    }
  }
}
