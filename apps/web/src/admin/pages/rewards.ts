import { MONTHLY_DRAW_AMOUNT_KRW, MONTHLY_DRAW_WINNERS_PER_MONTH, REWARD_LABEL, type RewardKind } from '@weddingpick/domain';
import type { Pool } from 'pg';

import { escapeHtml, renderPage } from '../html';

const when = (at: Date): string => at.toISOString().slice(0, 16).replace('T', ' ');
const won = (amount: number): string => `${amount.toLocaleString('ko-KR')}원`;

const STATUS_LABEL: Record<string, string> = {
  earned: '지급 대상',
  held: '확인 대기',
  paid: '지급 완료',
  blocked: '지급 차단',
};

/**
 * WP-ADM-031 성장 · 캠페인·보상.
 *
 * `structured.reward_grants`(0039)를 중심에 둔다 — 미션·친구초대·홍보인증이
 * 전부 여기로 모인다. 월간 웨딩지원금 추첨(`monthly_draw_entries`, 0047)은
 * production에 아직 없을 수 있다 — 표가 없으면 조용히 그 구간만 건너뛴다.
 *
 * "4개 미션 완료" 카드는 `apps/api/src/routes/rewards.ts`가 `/v1/me/monthly-draw`에서
 * 매 요청마다 즉석에서 확인하는 것과 같은 조건(예식일·지역 설정·Pick·비교·배우자 연결)을
 * 집계 쿼리로 그대로 옮긴 것 — 저장된 표가 없어 결과를 그대로 셀 수는 없다.
 */
export async function renderRewardsPage(pool: Pool): Promise<string> {
  const grantCounts = await pool.query<{ kind: RewardKind; status: string; count: string; total: string }>(
    `SELECT kind, status::text, count(*)::text, sum(amount_krw)::text AS total
     FROM structured.reward_grants
     GROUP BY kind, status
     ORDER BY kind, status`
  );

  const grants = await pool.query<{
    id: string;
    kind: RewardKind;
    amount_krw: number;
    status: string;
    reason_code: string;
    created_at: Date;
  }>(
    `SELECT id, kind, amount_krw, status::text, reason_code, created_at
     FROM structured.reward_grants
     ORDER BY created_at DESC
     LIMIT 30`
  );

  const missions = await pool.query<{ count: string }>(
    `SELECT count(*)::text
     FROM structured.users u
     JOIN LATERAL (
       SELECT id, wedding_date, region, owner_user_id, partner_user_id
       FROM structured.weddings
       WHERE owner_user_id = u.id OR partner_user_id = u.id
       ORDER BY created_at LIMIT 1
     ) w ON true
     WHERE w.wedding_date IS NOT NULL AND w.region IS NOT NULL
       AND EXISTS (SELECT 1 FROM structured.vendor_candidates c WHERE c.wedding_id = w.id)
       AND EXISTS (SELECT 1 FROM structured.comparisons x WHERE x.wedding_id = w.id)
       AND w.owner_user_id IS NOT NULL AND w.partner_user_id IS NOT NULL`
  );

  const hasDraws = await pool.query<{ exists: boolean }>(
    `SELECT to_regclass('structured.monthly_draw_entries') IS NOT NULL AS exists`
  );

  const drawSection = hasDraws.rows[0]!.exists
    ? await (async () => {
        const draws = await pool.query<{
          draw_month: string;
          entries: string;
          winners: string;
        }>(
          `SELECT e.draw_month,
                  count(e.id)::text AS entries,
                  count(g.id) FILTER (WHERE g.kind = 'monthly_draw')::text AS winners
           FROM structured.monthly_draw_entries e
           LEFT JOIN structured.reward_grants g ON g.draw_entry_id = e.id
           GROUP BY e.draw_month
           ORDER BY e.draw_month DESC
           LIMIT 6`
        );

        return `
          <h2>월간 웨딩지원금 추첨</h2>
          ${
            draws.rows.length === 0
              ? '<p class="empty">아직 응모가 없어요.</p>'
              : `<table>
                  <thead><tr><th>회차</th><th>응모</th><th>당첨자 수 / 정원</th><th>1인 지급액</th></tr></thead>
                  <tbody>
                    ${draws.rows
                      .map(
                        (row) => `<tr>
                          <td>${row.draw_month}</td>
                          <td>${row.entries}건</td>
                          <td>${row.winners} / ${MONTHLY_DRAW_WINNERS_PER_MONTH}</td>
                          <td>${won(MONTHLY_DRAW_AMOUNT_KRW)}</td>
                        </tr>`
                      )
                      .join('')}
                  </tbody>
                </table>`
          }
        `;
      })()
    : '<h2>월간 웨딩지원금 추첨</h2><p class="empty">아직 이 표가 없어요 — 0047 마이그레이션이 production에 적용되지 않았어요.</p>';

  const body = `
    <h1>캠페인·보상</h1>
    <p class="subtitle">미션·친구초대·홍보인증·월간 웨딩지원금이 전부 이 지급 표로 모인다.</p>

    <div class="card-row">
      <div class="card"><div class="label">4개 미션 완료 사용자</div><div class="value">${missions.rows[0]!.count}</div></div>
    </div>

    <h2>지급 상태별 집계</h2>
    ${
      grantCounts.rows.length === 0
        ? '<p class="empty">아직 보상 지급 기록이 없어요.</p>'
        : `<table>
            <thead><tr><th>종류</th><th>상태</th><th>건수</th><th>합계</th></tr></thead>
            <tbody>
              ${grantCounts.rows
                .map(
                  (row) => `<tr>
                    <td>${escapeHtml(REWARD_LABEL[row.kind] ?? row.kind)}</td>
                    <td>${row.status === 'blocked' ? `<span class="badge bad">${STATUS_LABEL[row.status]}</span>` : row.status === 'held' ? `<span class="badge warn">${STATUS_LABEL[row.status]}</span>` : STATUS_LABEL[row.status] ?? escapeHtml(row.status)}</td>
                    <td>${row.count}건</td>
                    <td>${won(Number(row.total))}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>`
    }

    <h2 style="margin-top:32px;">최근 지급 30건</h2>
    ${
      grants.rows.length === 0
        ? '<p class="empty">아직 없어요.</p>'
        : `<table>
            <thead><tr><th>때</th><th>종류</th><th>금액</th><th>사유</th><th>상태</th></tr></thead>
            <tbody>
              ${grants.rows
                .map(
                  (row) => `<tr>
                    <td>${when(row.created_at)}</td>
                    <td>${escapeHtml(REWARD_LABEL[row.kind] ?? row.kind)}</td>
                    <td>${won(row.amount_krw)}</td>
                    <td>${escapeHtml(row.reason_code)}</td>
                    <td>${STATUS_LABEL[row.status] ?? escapeHtml(row.status)}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>`
    }

    ${drawSection}
  `;

  return renderPage({ title: '캠페인·보상', activePath: '/rewards', body });
}
