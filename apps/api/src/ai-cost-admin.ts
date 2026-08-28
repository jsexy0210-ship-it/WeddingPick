import {
  AI_FEATURES,
  AI_FEATURE_LABEL,
  MODEL_PRICES_AS_OF,
  type AiFeature,
} from '@weddingpick/domain';

import { loadConfig } from './config';
import { createPool } from './db';

/**
 * AI 사용량과 예산을 보는 도구.
 *
 * 화면데이터구조 스펙 7.3이 요구한 지표를 사람이 읽을 수 있게 꺼낸다. 재는 것을
 * 만들어 놓고 볼 방법이 없으면 재지 않은 것과 같다.
 *
 *   npm run ai-cost --workspace @weddingpick/api -- --status
 *   npm run ai-cost --workspace @weddingpick/api -- --usage [--months 3]
 *   npm run ai-cost --workspace @weddingpick/api -- --budget <기능> <금액> --by <user-id>
 *   npm run ai-cost --workspace @weddingpick/api -- --clear-budget <기능>
 */

function isFeature(value: string): value is AiFeature {
  return (AI_FEATURES as readonly string[]).includes(value);
}

const usd = (value: string | null) =>
  value === null ? '—' : `$${Number(value).toFixed(4)}`;

const pct = (value: string | null) =>
  value === null ? '—' : `${Math.round(Number(value) * 100)}%`;

async function status(pool: ReturnType<typeof createPool>): Promise<void> {
  const { rows } = await pool.query<{
    feature: AiFeature;
    spent_usd: string;
    budget_usd: string | null;
    state: string;
    uncosted_count: string;
  }>('SELECT * FROM structured.ai_budget_status ORDER BY feature');

  console.log(`이번 달 (단가 기준일 ${MODEL_PRICES_AS_OF})\n`);

  for (const row of rows) {
    const budget = row.budget_usd === null ? '한도 없음' : `한도 ${usd(row.budget_usd)}`;
    const flag = row.state === 'exceeded' ? '  ← 넘김' : '';

    console.log(`${AI_FEATURE_LABEL[row.feature].padEnd(12)} ${usd(row.spent_usd)} / ${budget}${flag}`);

    /*
     * 단가를 모르는 호출이 있으면 반드시 말한다. 그 호출은 합계에서 빠져 있어,
     * 실제 지출이 여기 적힌 것보다 크다.
     */
    if (Number(row.uncosted_count) > 0) {
      console.log(
        `${' '.repeat(13)}단가를 모르는 호출 ${row.uncosted_count}건이 합계에서 빠져 있다.`
      );
    }
  }
}

async function usage(pool: ReturnType<typeof createPool>, months: number): Promise<void> {
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

  if (rows.length === 0) {
    console.log('기록이 없다.');

    return;
  }

  for (const row of rows) {
    console.log(
      `\n${row.month.toISOString().slice(0, 7)}  ${AI_FEATURE_LABEL[row.feature]}  ${row.model}`
    );
    console.log(`  호출 ${row.request_count}건 · ${usd(row.estimated_cost_usd)}`);
    console.log(
      `  토큰 입력 ${row.input_tokens} (캐시 ${row.cached_input_tokens}) · 출력 ${row.output_tokens}`
    );
    console.log(
      `  성공 ${pct(row.success_rate)} · 상위 모델로 올라간 비율 ${pct(row.escalation_rate)}`
    );

    /*
     * 수정률은 확인한 사람이 있어야 나온다. 아직 아무도 확인하지 않았으면 0이
     * 아니라 "—"다 — 0으로 보이면 읽기가 완벽한 줄 안다.
     */
    console.log(
      `  사람이 고친 비율 ${pct(row.user_correction_rate)}` +
        (Number(row.correction_unknown_count) > 0
          ? ` (아직 모름 ${row.correction_unknown_count}건)`
          : '')
    );

    if (row.median_latency_ms !== null) {
      console.log(`  중간 응답 시간 ${Math.round(Number(row.median_latency_ms))}ms`);
    }
  }

  console.log(
    '\n상위 모델로 올라간 비율이 높으면 저비용 모델을 먼저 부르는 것이 손해다 — 두 번 부르는 값이 한 번에 좋은 모델을 부르는 값보다 커진다.'
  );
}

async function setBudget(
  pool: ReturnType<typeof createPool>,
  feature: AiFeature,
  amount: number,
  by: string
): Promise<void> {
  await pool.query(
    `INSERT INTO structured.ai_budgets (feature, month, budget_usd, set_by)
     VALUES ($1, date_trunc('month', now())::date, $2, $3)
     ON CONFLICT (feature, month) DO UPDATE
       SET budget_usd = excluded.budget_usd, set_by = excluded.set_by, set_at = now()`,
    [feature, amount, by]
  );

  console.log(`${AI_FEATURE_LABEL[feature]} 이번 달 한도를 $${amount.toFixed(2)}로 정했다.`);
  console.log('넘기면 사진에서 읽어주는 것만 멈춘다. 등록과 나머지 기능은 그대로 돈다.');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const pool = createPool(loadConfig().databaseUrl);

  try {
    if (args.includes('--status')) {
      await status(pool);

      return;
    }

    if (args.includes('--usage')) {
      const index = args.indexOf('--months');
      const months = index >= 0 ? Number(args[index + 1]) : 3;

      await usage(pool, Number.isFinite(months) && months > 0 ? months : 3);

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

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('한도는 0보다 큰 금액이어야 한다.');
      }

      // 누가 정했는지 남는다. 인증 심사·문의와 같은 규칙이다.
      if (!by) {
        throw new Error('--by <user-id>로 정한 사람을 남겨라.');
      }

      await setBudget(pool, feature, amount, by);

      return;
    }

    const clearIndex = args.indexOf('--clear-budget');

    if (clearIndex >= 0) {
      const feature = args[clearIndex + 1];

      if (!feature || !isFeature(feature)) {
        throw new Error(`기능을 골라라: ${AI_FEATURES.join(' | ')}`);
      }

      await pool.query(
        `DELETE FROM structured.ai_budgets
         WHERE feature = $1 AND month = date_trunc('month', now())::date`,
        [feature]
      );

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
        '  --clear-budget <기능>             한도를 없앤다',
        '',
        `기능: ${AI_FEATURES.join(' | ')}`,
      ].join('\n')
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
