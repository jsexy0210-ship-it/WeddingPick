import type { Pool } from 'pg';

import { escapeHtml, renderPage } from '../html';

const when = (at: Date): string => at.toISOString().slice(0, 16).replace('T', ' ');

const CAUSE_LABEL: Record<string, string> = {
  import: '임포트',
  admin: '관리자 수정',
  correction: '정정 승인',
  claim: '관계자 인증',
};

/**
 * WP-ADM-014 데이터 · 업체 관리.
 *
 * `structured.vendors`의 영업상태 컬럼(0047)과 `vendor_change_log`(0048)를
 * 읽는다. 업체 병합·분리는 조사 결과 스키마 자체가 없다 — 억지로 만들지
 * 않는다(이 화면은 읽기 전용이라 어차피 그런 동작은 못 넣는다).
 */
export async function renderVendorsPage(pool: Pool): Promise<string> {
  const counts = await pool.query<{ total: string; inactive: string; locked: string }>(
    `SELECT
       count(*)::text AS total,
       count(*) FILTER (WHERE NOT is_active)::text AS inactive,
       count(*) FILTER (WHERE admin_locked)::text AS locked
     FROM structured.vendors`
  );

  const inactive = await pool.query<{
    id: string;
    name: string;
    region: string;
    closed_at: Date;
  }>(
    `SELECT id, name, region, closed_at
     FROM structured.vendors
     WHERE NOT is_active
     ORDER BY closed_at DESC
     LIMIT 20`
  );

  const changes = await pool.query<{
    vendor_name: string;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    cause: string;
    changed_at: Date;
  }>(
    `SELECT v.name AS vendor_name, c.field_name, c.old_value, c.new_value, c.cause::text, c.changed_at
     FROM structured.vendor_change_log c
     JOIN structured.vendors v ON v.id = c.vendor_id
     ORDER BY c.changed_at DESC
     LIMIT 40`
  );

  const summary = counts.rows[0]!;

  const body = `
    <h1>업체 관리</h1>
    <p class="subtitle">영업상태 전환과 데이터 변경 이력. 즉시 삭제하지 않고 상태만 바꾼다.</p>

    <div class="card-row">
      <div class="card"><div class="label">전체 업체</div><div class="value">${summary.total}</div></div>
      <div class="card"><div class="label">폐업 처리</div><div class="value">${summary.inactive}</div></div>
      <div class="card"><div class="label">관리자 잠금</div><div class="value">${summary.locked}</div></div>
    </div>

    <h2>최근 폐업 전환 20건</h2>
    ${
      inactive.rows.length === 0
        ? '<p class="empty">폐업 처리된 업체가 없어요.</p>'
        : `<table>
            <thead><tr><th>업체</th><th>지역</th><th>폐업 확인일</th></tr></thead>
            <tbody>
              ${inactive.rows
                .map(
                  (row) => `<tr>
                    <td>${escapeHtml(row.name)}</td>
                    <td>${escapeHtml(row.region)}</td>
                    <td>${when(row.closed_at)}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>`
    }

    <h2 style="margin-top:32px;">최근 변경 이력 40건</h2>
    ${
      changes.rows.length === 0
        ? '<p class="empty">아직 변경 이력이 없어요.</p>'
        : `<table>
            <thead><tr><th>때</th><th>업체</th><th>항목</th><th>이전 → 이후</th><th>원인</th></tr></thead>
            <tbody>
              ${changes.rows
                .map(
                  (row) => `<tr>
                    <td>${when(row.changed_at)}</td>
                    <td>${escapeHtml(row.vendor_name)}</td>
                    <td><code>${escapeHtml(row.field_name)}</code></td>
                    <td>${row.old_value ? escapeHtml(row.old_value) : '<span style="color:#868b94;">(없음)</span>'} → ${row.new_value ? escapeHtml(row.new_value) : '<span style="color:#868b94;">(삭제)</span>'}</td>
                    <td>${CAUSE_LABEL[row.cause] ?? escapeHtml(row.cause)}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>`
    }
  `;

  return renderPage({ title: '업체 관리', activePath: '/vendors', body });
}
