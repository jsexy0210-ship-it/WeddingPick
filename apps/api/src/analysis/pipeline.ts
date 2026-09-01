import {
  type CallBlock,
  blockedReason,
  budgetState,
  dailyCallState,
  estimateCostUsd,
} from '@weddingpick/domain';
import type { Pool } from 'pg';

import type { AnalysisOutcome, Analyzer, DocumentPage } from './analyzer';

/**
 * 문서를 읽기 전에 지나는 관문. 화면데이터구조 스펙 7.3.
 *
 * 스펙은 "모든 AI 요청 전에 DB조회/계산/규칙처리/캐시 가능 여부를 먼저 확인"을
 * 요구한다. 결제내역 읽기에는 그 관문이 있었지만(`proof-pipeline.ts`) **문서 분석은
 * 곧바로 모델을 불렀고, 부른 뒤에도 세지 않았다.**
 *
 * 세지 않으면 한도는 장식이다. `document_extraction`이라는 기능 이름은 처음부터
 * 있었는데 그 이름으로 들어온 줄이 한 줄도 없었고, 그래서 예산을 걸어도 문서 분석에는
 * 걸리지 않았다 — `ai_budget_status`가 지출을 0으로 보기 때문이다.
 *
 * 관문은 둘을 본다. **먼저 돈, 그다음 사람이다.**
 */

const FEATURE = 'document_extraction';

export type ExtractDeps = {
  pool: Pool;
  analyzer: Analyzer;
  /** 한 사람이 하루에 부를 수 있는 횟수. 없으면 한도가 없다. */
  dailyCallLimit?: number | null;
};

export type ExtractResult =
  | { kind: 'extracted'; outcome: AnalysisOutcome }
  /** 부르지 못했다. 고장이 아니라 지금 부를 수 없는 것이다. */
  | { kind: 'blocked'; reason: CallBlock };

/** 이번 달 문서 분석에 얼마를 썼는지. */
async function spentThisMonth(pool: Pool): Promise<{ spentUsd: number; budgetUsd: number | null }> {
  const { rows } = await pool.query<{ spent_usd: string; budget_usd: string | null }>(
    `SELECT spent_usd, budget_usd FROM structured.ai_budget_status WHERE feature = $1`,
    [FEATURE]
  );

  const budget = rows[0]?.budget_usd;

  return {
    spentUsd: Number(rows[0]?.spent_usd ?? 0),
    budgetUsd: budget === null || budget === undefined ? null : Number(budget),
  };
}

/**
 * 오늘 이 사람이 몇 번 불렀는가.
 *
 * **실패한 호출도 센다.** 실패해도 돈과 시간은 쓴 것이고, 실패를 빼면 계속 실패하는
 * 요청이 한도 없이 돌 수 있다.
 */
async function callsToday(pool: Pool, userId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT count(*) FROM structured.ai_usage
     WHERE user_id = $1 AND requested_at >= date_trunc('day', now())`,
    [userId]
  );

  return Number(rows[0]?.count ?? 0);
}

async function recordUsage(
  pool: Pool,
  input: {
    userId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    succeeded: boolean;
    latencyMs: number;
  }
): Promise<void> {
  await pool.query(
    `INSERT INTO structured.ai_usage
       (feature, user_id, model, input_tokens, output_tokens, estimated_cost_usd,
        succeeded, latency_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      FEATURE,
      input.userId,
      input.model,
      input.inputTokens,
      input.outputTokens,
      // 단가를 모르는 모델이면 null. 0으로 두면 합계에 섞여 예산이 넉넉해 보인다.
      estimateCostUsd({
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
      }),
      input.succeeded,
      input.latencyMs,
    ]
  );
}

/**
 * 문서 하나를 읽는다.
 *
 * 부르지 못하면 부르지 않고 이유를 낸다. **부른 뒤에는 성공이든 실패든 남긴다** —
 * 성공률을 내려면 실패를 세야 하고(스펙 7.3), 실패한 호출도 돈은 나간다.
 */
export async function extractDocument(
  deps: ExtractDeps,
  input: { ownerUserId: string; pages: DocumentPage[]; model: string }
): Promise<ExtractResult> {
  const budget = budgetState({ feature: FEATURE, ...(await spentThisMonth(deps.pool)) });

  const daily = dailyCallState({
    used: await callsToday(deps.pool, input.ownerUserId),
    limit: deps.dailyCallLimit,
  });

  const blocked = blockedReason({ budgetExceeded: budget.kind === 'exceeded', daily });

  if (blocked) return { kind: 'blocked', reason: blocked };

  const startedAt = Date.now();

  try {
    const outcome = await deps.analyzer.analyze(input.pages);

    await recordUsage(deps.pool, {
      userId: input.ownerUserId,
      model: input.model,
      inputTokens: outcome.usage.inputTokens,
      outputTokens: outcome.usage.outputTokens,
      succeeded: true,
      latencyMs: Date.now() - startedAt,
    });

    return { kind: 'extracted', outcome };
  } catch (error) {
    await recordUsage(deps.pool, {
      userId: input.ownerUserId,
      model: input.model,
      inputTokens: 0,
      outputTokens: 0,
      succeeded: false,
      latencyMs: Date.now() - startedAt,
    });

    throw error;
  }
}
