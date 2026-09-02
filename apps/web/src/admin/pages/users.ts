import type { Pool } from 'pg';

import { escapeHtml, renderPage } from '../html';

const when = (at: Date | null): string => (at ? at.toISOString().slice(0, 10) : '—');

/**
 * WP-ADM-020 사용자 · 계정.
 *
 * `structured.active_users`(0046)만 본다 — 대기 계정(소셜 로그인만 하고 동의를
 * 안 끝낸 사람)은 서비스를 쓸 수 없는 사람이라 계정 목록에 사람으로 세면 안
 * 된다는 것이 그 뷰가 하는 일이다. 대기·탈퇴는 개수만 따로 센다.
 */
export async function renderUsersPage(pool: Pool): Promise<string> {
  const counts = await pool.query<{ active: string; pending: string; deleted: string }>(
    `SELECT
       (SELECT count(*) FROM structured.active_users)::text AS active,
       (SELECT count(*) FROM structured.users WHERE activated_at IS NULL AND deleted_at IS NULL)::text AS pending,
       (SELECT count(*) FROM structured.users WHERE deleted_at IS NOT NULL)::text AS deleted
    `
  );

  const { rows } = await pool.query<{
    id: string;
    display_name: string | null;
    is_operator: boolean;
    created_at: Date;
    activated_at: Date | null;
  }>(
    `SELECT id, display_name, is_operator, created_at, activated_at
     FROM structured.active_users
     ORDER BY created_at DESC
     LIMIT 50`
  );

  const summary = counts.rows[0]!;

  const body = `
    <h1>사용자</h1>
    <p class="subtitle">가입이 끝나고 탈퇴하지 않은 사람만 "활성"으로 센다(v3.13 §N-2).</p>

    <div class="card-row">
      <div class="card"><div class="label">활성</div><div class="value">${summary.active}</div></div>
      <div class="card"><div class="label">가입 대기</div><div class="value">${summary.pending}</div></div>
      <div class="card"><div class="label">탈퇴</div><div class="value">${summary.deleted}</div></div>
    </div>

    <h2>최근 가입 50명</h2>
    ${
      rows.length === 0
        ? '<p class="empty">아직 활성 사용자가 없어요.</p>'
        : `<table>
            <thead><tr><th>id</th><th>이름</th><th>가입일</th><th>활성화일</th><th>운영자</th></tr></thead>
            <tbody>
              ${rows
                .map(
                  (row) => `<tr>
                    <td><code>${row.id.slice(0, 8)}…</code></td>
                    <td>${row.display_name ? escapeHtml(row.display_name) : '<span class="empty" style="padding:0;background:none;">이름 없음</span>'}</td>
                    <td>${when(row.created_at)}</td>
                    <td>${when(row.activated_at)}</td>
                    <td>${row.is_operator ? '<span class="badge">운영자</span>' : ''}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>`
    }
  `;

  return renderPage({ title: '사용자', activePath: '/users', body });
}
