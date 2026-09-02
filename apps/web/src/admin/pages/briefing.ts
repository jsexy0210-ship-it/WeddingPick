import type { Pool } from 'pg';

import { escapeHtml, renderPage } from '../html';

/**
 * WP-ADM-002 일일 브리핑.
 *
 * `apps/api/src/decisions-admin.ts`의 `--briefing` 쿼리와 같은 것을 쓴다 —
 * 그 CLI가 이미 "개별 큐를 열 필요가 없는 것이 목표"라는 원칙으로 만든 자리다.
 * 여기서는 그 결과를 터미널 대신 표로 보여줄 뿐, 판단 기준을 새로 만들지 않는다.
 */
export async function renderBriefingPage(pool: Pool): Promise<string> {
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

  const totalDecisions = rows.reduce((sum, row) => sum + Number(row.decisions), 0);
  const totalFailed = rows.reduce((sum, row) => sum + Number(row.failed), 0);
  const totalCost = rows.reduce((sum, row) => sum + (row.cost === null ? 0 : Number(row.cost)), 0);

  const body = `
    <h1>일일 브리핑</h1>
    <p class="subtitle">최근 24시간 동안 자동화가 내린 결정. workflow·decider별로 묶었다.</p>

    <div class="card-row">
      <div class="card"><div class="label">전체 결정</div><div class="value">${totalDecisions}</div></div>
      <div class="card"><div class="label">미해결</div><div class="value">${totalFailed}</div></div>
      <div class="card"><div class="label">AI 비용</div><div class="value">$${totalCost.toFixed(2)}</div></div>
    </div>

    ${
      rows.length === 0
        ? '<p class="empty">최근 24시간 동안 결정이 없었어요.</p>'
        : `<table>
            <thead>
              <tr><th>Workflow</th><th>Decider</th><th>결정 건수</th><th>미해결</th><th>비용</th></tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row) => `<tr>
                    <td>${escapeHtml(row.workflow)}</td>
                    <td>${escapeHtml(row.decider)}</td>
                    <td>${row.decisions}건</td>
                    <td>${Number(row.failed) > 0 ? `<span class="badge warn">${row.failed}건</span>` : '0건'}</td>
                    <td>${row.cost === null ? '—' : `$${Number(row.cost).toFixed(4)}`}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>`
    }
  `;

  return renderPage({ title: '일일 브리핑', activePath: '/briefing', body });
}
