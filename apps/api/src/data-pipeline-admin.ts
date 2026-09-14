import type { Pool } from 'pg';

import { ApiError, notFound } from './errors';

/**
 * 제보 처리 현황 — WP-ADM-010.
 *
 * 화면이 그리는 「단계별 적체」와 「실패 큐」의 바탕은 `structured.analyses`다(0002).
 * 이 콘솔에서 상태 기계가 실제로 도는 유일한 자리이고, 되돌릴 수 있는 실패가 남는
 * 유일한 자리이기도 하다 — pending → running → succeeded | failed.
 *
 * ## 재처리가 실제로 무엇을 하나
 *
 * 워커는 `pending`인 행만 집어간다(analysis/worker.ts `claim()`). 그래서 재처리는
 * 「실패를 pending으로 되돌리는 것」이고, 그것으로 끝이다 — 새 행을 만들지 않는다
 * (0068 `unique_analysis_per_document`가 문서당 분석 하나를 강제한다).
 *
 * 되돌릴 때 `failure_reason` · `finished_at` · `started_at`을 같이 지운다. 0002의 세
 * CHECK가 「실패면 이유가 있다」 · 「끝났으면 끝난 시각이 있다」를 강제하므로, 하나만
 * 지우면 제약에 걸려 트랜잭션이 통째로 되돌아간다.
 */

/** 화면이 그대로 적는 단계 이름. */
const STAGE_PENDING = '대기';
const STAGE_RUNNING = '분석 중';
const STAGE_FAILED = '실패';

/**
 * 실패 이유를 사람이 읽는 말로.
 *
 * `analysis_failure` enum 셋(0002)을 그대로 옮긴다. 「내부 오류」만 우리 쪽 문제라
 * 다시 돌리면 될 수 있고, 나머지 둘은 문서 자체가 그런 것이라 다시 돌려도 같다.
 */
const FAILURE_LABEL: Record<string, string> = {
  unreadable: '읽을 수 없는 문서',
  not_a_document: '문서가 아님',
  internal: '내부 오류',
};

/** 사람이 봐야 하는 실패. 다시 돌린다고 달라지지 않는다. */
const NEEDS_A_PERSON = ['unreadable', 'not_a_document'];

/**
 * 전체 재처리가 한 건에 대해 물러서는 횟수.
 *
 * 개별 재처리에는 걸지 않는다 — 그건 사람이 그 건을 보고 고른 것이고, 원본을 고쳤거나
 * 모델이 바뀌었을 수 있다. 막아야 하는 것은 「전체」를 반복해서 누르는 쪽이다.
 */
export const MAX_BULK_RETRIES = 3;

export type PipelineStage = { stage: string; count: number; avgWaitMin: number };
export type PipelineFailure = {
  id: string;
  stage: string;
  error: string;
  failedAt: string;
  retryCount: number;
};

export type PipelineData = {
  today: { received: number; autoProcessed: number; manualRequired: number; failed: number };
  stages: PipelineStage[];
  failedQueue: PipelineFailure[];
};

/**
 * 오늘 넉 장 · 단계별 적체 · 실패 큐.
 *
 * 「오늘」은 넷이 서로 겹치지 않게 나눈다 — 겹치면 합이 접수 건수를 넘어서 화면이
 * 스스로를 부정한다.
 *
 *   접수(received)        오늘 들어온 전부
 *   자동 처리(autoProcessed) 그중 사람 손 없이 끝난 것
 *   확인 필요(manualRequired) 사람이 봐야 하는 실패 — 다시 돌려도 같다
 *   실패(failed)          우리 쪽 오류로 실패한 것 — 다시 돌리면 될 수 있다
 *
 * 넷의 합이 접수보다 작을 수 있다. 아직 도는 중인 것이 그 차이다.
 */
export async function pipelineData(pool: Pool): Promise<PipelineData> {
  const { rows: todayRows } = await pool.query<{
    received: string;
    auto_processed: string;
    manual_required: string;
    failed: string;
  }>(
    `SELECT COUNT(*)::text AS received,
            COUNT(*) FILTER (WHERE status = 'succeeded')::text AS auto_processed,
            COUNT(*) FILTER (
              WHERE status = 'failed' AND failure_reason::text = ANY($1)
            )::text AS manual_required,
            COUNT(*) FILTER (
              WHERE status = 'failed' AND NOT (failure_reason::text = ANY($1))
            )::text AS failed
       FROM structured.analyses
      WHERE created_at >= date_trunc('day', now())`,
    [NEEDS_A_PERSON]
  );

  const t = todayRows[0];

  /*
   * 적체는 「몇 건이 얼마나 기다렸나」다. 단계마다 기다림의 기준 시각이 다르다 —
   * 대기는 들어온 때부터, 도는 중은 집어간 때부터, 실패는 실패한 때부터.
   */
  const { rows: stageRows } = await pool.query<{
    stage: string;
    count: string;
    avg_wait_min: string | null;
  }>(
    `SELECT status::text AS stage,
            COUNT(*)::text AS count,
            AVG(EXTRACT(EPOCH FROM (now() - COALESCE(finished_at, started_at, created_at))) / 60)::text
              AS avg_wait_min
       FROM structured.analyses
      WHERE status IN ('pending', 'running', 'failed')
      GROUP BY status`
  );

  const label: Record<string, string> = {
    pending: STAGE_PENDING,
    running: STAGE_RUNNING,
    failed: STAGE_FAILED,
  };
  const found = new Map(stageRows.map((r) => [r.stage, r]));
  // 빈 단계도 0으로 그린다. 「대기」 줄이 사라지면 적체가 없는 것인지 화면이
  // 덜 그린 것인지 구분되지 않는다 — v3.27의 「빈 상태가 정상 상태」.
  const stages: PipelineStage[] = ['pending', 'running', 'failed'].map((s) => {
    const row = found.get(s);
    return {
      stage: label[s] ?? s,
      count: Number(row?.count ?? '0'),
      avgWaitMin: Math.round(Number(row?.avg_wait_min ?? '0')),
    };
  });

  const { rows: failedRows } = await pool.query<{
    id: string;
    failure_reason: string;
    finished_at: Date;
    retry_count: number;
  }>(
    `SELECT id, failure_reason::text AS failure_reason, finished_at, retry_count
       FROM structured.analyses
      WHERE status = 'failed'
      ORDER BY finished_at DESC
      LIMIT 50`
  );

  return {
    today: {
      received: Number(t?.received ?? '0'),
      autoProcessed: Number(t?.auto_processed ?? '0'),
      manualRequired: Number(t?.manual_required ?? '0'),
      failed: Number(t?.failed ?? '0'),
    },
    stages,
    failedQueue: failedRows.map((r) => ({
      id: r.id,
      stage: STAGE_FAILED,
      error: FAILURE_LABEL[r.failure_reason] ?? r.failure_reason,
      failedAt: r.finished_at.toISOString(),
      retryCount: r.retry_count,
    })),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 한 건을 다시 돌린다.
 *
 * 실패한 것만 되돌린다. 도는 중인 것을 pending으로 밀면 워커 둘이 같은 문서를 잡고,
 * 성공한 것을 밀면 이미 만들어진 견적서가 떠버린다(`succeeded_has_quote`).
 */
export async function retryAnalysis(pool: Pool, id: string): Promise<void> {
  if (!UUID.test(id)) throw notFound('분석');

  const { rowCount } = await pool.query(
    `UPDATE structured.analyses
        SET status = 'pending',
            failure_reason = NULL,
            started_at = NULL,
            finished_at = NULL,
            retry_count = retry_count + 1
      WHERE id = $1 AND status = 'failed'`,
    [id]
  );

  if (rowCount === 0) {
    // 없는 것인지 실패가 아닌 것인지 갈라 말한다. 「처리되지 않았다」만 돌려주면
    // 운영자는 다시 눌러 보는 것 말고 할 수 있는 것이 없다.
    const { rows } = await pool.query<{ status: string }>(
      `SELECT status::text AS status FROM structured.analyses WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) throw notFound('분석');
    throw new ApiError('conflict', '실패한 건만 다시 처리할 수 있습니다.');
  }
}

/**
 * 실패한 것을 한꺼번에 다시 돌린다.
 *
 * `MAX_BULK_RETRIES`를 넘긴 건은 건너뛴다. 읽을 수 없는 문서 하나가 전체 재처리를
 * 누를 때마다 모델을 부르며 영원히 도는 것을 막는다 — 그 건은 사람이 개별로 보라고
 * 남겨 둔다. 몇 건을 건너뛰었는지 돌려주므로 화면이 그 사실을 감추지 않을 수 있다.
 */
export async function retryAllFailed(
  pool: Pool
): Promise<{ retried: number; skipped: number }> {
  const { rowCount } = await pool.query(
    `UPDATE structured.analyses
        SET status = 'pending',
            failure_reason = NULL,
            started_at = NULL,
            finished_at = NULL,
            retry_count = retry_count + 1
      WHERE status = 'failed' AND retry_count < $1`,
    [MAX_BULK_RETRIES]
  );

  const { rows } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n
       FROM structured.analyses
      WHERE status = 'failed' AND retry_count >= $1`,
    [MAX_BULK_RETRIES]
  );

  return { retried: rowCount ?? 0, skipped: Number(rows[0]?.n ?? '0') };
}
