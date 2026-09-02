import { REBUTTAL_STATUS_LABEL, REPORT_REASON_LABEL } from '@weddingpick/domain';
import type { ReportReason } from '@weddingpick/domain';
import type { Pool } from 'pg';

import { escapeHtml, renderPage } from '../html';

const when = (at: Date): string => at.toISOString().slice(0, 16).replace('T', ' ');

/**
 * WP-ADM-022 사용자 · 후기·반론.
 *
 * `structured.review_reports`(0020)와 `structured.review_rebuttals`(0032)를
 * 함께 본다. "신고 자동처리"·"법적 분쟁만 상신" 필터는 조사 결과 스키마에
 * 없다 — 신고와 반론 모두 사람이 하나씩 결정한다(`rebuttal-admin.ts` 참조).
 */
export async function renderReviewsPage(pool: Pool): Promise<string> {
  const openReports = await pool.query<{
    id: string;
    vendor_name: string;
    reason: ReportReason;
    received_at: Date;
  }>(
    `SELECT rr.id, v.name AS vendor_name, rr.reason::text AS reason, rr.received_at
     FROM structured.review_reports rr
     JOIN structured.reviews r ON r.id = rr.review_id
     JOIN structured.vendors v ON v.id = r.vendor_id
     WHERE rr.decided_at IS NULL
     ORDER BY rr.received_at`
  );

  const rebuttals = await pool.query<{
    id: string;
    vendor_name: string;
    claimed_role: string;
    status: string;
    created_at: Date;
  }>(
    `SELECT b.id, v.name AS vendor_name, b.claimed_role, b.status::text, b.created_at
     FROM structured.review_rebuttals b
     JOIN structured.reviews r ON r.id = b.review_id
     JOIN structured.vendors v ON v.id = r.vendor_id
     ORDER BY b.created_at DESC
     LIMIT 30`
  );

  const body = `
    <h1>후기·반론</h1>
    <p class="subtitle">자동 게시는 없다 — 반론이 사람 없이 후기 옆에 붙으면 누구나 업체라고 말하기만 하면 된다.</p>

    <div class="card-row">
      <div class="card"><div class="label">미결 후기 신고</div><div class="value">${openReports.rows.length}</div></div>
      <div class="card"><div class="label">반론 심사 대기</div><div class="value">${rebuttals.rows.filter((r) => r.status === 'pending').length}</div></div>
    </div>

    <h2>미결 후기 신고</h2>
    ${
      openReports.rows.length === 0
        ? '<p class="empty">확인할 신고가 없어요.</p>'
        : `<table>
            <thead><tr><th>접수</th><th>업체</th><th>사유</th></tr></thead>
            <tbody>
              ${openReports.rows
                .map(
                  (row) => `<tr>
                    <td>${when(row.received_at)}</td>
                    <td>${escapeHtml(row.vendor_name)}</td>
                    <td>${escapeHtml(REPORT_REASON_LABEL[row.reason] ?? row.reason)}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>`
    }

    <h2 style="margin-top:32px;">최근 업체 반론 30건</h2>
    ${
      rebuttals.rows.length === 0
        ? '<p class="empty">아직 반론이 없어요.</p>'
        : `<table>
            <thead><tr><th>때</th><th>업체</th><th>본인이 밝힌 소속</th><th>상태</th></tr></thead>
            <tbody>
              ${rebuttals.rows
                .map(
                  (row) => `<tr>
                    <td>${when(row.created_at)}</td>
                    <td>${escapeHtml(row.vendor_name)}</td>
                    <td>${escapeHtml(row.claimed_role)}</td>
                    <td>${row.status === 'pending' ? '<span class="badge warn">' : row.status === 'rejected' ? '<span class="badge bad">' : '<span class="badge">'}${escapeHtml(REBUTTAL_STATUS_LABEL[row.status as keyof typeof REBUTTAL_STATUS_LABEL] ?? row.status)}</span></td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>`
    }
  `;

  return renderPage({ title: '후기·반론', activePath: '/reviews', body });
}
