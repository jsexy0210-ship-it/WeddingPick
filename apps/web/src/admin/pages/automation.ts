import type { Pool } from 'pg';

import { escapeHtml, renderPage } from '../html';

const when = (at: Date): string => at.toISOString().slice(0, 16).replace('T', ' ');

/**
 * WP-ADM-040 운영 · 자동화 상태.
 *
 * `structured.open_decisions`는 H장이 정의한 "사람 손이 필요한 것"만 담는
 * 뷰다(0001, `decisions-admin.ts`의 `--open`과 같은 쿼리). 비어 있는 것이
 * 목표한 상태다 — 빈 화면을 오류로 다루지 않는다.
 */
export async function renderAutomationPage(pool: Pool): Promise<string> {
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

  const body = `
    <h1>자동화 상태</h1>
    <p class="subtitle">사람 손이 필요한 것만 여기 모인다. 조용한 화면이 정상이다.</p>

    ${
      rows.length === 0
        ? '<p class="empty">사람 손이 필요한 것이 없어요.</p>'
        : `<table>
            <thead>
              <tr><th>때</th><th>Workflow / Step</th><th>대상</th><th>사유</th><th>상태</th></tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row) => `<tr>
                    <td>${when(row.created_at)}</td>
                    <td>${escapeHtml(row.workflow)} / ${escapeHtml(row.step)}</td>
                    <td>${escapeHtml(row.subject_kind)}${row.subject_id ? `:<code>${escapeHtml(row.subject_id.slice(0, 8))}</code>` : ''}</td>
                    <td>${escapeHtml(row.reason_code)}</td>
                    <td><span class="badge ${row.execution_status === 'failed' ? 'bad' : 'warn'}">${escapeHtml(row.execution_status)}</span></td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>`
    }
  `;

  return renderPage({ title: '자동화 상태', activePath: '/automation', body });
}
