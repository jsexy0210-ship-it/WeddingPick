import { AI_FEATURE_LABEL, MODEL_PRICES_AS_OF, type AiFeature } from '@weddingpick/domain';
import type { Pool } from 'pg';

import { escapeHtml, renderPage } from '../html';

const usd = (value: string | null) => (value === null ? '—' : `$${Number(value).toFixed(4)}`);
const pct = (value: string | null) => (value === null ? '—' : `${Math.round(Number(value) * 100)}%`);

/**
 * WP-ADM-050 시스템 · AI 사용량·비용.
 *
 * `apps/api/src/ai-cost-admin.ts`의 `--status`·`--usage` 쿼리를 그대로 쓴다 —
 * 화면데이터구조 스펙 7.3이 요구한 지표를 재는 곳은 이미 있었고, 이 화면은
 * 그것을 웹에서 보여주는 것뿐이다.
 */
export async function renderAiCostPage(pool: Pool): Promise<string> {
  const status = await pool.query<{
    feature: AiFeature;
    spent_usd: string;
    budget_usd: string | null;
    state: string;
    uncosted_count: string;
  }>('SELECT * FROM structured.ai_budget_status ORDER BY feature');

  const usage = await pool.query<{
    feature: AiFeature;
    month: Date;
    model: string;
    request_count: string;
    estimated_cost_usd: string | null;
    success_rate: string;
    escalation_rate: string;
    user_correction_rate: string | null;
    correction_unknown_count: string;
    median_latency_ms: string | null;
  }>(
    `SELECT feature, month, model, request_count, estimated_cost_usd, success_rate,
            escalation_rate, user_correction_rate, correction_unknown_count, median_latency_ms
     FROM structured.ai_usage_monthly
     WHERE month >= date_trunc('month', now()) - interval '3 months'
     ORDER BY month DESC, feature, model`
  );

  const body = `
    <h1>AI 사용량·비용</h1>
    <p class="subtitle">단가 기준일 ${escapeHtml(MODEL_PRICES_AS_OF)}. 최근 3개월.</p>

    <h2>이번 달</h2>
    ${
      status.rows.length === 0
        ? '<p class="empty">아직 이번 달 사용 기록이 없어요.</p>'
        : `<table>
            <thead><tr><th>기능</th><th>지출</th><th>한도</th><th>상태</th></tr></thead>
            <tbody>
              ${status.rows
                .map(
                  (row) => `<tr>
                    <td>${escapeHtml(AI_FEATURE_LABEL[row.feature] ?? row.feature)}</td>
                    <td>${usd(row.spent_usd)}${Number(row.uncosted_count) > 0 ? `<div style="font-size:12px;color:#868b94;">단가 모르는 호출 ${row.uncosted_count}건 별도</div>` : ''}</td>
                    <td>${row.budget_usd === null ? '한도 없음' : usd(row.budget_usd)}</td>
                    <td>${row.state === 'exceeded' ? '<span class="badge bad">넘김</span>' : '<span class="badge">정상</span>'}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>`
    }

    <h2 style="margin-top:32px;">월별 · 기능 · 모델별 지표</h2>
    ${
      usage.rows.length === 0
        ? '<p class="empty">기록이 없어요.</p>'
        : `<table>
            <thead>
              <tr><th>월</th><th>기능</th><th>모델</th><th>호출</th><th>비용</th><th>성공률</th><th>상위 모델 전환</th><th>사람이 고친 비율</th><th>중간 응답</th></tr>
            </thead>
            <tbody>
              ${usage.rows
                .map(
                  (row) => `<tr>
                    <td>${row.month.toISOString().slice(0, 7)}</td>
                    <td>${escapeHtml(AI_FEATURE_LABEL[row.feature] ?? row.feature)}</td>
                    <td>${escapeHtml(row.model)}</td>
                    <td>${row.request_count}건</td>
                    <td>${usd(row.estimated_cost_usd)}</td>
                    <td>${pct(row.success_rate)}</td>
                    <td>${pct(row.escalation_rate)}</td>
                    <td>${pct(row.user_correction_rate)}${Number(row.correction_unknown_count) > 0 ? ` (모름 ${row.correction_unknown_count})` : ''}</td>
                    <td>${row.median_latency_ms === null ? '—' : `${Math.round(Number(row.median_latency_ms))}ms`}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
          <p class="subtitle" style="margin-top:12px;">상위 모델로 올라간 비율이 높으면 저비용 모델을 먼저 부르는 것이 손해다 — 두 번 부르는 값이 한 번에 좋은 모델을 부르는 값보다 커진다.</p>`
    }
  `;

  return renderPage({ title: 'AI 사용량·비용', activePath: '/ai-cost', body });
}
