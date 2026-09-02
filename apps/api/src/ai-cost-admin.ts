import {
  AI_FEATURES,
  AI_FEATURE_LABEL,
  MODEL_PRICES_AS_OF,
  type AiFeature,
} from '@weddingpick/domain';
import type { Pool } from 'pg';

import { loadConfig } from './config';
import { createPool } from './db';
import { requireOperator } from './decisions';

/**
 * AI 사용량과 예산을 보는 도구.
 *
 * 화면데이터구조 스펙 7.3이 요구한 지표를 사람이 읽을 수 있게 꺼낸다. 재는 것을
 * 만들어 놓고 볼 방법이 없으면 재지 않은 것과 같다.
 *
 *   npm run ai-cost --workspace @weddingpick/api -- --status
 *   npm run ai-cost --workspace @weddingpick/api -- --usage [--months 3]
 *   npm run ai-cost --workspace @weddingpick/api -- --budget <기능> <금액> --by <user-id>
 *   npm run ai-cost --workspace @weddingpick/api -- --clear-budget <기능> --by <user-id>
 *
 * **한도를 정하고 없애는 것은 운영 결정이다.** 이전에는 `--budget`만 `--by`로
 * 누가 정했는지 남겼고 실제 권한 확인은 없었다 — 관리자 콘솔이 HTTP로 열리면
 * 그 암묵적 경계가 사라지므로 여기서부터 `requireOperator`를 건다.
 */

export function isFeature(value: string): value is AiFeature {
  return (AI_FEATURES as readonly string[]).includes(value);
}

export type AiBudgetStatus = {
  feature: AiFeature;
  spentUsd: number;
  budgetUsd: number | null;
  state: string;
  uncostedCount: number;
};

export async function status(pool: Pool): Promise<AiBudgetStatus[]> {
  const { rows } = await pool.query<{
    feature: AiFeature;
    spent_usd: string;
    budget_usd: string | null;
    state: string;
    uncosted_count: string;
  }>('SELECT * FROM structured.ai_budget_status ORDER BY feature');

  return rows.map((row) => ({
    feature: row.feature,
    spentUsd: Number(row.spent_usd),
    budgetUsd: row.budget_usd === null ? null : Number(row.budget_usd),
    state: row.state,
    uncostedCount: Number(row.uncosted_count),
  }));
}

export type AiUsageMonth = {
  feature: AiFeature;
  month: Date;
  model: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  estimatedCostUsd: number | null;
  successRate: number;
  escalationRate: number;
  userCorrectionRate: number | null;
  correctionUnknownCount: number;
  medianLatencyMs: number | null;
};

export async function usage(pool: Pool, months: number): Promise<AiUsageMonth[]> {
  const { rows } = await pool.query<{
    feature: AiFeature;
    month: Date;
    model: string;
    request_count: string;
    input_tokens: string;
    output_tokens: string;
    cached_input_tokens: string;
    estimated_cost_usd: string | null;
    success_rate: string;
    escalation_rate: string;
    user_correction_rate: string | null;
    correction_unknown_count: string;
    median_latency_ms: string | null;
  }>(
    `SELECT * FROM structured.ai_usage_monthly
     WHERE month >= date_trunc('month', now()) - ($1 || ' months')::interval
     ORDER BY month DESC, feature, model`,
    [months]
  );

  return rows.map((row) => ({
    feature: row.feature,
    month: row.month,
    model: row.model,
    requestCount: Number(row.request_count),
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
    cachedInputTokens: Number(row.cached_input_tokens),
    estimatedCostUsd: row.estimated_cost_usd === null ? null : Number(row.estimated_cost_usd),
    successRate: Number(row.success_rate),
    escalationRate: Number(row.escalation_rate),
    userCorrectionRate: row.user_correction_rate === null ? null : Number(row.user_correction_rate),
    correctionUnknownCount: Number(row.correction_unknown_count),
    medianLatencyMs: row.median_latency_ms === null ? null : Number(row.median_latency_ms),
  }));
}

export async function setBudget(
  pool: Pool,
  feature: AiFeature,
  amount: number,
  by: string
): Promise<void> {
  await requireOperator(pool, by);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('한도는 0보다 큰 금액이어야 한다.');
  }

  await pool.query(
    `INSERT INTO structured.ai_budgets (feature, month, budget_usd, set_by)
     VALUES ($1, date_trunc('month', now())::date, $2, $3)
     ON CONFLICT (feature, month) DO UPDATE
       SET budget_usd = excluded.budget_usd, set_by = excluded.set_by, set_at = now()`,
    [feature, amount, by]
  );
}

export async function clearBudget(pool: Pool, feature: AiFeature, by: string): Promise<void> {
  await requireOperator(pool, by);

  await pool.query(
    `DELETE FROM structured.ai_budgets
     WHERE feature = $1 AND month = date_trunc('month', now())::date`,
    [feature]
  );
}

const usd = (value: number | null) => (value === null ? '—' : `$${value.toFixed(4)}`);
const pct = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`);

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const pool = createPool(loadConfig().databaseUrl);

  try {
    if (args.includes('--status')) {
      const rows = await status(pool);

      console.log(`이번 달 (단가 기준일 ${MODEL_PRICES_AS_OF})\n`);

      for (const row of rows) {
        const budget = row.budgetUsd === null ? '한도 없음' : `한도 ${usd(row.budgetUsd)}`;
        const flag = row.state === 'exceeded' ? '  ← 넘김' : '';

        console.log(`${AI_FEATURE_LABEL[row.feature].padEnd(12)} ${usd(row.spentUsd)} / ${budget}${flag}`);

        if (row.uncostedCount > 0) {
          console.log(`${' '.repeat(13)}단가를 모르는 호출 ${row.uncostedCount}건이 합계에서 빠져 있다.`);
        }
      }
      return;
    }

    if (args.includes('--usage')) {
      const index = args.indexOf('--months');
      const monthsArg = index >= 0 ? Number(args[index + 1]) : 3;
      const months = Number.isFinite(monthsArg) && monthsArg > 0 ? monthsArg : 3;
      const rows = await usage(pool, months);

      if (rows.length === 0) {
        console.log('기록이 없다.');
        return;
      }

      for (const row of rows) {
        console.log(`\n${row.month.toISOString().slice(0, 7)}  ${AI_FEATURE_LABEL[row.feature]}  ${row.model}`);
        console.log(`  호출 ${row.requestCount}건 · ${usd(row.estimatedCostUsd)}`);
        console.log(
          `  토큰 입력 ${row.inputTokens} (캐시 ${row.cachedInputTokens}) · 출력 ${row.outputTokens}`
        );
        console.log(`  성공 ${pct(row.successRate)} · 상위 모델로 올라간 비율 ${pct(row.escalationRate)}`);
        console.log(
          `  사람이 고친 비율 ${pct(row.userCorrectionRate)}` +
            (row.correctionUnknownCount > 0 ? ` (아직 모름 ${row.correctionUnknownCount}건)` : '')
        );

        if (row.medianLatencyMs !== null) {
          console.log(`  중간 응답 시간 ${Math.round(row.medianLatencyMs)}ms`);
        }
      }

      console.log(
        '\n상위 모델로 올라간 비율이 높으면 저비용 모델을 먼저 부르는 것이 손해다 — 두 번 부르는 값이 한 번에 좋은 모델을 부르는 값보다 커진다.'
      );
      return;
    }

    const budgetIndex = args.indexOf('--budget');

    if (budgetIndex >= 0) {
      const feature = args[budgetIndex + 1];
      const amount = Number(args[budgetIndex + 2]);
      const byIndex = args.indexOf('--by');
      const by = byIndex >= 0 ? args[byIndex + 1] : undefined;

      if (!feature || !isFeature(feature)) {
        throw new Error(`기능을 골라라: ${AI_FEATURES.join(' | ')}`);
      }

      if (!by) {
        throw new Error('--by <user-id>로 정한 사람을 남겨라.');
      }

      await setBudget(pool, feature, amount, by);

      console.log(`${AI_FEATURE_LABEL[feature]} 이번 달 한도를 $${amount.toFixed(2)}로 정했다.`);
      console.log('넘기면 사진에서 읽어주는 것만 멈춘다. 등록과 나머지 기능은 그대로 돈다.');
      return;
    }

    const clearIndex = args.indexOf('--clear-budget');

    if (clearIndex >= 0) {
      const feature = args[clearIndex + 1];
      const byIndex = args.indexOf('--by');
      const by = byIndex >= 0 ? args[byIndex + 1] : undefined;

      if (!feature || !isFeature(feature)) {
        throw new Error(`기능을 골라라: ${AI_FEATURES.join(' | ')}`);
      }

      if (!by) {
        throw new Error('--by <user-id>로 없앤 사람을 남겨라.');
      }

      await clearBudget(pool, feature, by);

      console.log(`${AI_FEATURE_LABEL[feature]} 이번 달 한도를 없앴다. 이제 한도가 없다.`);
      return;
    }

    console.log(
      [
        'AI 사용량과 예산.',
        '',
        '  --status                          이번 달 지출과 한도',
        '  --usage [--months 3]              기능·모델별 지표',
        `  --budget <기능> <금액> --by <id>  이번 달 한도를 정한다`,
        '  --clear-budget <기능> --by <id>   한도를 없앤다',
        '',
        `기능: ${AI_FEATURES.join(' | ')}`,
      ].join('\n')
    );
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
