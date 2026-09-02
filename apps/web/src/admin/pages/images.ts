import type { Pool } from 'pg';

import { escapeHtml, renderPage } from '../html';

const when = (at: Date): string => at.toISOString().slice(0, 16).replace('T', ' ');

const STATUS_LABEL: Record<string, string> = {
  pending: '검증 전',
  rights_rejected: '저작권 반려',
  match_rejected: '매칭 반려',
  quality_rejected: '품질 반려',
  crop_failed: 'Crop 실패',
  approved: '승인',
};

const RIGHTS_LABEL: Record<string, string> = {
  public_domain: '저작권 없음',
  cc_by: 'CC BY',
  cc_by_sa: 'CC BY-SA',
  kogl_type1: '공공누리 1유형',
  kogl_type4: '공공누리 4유형',
  vendor_provided: '업체 제공',
  unknown: '확인 안 됨',
};

/** WP-ADM-015 데이터 · 이미지 자동수급. `structured.vendor_images`(0050)를 읽는다. */
export async function renderImagesPage(pool: Pool): Promise<string> {
  const counts = await pool.query<{ status: string; count: string }>(
    `SELECT status::text, count(*)::text FROM structured.vendor_images GROUP BY status ORDER BY status`
  );

  const { rows } = await pool.query<{
    id: string;
    vendor_id: string;
    vendor_name: string;
    copyright_basis: string;
    match_confidence: string;
    quality_score: string | null;
    status: string;
    rejection_reason: string | null;
    is_representative: boolean;
    created_at: Date;
  }>(
    `SELECT i.id, i.vendor_id, v.name AS vendor_name, i.copyright_basis::text, i.match_confidence::text,
            i.quality_score::text, i.status::text, i.rejection_reason, i.is_representative, i.created_at
     FROM structured.vendor_images i
     JOIN structured.vendors v ON v.id = i.vendor_id
     ORDER BY i.created_at DESC
     LIMIT 40`
  );

  const countsByStatus = Object.fromEntries(counts.rows.map((row) => [row.status, row.count]));

  const body = `
    <h1>이미지 자동수급</h1>
    <p class="subtitle">저작권 확인 → 업체 매칭 → 품질 검증 → Crop 순으로 검증한다. 대표 이미지는 승인된 것 중 하나다.</p>

    <div class="card-row">
      ${Object.entries(STATUS_LABEL)
        .map(
          ([key, label]) =>
            `<div class="card"><div class="label">${label}</div><div class="value">${countsByStatus[key] ?? 0}</div></div>`
        )
        .join('')}
    </div>

    <h2>최근 40건</h2>
    ${
      rows.length === 0
        ? '<p class="empty">아직 수급된 이미지가 없어요.</p>'
        : `<table>
            <thead>
              <tr><th>때</th><th>업체</th><th>저작권</th><th>매칭 신뢰도</th><th>품질</th><th>상태</th><th>대표</th></tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row) => `<tr>
                    <td>${when(row.created_at)}</td>
                    <td>${escapeHtml(row.vendor_name)}</td>
                    <td>${RIGHTS_LABEL[row.copyright_basis] ?? escapeHtml(row.copyright_basis)}</td>
                    <td>${Math.round(Number(row.match_confidence) * 100)}%</td>
                    <td>${row.quality_score === null ? '—' : `${Math.round(Number(row.quality_score) * 100)}%`}</td>
                    <td>
                      ${row.status === 'approved' ? '<span class="badge">승인</span>' : row.status === 'pending' ? '<span class="badge warn">검증 전</span>' : `<span class="badge bad">${STATUS_LABEL[row.status] ?? escapeHtml(row.status)}</span>`}
                      ${row.rejection_reason ? `<div style="font-size:12px;color:#868b94;margin-top:2px;">${escapeHtml(row.rejection_reason)}</div>` : ''}
                    </td>
                    <td>${row.is_representative ? '✓' : ''}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>`
    }
  `;

  return renderPage({ title: '이미지 자동수급', activePath: '/images', body });
}
