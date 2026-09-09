import type { Pool } from 'pg';

import { withTransaction } from '../db';
import type { Storage } from '../storage/port';
import type { Analyzer, DocumentPage } from './analyzer';
import { persistExtraction } from './persist';
import { extractDocument } from './pipeline';

export type WorkerDeps = {
  pool: Pool;
  storage: Storage;
  analyzer: Analyzer;
  /** `ai_usage`에 적을 이름. 실제로 부른 모델과 같아야 한다. */
  model: string;
  /** 한 사람이 하루에 부를 수 있는 횟수. 없으면 한도가 없다. */
  dailyCallLimit?: number | null;
};

/**
 * 얼마나 오래 `running`이면 죽은 것으로 보는가.
 *
 * **회수하는 자리가 없었다**(Release Audit 1차 P1-20). `claim()`이 `pending`만
 * 집어서, 프로세스가 잡아둔 채 죽으면 그 문서는 영원히 `running`에 갇히고
 * 화면은 계속 「분석 중」이었다. 실패 표시조차 없어 재시도할 방법도 없었다.
 *
 * 값은 모델 호출 한도(`CLIENT_LIMITS.timeout` 2분)보다 넉넉히 길어야 한다 —
 * 살아서 일하는 중인 것을 남이 뺏어가면 같은 문서를 두 번 분석하게 되고,
 * 그건 돈이다. 30분이면 어느 쪽으로도 애매하지 않다.
 */
const STUCK_AFTER = '30 minutes';

type ClaimedAnalysis = {
  id: string;
  raw_document_id: string;
  wedding_id: string;
  /** 누구의 문서인가. 사람 단위 한도를 걸려면 호출에 사람이 붙어야 한다. */
  owner_user_id: string;
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
          OR (status = 'running' AND started_at < now() - $1::interval)
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING id, raw_document_id, wedding_id`,
    [STUCK_AFTER]
  );

  const claimed = rows[0];

  if (!claimed) return null;

  const owner = await pool.query<{ owner_user_id: string }>(
    'SELECT owner_user_id FROM originals.raw_documents WHERE id = $1',
    [claimed.raw_document_id]
  );

  return { ...claimed, owner_user_id: owner.rows[0]!.owner_user_id };
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
  reason: 'unreadable' | 'not_a_document' | 'internal' | 'unavailable'
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

    /*
     * 관문을 지난다. 스펙 7.3 — 부르기 전에 부를 수 있는지 먼저 묻는다.
     *
     * 막혔으면 고장이 아니라 지금 부를 수 없는 것이다. `internal`로 적으면 화면이
     * "다시 시도해주세요"라고 말하는데, 다시 시도해도 같은 결과다.
     */
    const result = await extractDocument(
      { pool: deps.pool, analyzer: deps.analyzer, dailyCallLimit: deps.dailyCallLimit },
      { ownerUserId: analysis.owner_user_id, pages, model: deps.model }
    );

    if (result.kind === 'blocked') {
      console.warn(`문서 분석을 부르지 못했다 (${analysis.id}): ${result.reason}`);
      await fail(deps.pool, analysis.id, 'unavailable');
      return true;
    }

    const { extraction, usage } = result.outcome;

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
