import type { Pool } from 'pg';

import { escapeHtml, renderPage } from '../html';

const when = (at: Date): string => at.toISOString().slice(0, 16).replace('T', ' ');

const EVENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * WP-ADM-052 감사 로그.
 *
 * `decisions-admin.ts`의 `--event <id>` 쿼리와 같은 자리다. 최근 사건 목록을
 * 먼저 보여주고, 사건 하나를 고르면(또는 id를 직접 넣으면) 그 사건이 어느
 * 단계를 어떻게 지나왔는지 순서대로 보여준다.
 */
export async function renderAuditLogPage(pool: Pool, eventId: string | undefined): Promise<string> {
  if (eventId && !EVENT_ID_PATTERN.test(eventId)) {
    return renderPage({
      title: '감사 로그',
      activePath: '/audit-log',
      body: `<h1>감사 로그</h1>${searchForm(eventId)}<p class="empty">사건 id 형식이 아니에요.</p>`,
    });
  }

  if (eventId) {
    const { rows } = await pool.query<{
      step: string;
      decider: string;
      decision: string;
      reason_code: string;
      confidence: string | null;
      execution_status: string;
      created_at: Date;
    }>(
      `SELECT step, decider::text, decision, reason_code, confidence, execution_status, created_at
       FROM structured.decisions WHERE event_id = $1 ORDER BY created_at`,
      [eventId]
    );

    const body = `
      <h1>감사 로그</h1>
      ${searchForm(eventId)}
      ${
        rows.length === 0
          ? '<p class="empty">그런 사건이 없어요.</p>'
          : `<h2>사건 <code>${escapeHtml(eventId)}</code> — ${rows.length}단계</h2>
            <table>
              <thead><tr><th>때</th><th>단계</th><th>결정자</th><th>결정</th><th>사유</th><th>확신</th><th>상태</th></tr></thead>
              <tbody>
                ${rows
                  .map(
                    (row) => `<tr>
                      <td>${when(row.created_at)}</td>
                      <td>${escapeHtml(row.step)}</td>
                      <td>${escapeHtml(row.decider)}</td>
                      <td>${escapeHtml(row.decision)}</td>
                      <td>${escapeHtml(row.reason_code)}</td>
                      <td>${row.confidence ?? '—'}</td>
                      <td>${escapeHtml(row.execution_status)}</td>
                    </tr>`
                  )
                  .join('')}
              </tbody>
            </table>`
      }
    `;

    return renderPage({ title: '감사 로그', activePath: '/audit-log', body });
  }

  const { rows } = await pool.query<{
    event_id: string;
    workflow: string;
    steps: string;
    last_at: Date;
    has_open: boolean;
  }>(
    `SELECT event_id, min(workflow) AS workflow, count(*)::text AS steps, max(created_at) AS last_at,
            bool_or(execution_status IN ('failed', 'pending')) AS has_open
     FROM structured.decisions
     GROUP BY event_id
     ORDER BY max(created_at) DESC
     LIMIT 50`
  );

  const body = `
    <h1>감사 로그</h1>
    <p class="subtitle">최근 사건 50건. 사건 하나가 여러 단계(결정)를 가질 수 있다.</p>
    ${searchForm(undefined)}
    ${
      rows.length === 0
        ? '<p class="empty">아직 결정 기록이 없어요.</p>'
        : `<table>
            <thead><tr><th>때</th><th>Workflow</th><th>사건 id</th><th>단계 수</th><th>상태</th></tr></thead>
            <tbody>
              ${rows
                .map(
                  (row) => `<tr>
                    <td>${when(row.last_at)}</td>
                    <td>${escapeHtml(row.workflow)}</td>
                    <td><a href="/audit-log?event=${row.event_id}"><code>${row.event_id.slice(0, 8)}…</code></a></td>
                    <td>${row.steps}</td>
                    <td>${row.has_open ? '<span class="badge warn">확인 필요</span>' : '<span class="badge">완료</span>'}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>`
    }
  `;

  return renderPage({ title: '감사 로그', activePath: '/audit-log', body });
}

function searchForm(current: string | undefined): string {
  return `<form method="get" action="/audit-log" style="margin-bottom:16px;display:flex;gap:8px;">
    <input type="text" name="event" placeholder="사건 id로 찾기" value="${current ? escapeHtml(current) : ''}"
      style="flex:1;padding:8px 12px;border:1px solid #dcdee3;border-radius:6px;">
    <button type="submit" style="padding:8px 16px;border-radius:6px;border:none;background:#ff6f61;color:#fff;">찾기</button>
  </form>`;
}
