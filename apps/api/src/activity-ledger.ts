import { randomUUID } from 'node:crypto';

import {
  ACTIVITY_EVENT_NAMES,
  ACTIVITY_SURFACES,
  type ActivityEventName,
  type ActivitySurface,
} from '@weddingpick/domain';
import type { Pool } from 'pg';

/**
 * 활동 원장(1층)에 줄을 담는 쪽.
 *
 * **화면을 느리게 하지 않는다.** 이 저장소에는 「로딩 성능 전면 진단」이 아직
 * 미해결로 남아 있다 — 사용자가 기다리는 길 위에 원장 쓰기를 얹으면 그 진단이
 * 시작도 전에 틀린다.
 *
 * 그래서 두 가지를 지킨다.
 *
 *   1. **응답을 보낸 뒤에 적는다.** 부르는 자리는 Fastify `onResponse` 훅이다
 *      (`activity-hook.ts`). 사용자는 이미 응답을 받았다.
 *   2. **한 줄에 한 번씩 DB를 두드리지 않는다.** 줄은 메모리 큐에 쌓이고, 묶어서
 *      한 번의 INSERT로 나간다.
 *
 * **큐에 남은 줄은 프로세스가 죽으면 사라진다.** 그것을 받아들인다 — 원장이
 * 놓치는 줄 몇을 아끼려고 요청마다 쓰기를 기다리게 하는 것이 더 비싸다. 대신
 * 종료 신호에서는 비우고 나간다(`flushActivity`).
 */

/** 한 번에 묶어 보내는 줄 수. 넘으면 기다리지 않고 바로 비운다. */
const BATCH_LIMIT = 50;

/** 큐가 차지 않아도 이 간격마다 비운다. */
const FLUSH_INTERVAL_MS = 2_000;

/**
 * 큐가 감당할 수 있는 한계. 넘으면 **가장 오래된 줄을 버린다.**
 *
 * DB가 오래 멈춰 있을 때 큐가 끝없이 자라면 원장 때문에 API가 죽는다. 원장은
 * 서비스보다 뒤에 선다.
 */
const QUEUE_LIMIT = 5_000;

export type ActivityRecord = {
  userId: string;
  eventName: ActivityEventName;
  surface: ActivitySurface;
  occurredAt?: Date;
  targetKind?: 'vendor' | 'comparison' | 'report' | 'visit_note' | null;
  targetId?: string | null;
  category?: string | null;
  region?: string | null;
  budgetBracket?: string | null;
  searchText?: string | null;
  itemCount?: number | null;
  step?: number | null;
  /** 앱이 보낸 줄이면 앱이 만든 값. 서버가 스스로 적는 줄이면 서버가 만든다. */
  clientEventId?: string;
  correctsEventId?: string | null;
};

type Queued = Required<Pick<ActivityRecord, 'userId' | 'eventName' | 'surface'>> &
  Omit<ActivityRecord, 'userId' | 'eventName' | 'surface'> & {
    occurredAt: Date;
    clientEventId: string;
  };

const queue: Queued[] = [];
let timer: NodeJS.Timeout | null = null;
let flushing = false;

/**
 * 버려진 줄의 수. 0이 아니면 원장이 온전하지 않다는 뜻이라 관리자 화면이 그대로
 * 보여준다 — **모르는 것을 0으로 세지 않는다**는 규칙의 같은 자리다.
 */
let dropped = 0;

export function droppedActivityCount(): number {
  return dropped;
}

const EVENT_NAMES = new Set<string>(ACTIVITY_EVENT_NAMES);
const SURFACES = new Set<string>(ACTIVITY_SURFACES);

export function isActivityEventName(value: string): value is ActivityEventName {
  return EVENT_NAMES.has(value);
}

export function isActivitySurface(value: string): value is ActivitySurface {
  return SURFACES.has(value);
}

/**
 * 줄 하나를 큐에 넣는다. **기다리지 않는다.**
 *
 * 부르는 쪽은 실패를 볼 수 없고, 봐서도 안 된다 — 원장이 안 적힌다고 사용자의
 * 요청이 실패하면 안 된다.
 */
export function recordActivity(pool: Pool, record: ActivityRecord): void {
  if (queue.length >= QUEUE_LIMIT) {
    queue.shift();
    dropped += 1;
  }

  queue.push({
    ...record,
    occurredAt: record.occurredAt ?? new Date(),
    clientEventId: record.clientEventId ?? randomUUID(),
  });

  if (queue.length >= BATCH_LIMIT) {
    void flushActivity(pool);

    return;
  }

  if (timer === null) {
    timer = setTimeout(() => {
      timer = null;
      void flushActivity(pool);
    }, FLUSH_INTERVAL_MS);
    // 원장 하나 때문에 프로세스가 안 끝나지 않게.
    timer.unref?.();
  }
}

/**
 * 큐를 비운다. 종료 신호와 시험이 직접 부른다.
 *
 * **같은 줄이 두 번 들어와도 한 줄이다.** `(user_id, client_event_id)`가 고유라
 * 재시도가 원장을 부풀리지 못한다.
 *
 * INSERT가 실패하면 그 묶음은 버린다. 되돌려 큐에 넣으면 DB가 계속 거절하는 동안
 * 같은 줄을 영원히 다시 던지고, 그 사이 새 줄이 QUEUE_LIMIT에 밀려 사라진다 —
 * 고칠 수 없는 줄 하나 때문에 고칠 수 있는 줄을 잃는다.
 */
export async function flushActivity(pool: Pool): Promise<void> {
  if (flushing) return;
  if (queue.length === 0) return;

  flushing = true;

  const batch = queue.splice(0, BATCH_LIMIT);

  try {
    const columns = 13;
    const values: unknown[] = [];
    const rows = batch.map((row, index) => {
      const base = index * columns;
      values.push(
        row.userId,
        row.eventName,
        row.surface,
        row.occurredAt,
        row.targetKind ?? null,
        row.targetId ?? null,
        row.category ?? null,
        row.region ?? null,
        row.budgetBracket ?? null,
        row.searchText ?? null,
        row.itemCount ?? null,
        row.step ?? null,
        row.clientEventId
      );

      return `($${base + 1}, $${base + 2}::activity_event_name, $${base + 3}::activity_surface, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}::vendor_category, $${base + 8}, $${base + 9}::wedding_budget_bracket, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13})`;
    });

    await pool.query(
      `INSERT INTO structured.activity_events
         (user_id, event_name, surface, occurred_at, target_kind, target_id,
          category, region, budget_bracket, search_text, item_count, step, client_event_id)
       VALUES ${rows.join(', ')}
       ON CONFLICT (user_id, client_event_id) DO NOTHING`,
      values
    );
  } catch {
    dropped += batch.length;
  } finally {
    flushing = false;
  }

  // 한 번에 BATCH_LIMIT까지만 보낸다. 남았으면 이어서 비운다.
  if (queue.length > 0) await flushActivity(pool);
}

/**
 * 정정 줄. **원장은 고치지 않는다** — 틀린 줄은 그대로 두고 뒤에 이 줄이 붙는다.
 *
 * 큐를 거치지 않는다. 정정은 드물고, 드문 일에 묶음 쓰기의 지연을 얹을 이유가 없다.
 */
export async function correctActivity(
  pool: Pool,
  wrongEventId: string,
  replacement: ActivityRecord
): Promise<void> {
  await pool.query(
    `INSERT INTO structured.activity_events
       (user_id, event_name, surface, occurred_at, target_kind, target_id,
        category, region, budget_bracket, search_text, item_count, step,
        client_event_id, corrects_event_id)
     VALUES ($1, $2::activity_event_name, $3::activity_surface, $4, $5, $6,
             $7::vendor_category, $8, $9::wedding_budget_bracket, $10, $11, $12, $13, $14)
     ON CONFLICT (user_id, client_event_id) DO NOTHING`,
    [
      replacement.userId,
      replacement.eventName,
      replacement.surface,
      replacement.occurredAt ?? new Date(),
      replacement.targetKind ?? null,
      replacement.targetId ?? null,
      replacement.category ?? null,
      replacement.region ?? null,
      replacement.budgetBracket ?? null,
      replacement.searchText ?? null,
      replacement.itemCount ?? null,
      replacement.step ?? null,
      replacement.clientEventId ?? randomUUID(),
      wrongEventId,
    ]
  );
}
