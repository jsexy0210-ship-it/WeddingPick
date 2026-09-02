import type { Pool } from 'pg';

import { escapeHtml, renderPage } from '../html';

const when = (at: Date): string => at.toISOString().slice(0, 16).replace('T', ' ');

const STATUS_LABEL: Record<string, string> = {
  running: '실행 중',
  completed: '완료',
  failed: '실패',
  aborted: '중단됨',
};

/**
 * WP-ADM-010 데이터 · 제보 처리 현황.
 *
 * 공개 데이터 임포트(`structured.import_runs`, 0049)만 다룬다 — 제보(가격
 * 제보·결제인증)는 별도 큐가 없다(WP-ADM-011처럼 신뢰도 점수를 매기는 표가
 * 없다). 지금 있는 것은 사람이 직접 처리하는 문의(WP-ADM-021)뿐이다.
 */
export async function renderDataImportPage(pool: Pool): Promise<string> {
  const switches = await pool.query<{ source_key: string; enabled: boolean; reason: string | null }>(
    `SELECT source_key, enabled, reason FROM structured.import_switches ORDER BY source_key`
  );

  const runs = await pool.query<{
    id: string;
    source_key: string;
    category: string;
    status: string;
    total_rows: number | null;
    created_count: number;
    updated_count: number;
    closed_count: number;
    skipped_count: number;
    error_count: number;
    started_at: Date;
    finished_at: Date | null;
  }>(
    `SELECT id, source_key, category, status, total_rows, created_count, updated_count,
            closed_count, skipped_count, error_count, started_at, finished_at
     FROM structured.import_runs
     ORDER BY started_at DESC
     LIMIT 30`
  );

  const errors = await pool.query<{
    run_id: string;
    vendor_name: string | null;
    error_type: string;
    error_message: string;
    occurred_at: Date;
  }>(
    `SELECT e.run_id, e.vendor_name, e.error_type, e.error_message, e.occurred_at
     FROM structured.import_errors e
     JOIN structured.import_runs r ON r.id = e.run_id
     WHERE r.started_at >= now() - interval '7 days'
     ORDER BY e.occurred_at DESC
     LIMIT 30`
  );

  const body = `
    <h1>데이터 처리 현황</h1>
    <p class="subtitle">공개 데이터 임포트 실행 이력. 파일 하나가 실행 하나다.</p>

    <section>
      <h2>출처별 스위치</h2>
      ${
        switches.rows.length === 0
          ? '<p class="empty">등록된 출처가 없어요.</p>'
          : `<table>
              <thead><tr><th>출처</th><th>상태</th><th>사유</th></tr></thead>
              <tbody>
                ${switches.rows
                  .map(
                    (row) => `<tr>
                      <td><code>${escapeHtml(row.source_key)}</code></td>
                      <td>${row.enabled ? '<span class="badge">켜짐</span>' : '<span class="badge bad">꺼짐</span>'}</td>
                      <td>${row.reason ? escapeHtml(row.reason) : '—'}</td>
                    </tr>`
                  )
                  .join('')}
              </tbody>
            </table>`
      }
    </section>

    <section>
      <h2>최근 실행 30건</h2>
      ${
        runs.rows.length === 0
          ? '<p class="empty">아직 실행 이력이 없어요.</p>'
          : `<table>
              <thead>
                <tr><th>시작</th><th>출처/분류</th><th>상태</th><th>등록/갱신/폐업/건너뜀</th><th>실패</th></tr>
              </thead>
              <tbody>
                ${runs.rows
                  .map(
                    (row) => `<tr>
                      <td>${when(row.started_at)}</td>
                      <td>${escapeHtml(row.source_key)} / ${escapeHtml(row.category)}</td>
                      <td>${STATUS_LABEL[row.status] ?? escapeHtml(row.status)}</td>
                      <td>${row.created_count} / ${row.updated_count} / ${row.closed_count} / ${row.skipped_count}${row.total_rows !== null ? ` (전체 ${row.total_rows})` : ''}</td>
                      <td>${row.error_count > 0 ? `<span class="badge warn">${row.error_count}건</span>` : '0건'}</td>
                    </tr>`
                  )
                  .join('')}
              </tbody>
            </table>`
      }
    </section>

    <section>
      <h2>최근 7일 오류 30건</h2>
      ${
        errors.rows.length === 0
          ? '<p class="empty">최근 7일 동안 오류가 없었어요.</p>'
          : `<table>
              <thead><tr><th>때</th><th>업체</th><th>종류</th><th>메시지</th></tr></thead>
              <tbody>
                ${errors.rows
                  .map(
                    (row) => `<tr>
                      <td>${when(row.occurred_at)}</td>
                      <td>${row.vendor_name ? escapeHtml(row.vendor_name) : '—'}</td>
                      <td><span class="badge bad">${escapeHtml(row.error_type)}</span></td>
                      <td>${escapeHtml(row.error_message)}</td>
                    </tr>`
                  )
                  .join('')}
              </tbody>
            </table>`
      }
    </section>
  `;

  return renderPage({ title: '데이터 처리 현황', activePath: '/data-import', body });
}
