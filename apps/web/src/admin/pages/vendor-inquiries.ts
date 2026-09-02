import { CLAIM_STATUS_LABEL } from '@weddingpick/domain';
import type { Pool } from 'pg';

import { escapeHtml, renderPage } from '../html';

const when = (at: Date): string => at.toISOString().slice(0, 16).replace('T', ' ');

const METHOD_LABEL: Record<string, string> = {
  official_domain_email: '공식 도메인 이메일',
  listed_email: '공개된 이메일',
  business_document: '사업자 증빙',
};

const CORRECTION_STATUS_LABEL: Record<string, string> = {
  pending: '접수',
  approved: '승인',
  rejected: '반려',
  superseded: '최신 신청으로 대체',
};

/**
 * WP-ADM-023 사용자 · 업체 문의 큐.
 *
 * `structured.vendor_claims`(0038, 관계자 인증)와 `vendor_corrections`(0051,
 * 정보 정정)을 합쳐 보여준다. "저신뢰·법적 위험 건만 관리자 확인"으로
 * 거르는 자동 분류는 조사 결과 없다 — 지금은 대기 중인 모든 신청이 똑같이
 * 노출된다(`vendor-claim-admin.ts` 참조).
 */
export async function renderVendorInquiriesPage(pool: Pool): Promise<string> {
  const claims = await pool.query<{
    id: string;
    vendor_name: string;
    claimed_role: string;
    method: string;
    status: string;
    created_at: Date;
  }>(
    `SELECT c.id, v.name AS vendor_name, c.claimed_role, c.method::text, c.status::text, c.created_at
     FROM structured.vendor_claims c
     JOIN structured.vendors v ON v.id = c.vendor_id
     ORDER BY c.created_at DESC
     LIMIT 30`
  );

  const corrections = await pool.query<{
    id: string;
    vendor_name: string;
    field_name: string;
    requested_value: string;
    status: string;
    created_at: Date;
  }>(
    `SELECT c.id, v.name AS vendor_name, c.field_name, c.requested_value, c.status::text, c.created_at
     FROM structured.vendor_corrections c
     JOIN structured.vendors v ON v.id = c.vendor_id
     ORDER BY c.created_at DESC
     LIMIT 30`
  );

  const pendingClaims = claims.rows.filter((row) => row.status === 'pending').length;
  const pendingCorrections = corrections.rows.filter((row) => row.status === 'pending').length;

  const body = `
    <h1>업체 문의 큐</h1>
    <p class="subtitle">관계자 인증(소속 확인)과 정보 정정 요청. 신청 순서대로 처리한다.</p>

    <div class="card-row">
      <div class="card"><div class="label">관계자 인증 대기</div><div class="value">${pendingClaims}</div></div>
      <div class="card"><div class="label">정보 정정 대기</div><div class="value">${pendingCorrections}</div></div>
    </div>

    <h2>관계자 인증 최근 30건</h2>
    ${
      claims.rows.length === 0
        ? '<p class="empty">아직 신청이 없어요.</p>'
        : `<table>
            <thead><tr><th>때</th><th>업체</th><th>밝힌 소속</th><th>증빙 방법</th><th>상태</th></tr></thead>
            <tbody>
              ${claims.rows
                .map(
                  (row) => `<tr>
                    <td>${when(row.created_at)}</td>
                    <td>${escapeHtml(row.vendor_name)}</td>
                    <td>${escapeHtml(row.claimed_role)}</td>
                    <td>${METHOD_LABEL[row.method] ?? escapeHtml(row.method)}</td>
                    <td>${row.status === 'pending' ? '<span class="badge warn">' : row.status === 'rejected' ? '<span class="badge bad">' : '<span class="badge">'}${escapeHtml(CLAIM_STATUS_LABEL[row.status as keyof typeof CLAIM_STATUS_LABEL] ?? row.status)}</span></td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>`
    }

    <h2 style="margin-top:32px;">정보 정정 최근 30건</h2>
    ${
      corrections.rows.length === 0
        ? '<p class="empty">아직 신청이 없어요.</p>'
        : `<table>
            <thead><tr><th>때</th><th>업체</th><th>항목</th><th>요청값</th><th>상태</th></tr></thead>
            <tbody>
              ${corrections.rows
                .map(
                  (row) => `<tr>
                    <td>${when(row.created_at)}</td>
                    <td>${escapeHtml(row.vendor_name)}</td>
                    <td><code>${escapeHtml(row.field_name)}</code></td>
                    <td>${escapeHtml(row.requested_value)}</td>
                    <td>${row.status === 'pending' ? '<span class="badge warn">' : row.status === 'rejected' ? '<span class="badge bad">' : '<span class="badge">'}${CORRECTION_STATUS_LABEL[row.status] ?? escapeHtml(row.status)}</span></td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>`
    }
  `;

  return renderPage({ title: '업체 문의 큐', activePath: '/vendor-inquiries', body });
}
