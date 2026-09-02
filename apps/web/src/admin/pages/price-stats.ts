import type { Pool } from 'pg';

import { escapeHtml, renderPage } from '../html';

const when = (at: Date): string => at.toISOString().slice(0, 16).replace('T', ' ');
const won = (amount: number): string => `${amount.toLocaleString('ko-KR')}원`;

/**
 * WP-ADM-012 데이터 · 가격통계.
 *
 * `stats.price_stats`(0001)를 읽는다 — "이상치 후보"·"재계산" 버튼·"통계
 * 버전" 컬럼은 스키마에 없다(조사 결과: 이상치 탐지 표 자체가 없다, 아래
 * WP-ADM-013 참조). `recomputed_at`으로 마지막 계산 시각만 보여준다.
 */
export async function renderPriceStatsPage(pool: Pool): Promise<string> {
  const totals = await pool.query<{ stats_rows: string; comparable_quotes: string; usable_reports: string }>(
    `SELECT
       (SELECT count(*) FROM stats.price_stats)::text AS stats_rows,
       (SELECT count(*) FROM structured.comparable_quotes)::text AS comparable_quotes,
       (SELECT count(*) FROM structured.usable_price_reports)::text AS usable_reports`
  );

  const { rows } = await pool.query<{
    vendor_name: string;
    product_key: string;
    doc_type: string;
    sample_count: number;
    median: string;
    min_verification_level: string;
    recomputed_at: Date;
  }>(
    `SELECT v.name AS vendor_name, s.product_key, s.doc_type::text, s.sample_count, s.median::text,
            s.min_verification_level::text, s.recomputed_at
     FROM stats.price_stats s
     JOIN structured.vendors v ON v.id = s.vendor_id
     ORDER BY s.recomputed_at DESC
     LIMIT 40`
  );

  const summary = totals.rows[0]!;

  const body = `
    <h1>가격통계</h1>
    <p class="subtitle">서비스정책서 2번 — L2 이상 확인 데이터만 통계에 들어간다.</p>

    <div class="card-row">
      <div class="card"><div class="label">공개된 통계 행</div><div class="value">${summary.stats_rows}</div></div>
      <div class="card"><div class="label">비교 가능 계약</div><div class="value">${summary.comparable_quotes}</div></div>
      <div class="card"><div class="label">쓸 수 있는 가격 제보</div><div class="value">${summary.usable_reports}</div></div>
    </div>

    <h2>최근 계산된 통계 40건</h2>
    ${
      rows.length === 0
        ? '<p class="empty">아직 공개된 통계가 없어요.</p>'
        : `<table>
            <thead>
              <tr><th>업체</th><th>상품</th><th>문서 종류</th><th>데이터 수</th><th>중앙값</th><th>최소 인증등급</th><th>마지막 계산</th></tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row) => `<tr>
                    <td>${escapeHtml(row.vendor_name)}</td>
                    <td>${escapeHtml(row.product_key)}</td>
                    <td>${escapeHtml(row.doc_type)}</td>
                    <td>${row.sample_count}건</td>
                    <td>${won(Number(row.median))}</td>
                    <td>${escapeHtml(row.min_verification_level)}</td>
                    <td>${when(row.recomputed_at)}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>`
    }
  `;

  return renderPage({ title: '가격통계', activePath: '/price-stats', body });
}
