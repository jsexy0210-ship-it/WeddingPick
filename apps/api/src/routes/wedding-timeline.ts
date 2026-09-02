import type { VendorCategory } from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

import { assertWeddingAccess } from '../access';
import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';

type TimelineEvent =
  | { kind: 'pick'; at: string; vendorName: string; category: VendorCategory }
  | { kind: 'decision'; at: string; vendorName: string; category: VendorCategory }
  | { kind: 'expense'; at: string; label: string; amount: number }
  | { kind: 'task'; at: string; label: string };

const LIMIT = 50;

/**
 * WP-OUR-012 준비 타임라인.
 *
 * "Pick · 최종결정 · 일정 · 지출 · 완료 기록을 시간순으로"가 핸드오프 원문이다.
 * 넷은 낸다 — Pick(vendor_candidates.added_at) · 최종결정
 * (category_decisions.decided_at) · 지출(expenses.created_at) ·
 * 일정 추가(wedding_tasks.created_at, 기본 열넷 제외).
 *
 * **"완료 기록"은 못 낸다.** `wedding_tasks`는 완료 여부를 시각으로 남기지
 * 않는다(`state_override`가 상태값이지 "언제 완료했다"는 값이 아니다) — 없는
 * 시각을 지어내 시간순에 끼워 넣지 않는다.
 *
 * 새 표를 만들지 않는다. 이미 있는 네 표에서 시간과 함께 저장돼 있던 값만
 * 모아 시간순으로 합친다.
 */
export async function loadWeddingTimeline(pool: Pool, weddingId: string): Promise<TimelineEvent[]> {
  const [picks, decisions, expenses, tasks] = await Promise.all([
    pool.query<{ vendor_name: string; category: VendorCategory; added_at: Date }>(
      `SELECT v.name AS vendor_name, v.category, c.added_at
       FROM structured.vendor_candidates c
       JOIN structured.vendors v ON v.id = c.vendor_id
       WHERE c.wedding_id = $1
       ORDER BY c.added_at DESC
       LIMIT $2`,
      [weddingId, LIMIT]
    ),
    pool.query<{ vendor_name: string; category: VendorCategory; decided_at: Date }>(
      `SELECT v.name AS vendor_name, d.category, d.decided_at
       FROM structured.category_decisions d
       JOIN structured.vendors v ON v.id = d.vendor_id
       WHERE d.wedding_id = $1
       ORDER BY d.decided_at DESC
       LIMIT $2`,
      [weddingId, LIMIT]
    ),
    pool.query<{ label: string; amount: string; created_at: Date }>(
      `SELECT label, amount::text, created_at
       FROM structured.expenses
       WHERE wedding_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [weddingId, LIMIT]
    ),
    /* 기본 열넷(preset_key IS NOT NULL)은 사용자 행동이 아니라 웨딩을 만들 때
       한꺼번에 깔린 것이다 — 타임라인에 넣으면 "일정을 열네 개 추가했어요"가
       된다. 사용자가 직접 더한 것만 낸다. */
    pool.query<{ label: string; created_at: Date }>(
      `SELECT label, created_at
       FROM structured.wedding_tasks
       WHERE wedding_id = $1 AND preset_key IS NULL
       ORDER BY created_at DESC
       LIMIT $2`,
      [weddingId, LIMIT]
    ),
  ]);

  const events: TimelineEvent[] = [
    ...picks.rows.map(
      (row): TimelineEvent => ({
        kind: 'pick',
        at: row.added_at.toISOString(),
        vendorName: row.vendor_name,
        category: row.category,
      })
    ),
    ...decisions.rows.map(
      (row): TimelineEvent => ({
        kind: 'decision',
        at: row.decided_at.toISOString(),
        vendorName: row.vendor_name,
        category: row.category,
      })
    ),
    ...expenses.rows.map(
      (row): TimelineEvent => ({
        kind: 'expense',
        at: row.created_at.toISOString(),
        label: row.label,
        amount: Number(row.amount),
      })
    ),
    ...tasks.rows.map(
      (row): TimelineEvent => ({ kind: 'task', at: row.created_at.toISOString(), label: row.label })
    ),
  ];

  events.sort((a, b) => b.at.localeCompare(a.at));

  return events.slice(0, LIMIT);
}

export function registerWeddingTimelineRoutes(app: FastifyInstance, context: AppContext): void {
  app.get<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/timeline',
    { preHandler: requireUser(context) },
    async (request) => {
      const userId = currentUserId(request);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      return { events: await loadWeddingTimeline(context.pool, request.params.weddingId) };
    }
  );
}
