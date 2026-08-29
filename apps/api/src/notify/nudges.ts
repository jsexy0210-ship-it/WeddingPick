import {
  DEFAULT_PERIOD_LABEL,
  DEFAULT_PERIOD_MONTHS,
  discloseAmounts,
  isMeaningfulPriceChange,
  nudgeFor,
  priceChangeNudge,
  resolveTaskState,
  shouldSendPreparationNudges,
  weddingPhase,
  type TaskState,
} from '@weddingpick/domain';
import type { Pool } from 'pg';

import type { Push } from '../push/port';
import { deliver, type Deliverable } from './send';

/**
 * 준비 알림과 가격 변동 알림. 최종통합정책 v2.0 36·37번.
 *
 * 워커가 주기적으로 부른다. **한 바퀴 더 돌아도 같은 알림이 또 가지 않는다** —
 * `dedupe_key`가 그걸 지키므로 여기서 "이미 보냈나"를 기억할 필요가 없다.
 */

type TaskRow = {
  task_id: string;
  label: string;
  due_date: Date | null;
  override_state: TaskState | null;
  wedding_date: Date | null;
  member_id: string;
};

/**
 * 다가오는 일정을 알린다.
 *
 * **예식이 끝난 사람에게는 보내지 않는다**(v2.0 D-4). 끝난 사람에게 "드레스
 * 투어를 예약해보세요"라고 보내는 것은 안내가 아니라 실례다.
 */
export async function sendTaskNudges(
  deps: { pool: Pool; push: Push },
  now: Date = new Date()
): Promise<{ stored: number; pushed: number; skipped: number }> {
  const { rows } = await deps.pool.query<TaskRow>(
    `SELECT t.id AS task_id, t.label, t.due_date, t.state_override AS override_state,
            w.wedding_date, m.member_id
     FROM structured.wedding_tasks t
     JOIN structured.weddings w ON w.id = t.wedding_id
     CROSS JOIN LATERAL (
       VALUES (w.owner_user_id), (w.partner_user_id)
     ) AS m(member_id)
     WHERE m.member_id IS NOT NULL
       AND t.due_date IS NOT NULL
       -- 세 시점만 본다. 나머지 날짜의 일정까지 끌어오면 표가 통째로 온다.
       AND t.due_date - current_date IN (7, 1, 0)`
  );

  const items: Deliverable[] = [];

  for (const row of rows) {
    const weddingDate = row.wedding_date ? row.wedding_date.toISOString().slice(0, 10) : null;

    if (!shouldSendPreparationNudges(weddingPhase(weddingDate, now))) continue;

    const { state } = resolveTaskState({
      dueDate: row.due_date ? row.due_date.toISOString().slice(0, 10) : null,
      override: row.override_state,
      now,
    });

    const nudge = nudgeFor(
      {
        id: row.task_id,
        label: row.label,
        dueDate: row.due_date ? row.due_date.toISOString().slice(0, 10) : null,
        state,
      },
      now
    );

    if (!nudge) continue;

    items.push({
      userId: row.member_id,
      kind: 'notice',
      title: nudge.title,
      body: nudge.body,
      targetId: row.task_id,
      dedupeKey: nudge.dedupeKey,
    });
  }

  return await deliver(deps, items);
}

type CandidateRow = {
  member_id: string;
  vendor_id: string;
  vendor_name: string;
  amounts: string[] | null;
  mark_stage: string | null;
  mark_low: string | null;
  mark_high: string | null;
};

/**
 * 관심업체의 결제 구간이 의미 있게 바뀌면 알린다.
 *
 * **신규 인증 한 건마다 보내지 않는다**(v2.0 37번). 마지막으로 알린 값과 견줘
 * 의미 있는 변화일 때만 보내고, 같은 업체는 하루 한 번까지다.
 *
 * 기준점은 알림을 보내지 않을 때도 갱신한다 — 안 그러면 1%씩 스무 번 오른 뒤
 * 어느 날 갑자기 "20% 올랐어요"가 간다. 그건 그날 일어난 일이 아니다.
 */
export async function sendPriceChangeNudges(
  deps: { pool: Pool; push: Push },
  now: Date = new Date()
): Promise<{ stored: number; pushed: number; skipped: number }> {
  const { rows } = await deps.pool.query<CandidateRow>(
    `SELECT DISTINCT ON (m.member_id, c.vendor_id)
            m.member_id, c.vendor_id, v.name AS vendor_name,
            coalesce(
              (SELECT array_agg(p.paid_amount)
               FROM structured.usable_payment_proofs p
               WHERE p.vendor_id = c.vendor_id
                 AND p.paid_at >= now() - ($1 || ' months')::interval),
              ARRAY[]::bigint[]
            ) AS amounts,
            k.stage AS mark_stage, k.low AS mark_low, k.high AS mark_high
     FROM structured.vendor_candidates c
     JOIN structured.vendors v ON v.id = c.vendor_id
     JOIN structured.weddings w ON w.id = c.wedding_id
     CROSS JOIN LATERAL (
       VALUES (w.owner_user_id), (w.partner_user_id)
     ) AS m(member_id)
     LEFT JOIN structured.price_alert_marks k
       ON k.user_id = m.member_id AND k.vendor_id = c.vendor_id
     WHERE m.member_id IS NOT NULL`,
    [DEFAULT_PERIOD_MONTHS]
  );

  const items: Deliverable[] = [];
  const today = now.toISOString().slice(0, 10);

  for (const row of rows) {
    const disclosed = discloseAmounts({
      amounts: (row.amounts ?? []).map(Number),
      period: DEFAULT_PERIOD_LABEL,
    });

    const after = {
      stage: disclosed.stage,
      low: 'low' in disclosed ? disclosed.low : null,
      high: 'high' in disclosed ? disclosed.high : null,
    };

    /*
     * 처음 담은 업체는 기준점만 남기고 알리지 않는다. 담자마자 "바뀌었어요"가
     * 가면 그건 변화가 아니라 인사다.
     */
    const first = row.mark_stage === null;

    const before = {
      stage: row.mark_stage ?? 'collecting',
      low: row.mark_low === null ? null : Number(row.mark_low),
      high: row.mark_high === null ? null : Number(row.mark_high),
    };

    const changed = !first && isMeaningfulPriceChange(before, after);

    if (changed) {
      const nudge = priceChangeNudge({
        vendorId: row.vendor_id,
        vendorName: row.vendor_name,
        caption: disclosed.caption,
        today,
        appeared: before.low === null,
      });

      items.push({
        userId: row.member_id,
        kind: 'notice',
        title: nudge.title,
        body: nudge.body,
        targetId: row.vendor_id,
        dedupeKey: nudge.dedupeKey,
        priceChange: true,
      });
    }

    // 알리든 말든 기준점은 지금 값으로 옮긴다.
    if (first || changed) {
      await deps.pool.query(
        `INSERT INTO structured.price_alert_marks (user_id, vendor_id, low, high, stage)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, vendor_id) DO UPDATE
           SET low = EXCLUDED.low, high = EXCLUDED.high,
               stage = EXCLUDED.stage, sent_at = now()`,
        [row.member_id, row.vendor_id, after.low, after.high, after.stage]
      );
    }
  }

  return await deliver(deps, items);
}
