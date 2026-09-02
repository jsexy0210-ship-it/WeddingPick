import { INQUIRY_CATEGORY_RULES, INQUIRY_STATUS_LABEL } from '@weddingpick/domain';
import type { InquiryCategory, InquiryStatus } from '@weddingpick/domain';
import type { Pool } from 'pg';

import { escapeHtml, renderPage } from '../html';

const when = (at: Date): string => at.toISOString().slice(0, 16).replace('T', ' ');

/**
 * WP-ADM-021 사용자 · VOC.
 *
 * `apps/api/src/inquiry-admin.ts`의 `--list`(대기)와 최근 문의 조회를 합친
 * 것이다. "자동 분류·자동 응답·에스컬레이션"은 조사 결과 스키마에 없다 —
 * 지금은 사람이 카테고리를 직접 고르고 직접 답한다(문의는 전부 수동 처리).
 */
export async function renderVocPage(pool: Pool): Promise<string> {
  const pending = await pool.query<{
    id: string;
    category: InquiryCategory;
    status: InquiryStatus;
    subject_kind: string | null;
    subject_id: string | null;
    received_at: Date;
  }>(
    `SELECT id, category, status, subject_kind, subject_id, received_at
     FROM structured.inquiries
     WHERE status IN ('received', 'in_review')
     ORDER BY received_at`
  );

  const recent = await pool.query<{
    id: string;
    category: InquiryCategory;
    status: InquiryStatus;
    received_at: Date;
    decided_at: Date | null;
  }>(
    `SELECT id, category, status, received_at, decided_at
     FROM structured.inquiries
     ORDER BY received_at DESC
     LIMIT 30`
  );

  const reports = await pool.query<{ count: string }>(
    `SELECT count(*)::text FROM structured.review_reports WHERE decided_at IS NULL`
  );

  const body = `
    <h1>VOC</h1>
    <p class="subtitle">문의는 전부 사람이 직접 확인하고 답한다 — 서비스정책서 6번.</p>

    <div class="card-row">
      <div class="card"><div class="label">처리 대기 문의</div><div class="value">${pending.rows.length}</div></div>
      <div class="card"><div class="label">미결 후기 신고</div><div class="value">${reports.rows[0]!.count}</div></div>
    </div>

    <h2>처리 대기</h2>
    ${
      pending.rows.length === 0
        ? '<p class="empty">처리할 문의가 없어요.</p>'
        : `<table>
            <thead><tr><th>접수</th><th>분류</th><th>상태</th><th>대상</th></tr></thead>
            <tbody>
              ${pending.rows
                .map(
                  (row) => `<tr>
                    <td>${when(row.received_at)}</td>
                    <td>${escapeHtml(INQUIRY_CATEGORY_RULES[row.category]?.label ?? row.category)}</td>
                    <td><span class="badge warn">${escapeHtml(INQUIRY_STATUS_LABEL[row.status] ?? row.status)}</span></td>
                    <td>${row.subject_kind ? `${escapeHtml(row.subject_kind)}:<code>${row.subject_id?.slice(0, 8)}…</code>` : '—'}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>`
    }

    <h2 style="margin-top:32px;">최근 문의 30건</h2>
    ${
      recent.rows.length === 0
        ? '<p class="empty">아직 문의가 없어요.</p>'
        : `<table>
            <thead><tr><th>접수</th><th>분류</th><th>상태</th><th>처리일</th></tr></thead>
            <tbody>
              ${recent.rows
                .map(
                  (row) => `<tr>
                    <td>${when(row.received_at)}</td>
                    <td>${escapeHtml(INQUIRY_CATEGORY_RULES[row.category]?.label ?? row.category)}</td>
                    <td>${escapeHtml(INQUIRY_STATUS_LABEL[row.status] ?? row.status)}</td>
                    <td>${row.decided_at ? when(row.decided_at) : '—'}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>`
    }
  `;

  return renderPage({ title: 'VOC', activePath: '/voc', body });
}
