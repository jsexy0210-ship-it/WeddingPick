import type { Pool } from 'pg';

import { loadConfig } from './config';
import { createPool } from './db';

/**
 * 관리자가 보는 것. 최종통합정책 v2.0 H장.
 *
 * **개별 큐를 열 필요가 없는 것이 목표다**(H장). 그래서 이 도구가 먼저 보여주는
 * 것은 처리할 목록이 아니라 **어제 자동으로 무슨 일이 있었는가**이고, 사람 손이
 * 필요한 것은 그 아래에 붙는다.
 *
 *   npm run decisions --workspace @weddingpick/api -- --briefing
 *   npm run decisions --workspace @weddingpick/api -- --open
 *   npm run decisions --workspace @weddingpick/api -- --event <event-id>
 *
 * 여기서 아무것도 처리하지 않는다. 처리는 각 도구(rebuttals·inquiries·
 * verifications)가 하고, 이건 어디를 봐야 하는지만 말한다. 전부 조회라
 * `requireOperator`를 여기서 부르지 않는다 — 관리자 라우트가 맨 앞에서
 * 이미 확인한다.
 */

export type DecisionStep = {
  step: string;
  decider: string;
  decision: string;
  reasonCode: string;
  confidence: number | null;
  executionStatus: string;
  createdAt: Date;
};

export async function eventTimeline(pool: Pool, eventId: string): Promise<DecisionStep[]> {
  const { rows } = await pool.query<{
    step: string;
    decider: string;
    decision: string;
    reason_code: string;
    confidence: string | null;
    execution_status: string;
    created_at: Date;
  }>(
    `SELECT step, decider, decision, reason_code, confidence, execution_status, created_at
     FROM structured.decisions WHERE event_id = $1 ORDER BY created_at`,
    [eventId]
  );

  return rows.map((row) => ({
    step: row.step,
    decider: row.decider,
    decision: row.decision,
    reasonCode: row.reason_code,
    confidence: row.confidence === null ? null : Number(row.confidence),
    executionStatus: row.execution_status,
    createdAt: row.created_at,
  }));
}

export type OpenDecision = {
  id: string;
  workflow: string;
  step: string;
  subjectKind: string;
  subjectId: string | null;
  reasonCode: string;
  executionStatus: string;
  createdAt: Date;
};

export async function openDecisions(pool: Pool): Promise<OpenDecision[]> {
  const { rows } = await pool.query<{
    id: string;
    workflow: string;
    step: string;
    subject_kind: string;
    subject_id: string | null;
    reason_code: string;
    execution_status: string;
    created_at: Date;
  }>(
    `SELECT id, workflow, step, subject_kind, subject_id, reason_code,
            execution_status, created_at
     FROM structured.open_decisions
     ORDER BY created_at`
  );

  return rows.map((row) => ({
    id: row.id,
    workflow: row.workflow,
    step: row.step,
    subjectKind: row.subject_kind,
    subjectId: row.subject_id,
    reasonCode: row.reason_code,
    executionStatus: row.execution_status,
    createdAt: row.created_at,
  }));
}

export type BriefingRow = {
  workflow: string;
  decider: string;
  decisions: number;
  failed: number;
  costUsd: number | null;
};

export async function briefing(pool: Pool): Promise<BriefingRow[]> {
  const { rows } = await pool.query<{
    workflow: string;
    decider: string;
    decisions: string;
    failed: string;
    cost: string | null;
  }>(
    `SELECT workflow, decider::text,
            count(*)::text AS decisions,
            count(*) FILTER (WHERE execution_status IN ('failed', 'pending'))::text AS failed,
            sum(cost_usd)::text AS cost
     FROM structured.decisions
     WHERE created_at >= now() - interval '1 day'
     GROUP BY workflow, decider
     ORDER BY workflow, decider`
  );

  return rows.map((row) => ({
    workflow: row.workflow,
    decider: row.decider,
    decisions: Number(row.decisions),
    failed: Number(row.failed),
    costUsd: row.cost === null ? null : Number(row.cost),
  }));
}

type Options = { briefing: boolean; open: boolean; event?: string };

function parseArgs(argv: string[]): Options {
  const options: Options = { briefing: false, open: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--briefing') options.briefing = true;
    else if (arg === '--open') options.open = true;
    else if (arg === '--event') options.event = argv[++i];
  }

  return options;
}

const when = (at: Date): string => at.toISOString().slice(0, 16).replace('T', ' ');

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = createPool(loadConfig().databaseUrl);

  try {
    if (options.event) {
      const rows = await eventTimeline(pool, options.event);

      if (rows.length === 0) {
        console.error('그런 사건이 없다.');
        process.exitCode = 1;
        return;
      }

      console.log(`사건 ${options.event} — ${rows.length}단계:`);
      for (const row of rows) {
        const confidence = row.confidence === null ? '' : ` (${row.confidence})`;

        console.log(
          `  ${when(row.createdAt)}  ${row.step}  ${row.decider}${confidence}` +
            `  → ${row.decision} [${row.reasonCode}]  ${row.executionStatus}`
        );
      }
      return;
    }

    if (options.open) {
      const rows = await openDecisions(pool);

      if (rows.length === 0) {
        console.log('사람 손이 필요한 것이 없다.');
        return;
      }

      console.log(`사람 손이 필요한 것 ${rows.length}건:`);
      for (const row of rows) {
        console.log(
          `  ${when(row.createdAt)}  ${row.workflow}/${row.step}  ` +
            `${row.subjectKind}:${row.subjectId ?? '-'}  [${row.reasonCode}]  ` +
            `${row.executionStatus}`
        );
      }
      return;
    }

    if (options.briefing) {
      const rows = await briefing(pool);

      console.log('최근 24시간:');

      if (rows.length === 0) {
        console.log('  아무 결정도 없었다.');
        return;
      }

      for (const row of rows) {
        const cost = row.costUsd === null ? '' : `  $${row.costUsd.toFixed(4)}`;

        console.log(`  ${row.workflow}  ${row.decider}  ${row.decisions}건  미해결 ${row.failed}건${cost}`);
      }
      return;
    }

    console.error('무엇을 볼지 정해라: --briefing | --open | --event <id>');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

/*
 * CLI로 직접 실행했을 때만 돈다. 테스트가 이 파일에서 함수를 가져오면(require)
 * `require.main`이 테스트 러너를 가리키므로 여기 걸리지 않는다.
 */
if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
