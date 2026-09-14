import { OBJECTION_HOLD_MAX_DAYS } from '@weddingpick/domain';
import type { Pool } from 'pg';

import { newEventId, recordDecision, requireOperator } from './decisions';
import { withTransaction } from './db';
import { notify } from './notify';

/**
 * 후기 이의 처리. 서비스정책서 6번 · 정보통신망법 제44조의2.
 *
 * **내려두는 것과 지우는 것은 다르다.** 업체가 이의를 제기하면 사람이 확인하는
 * 동안 내려두고, 확인 결과 문제가 없으면 다시 올린다. 지금까지 그 일을 할 도구가
 * 없어서 운영자가 DB를 직접 손대야 했고, 손으로 하면 결정 기록도 알림도 남지 않는다.
 *
 * 기간은 저절로 끝난다(0050). 여기서 하는 일은 **사람이 내린 결론을 적는 것**이지
 * 글을 계속 내려두는 것이 아니다.
 */

export class ObjectionRefused extends Error {}

/**
 * 운영자가 적은 사유를 남긴다.
 *
 * **화면과 라우트가 빈 메모를 거절하면서도 정작 그 메모를 버리고 있었다**(0110까지).
 * `structured.decisions`는 값이 아니라 참조만 담는 표라 글이 들어갈 자리가 없다 —
 * 그래서 `withdrawal_audit_log`와 같은 모양의 표에 따로 적는다.
 *
 * 결정과 같은 트랜잭션 안에서 적는다. 상태만 바뀌고 사유가 빠진 기록이 남으면
 * 나중에 「왜 내렸느냐」에 답할 수 없고, 그때는 이미 되돌릴 수 없다.
 */
async function logObjectionNote(
  client: Parameters<typeof recordDecision>[0],
  input: {
    reviewId: string;
    by: string;
    action: ObjectionOutcome;
    note: string;
    beforeStatus: string;
    afterStatus: string;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO structured.review_objection_log
       (review_id, operator_id, action, note, before_status, after_status)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.reviewId,
      input.by,
      input.action,
      input.note,
      input.beforeStatus,
      input.afterStatus,
    ]
  );
}

export type ObjectionOutcome = 'hold' | 'restore' | 'remove';

type ReviewRow = {
  status: string;
  author_user_id: string | null;
  vendor_name: string;
};

async function load(
  client: Parameters<typeof recordDecision>[0],
  reviewId: string
): Promise<ReviewRow> {
  const { rows } = await client.query<ReviewRow>(
    `SELECT r.status, r.author_user_id, v.name AS vendor_name
     FROM structured.reviews r
     JOIN structured.vendors v ON v.id = r.vendor_id
     WHERE r.id = $1 FOR UPDATE OF r`,
    [reviewId]
  );

  const row = rows[0];

  if (!row) throw new ObjectionRefused('없는 후기다.');

  return row;
}

/**
 * 이의를 접수하고 임시조치를 건다.
 *
 * 기간의 상한은 우리가 정한 값이 아니라 법이 정한 값이다(30일). 길게 잡으면 업체가
 * 이의만 제기해도 불리한 후기를 오래 내릴 수 있고, 그건 반론권이 아니라 검열이 된다.
 */
export async function holdReview(
  pool: Pool,
  input: { reviewId: string; by: string; note: string; days?: number }
): Promise<void> {
  const days = input.days ?? OBJECTION_HOLD_MAX_DAYS;

  if (days < 1 || days > OBJECTION_HOLD_MAX_DAYS) {
    throw new ObjectionRefused(
      `임시조치는 1일 이상 ${OBJECTION_HOLD_MAX_DAYS}일 이하다 (정보통신망법 제44조의2).`
    );
  }

  await withTransaction(pool, async (client) => {
    await requireOperator(client, input.by);

    const review = await load(client, input.reviewId);

    if (review.status !== 'published') {
      throw new ObjectionRefused('게시 중인 후기만 내려둘 수 있다.');
    }

    await client.query(
      `UPDATE structured.reviews
       SET status = 'under_objection',
           objection_hold_until = now() + ($2 || ' days')::interval,
           updated_at = now()
       WHERE id = $1`,
      [input.reviewId, String(days)]
    );

    await recordDecision(client, {
      eventId: newEventId(),
      workflow: 'review_objection',
      step: 'hold',
      subjectKind: 'review',
      subjectId: input.reviewId,
      decider: { kind: 'human', userId: input.by },
      decision: 'under_objection',
      reasonCode: 'objection_received',
      evidence: [{ kind: 'review', id: input.reviewId }],
    });

    await logObjectionNote(client, {
      reviewId: input.reviewId,
      by: input.by,
      action: 'hold',
      note: input.note,
      beforeStatus: review.status,
      afterStatus: 'under_objection',
    });

    /*
     * 작성자에게 알린다. **내 글이 안 보이는데 이유를 모르는 상태를 만들지 않는다.**
     * 심사 메모는 보내지 않는다 — 운영자가 적은 내부 기록이고, 이의를 낸 쪽의 말을
     * 그대로 옮기면 우리가 그 주장을 전하는 것이 된다.
     */
    if (review.author_user_id) {
      await notify(client, {
        userId: review.author_user_id,
        kind: 'notice',
        title: '내 후기가 확인 중이에요',
        body: `${review.vendor_name}에 대한 후기에 이의가 들어와 확인하는 동안 보이지 않아요. 확인이 끝나면 다시 보여요.`,
        targetId: input.reviewId,
      });
    }
  });
}

/**
 * 확인이 끝났다. 다시 올리거나, 내린다.
 *
 * **되돌리는 쪽이 기본이다.** 확인 결과 문제가 없으면 다시 올라간다는 것이 이 절차의
 * 전제이고, 지우는 것은 그것으로 끝나지 않을 때만 하는 일이다.
 */
export async function resolveObjection(
  pool: Pool,
  input: { reviewId: string; to: 'restore' | 'remove'; by: string; note: string }
): Promise<void> {
  await withTransaction(pool, async (client) => {
    await requireOperator(client, input.by);

    const review = await load(client, input.reviewId);

    if (review.status !== 'under_objection') {
      throw new ObjectionRefused('확인 중인 후기가 아니다.');
    }

    const status = input.to === 'restore' ? 'published' : 'removed';

    await client.query(
      `UPDATE structured.reviews
       SET status = $2::review_status, objection_hold_until = NULL,
           auto_hidden_at = NULL, updated_at = now()
       WHERE id = $1`,
      [input.reviewId, status]
    );

    await recordDecision(client, {
      eventId: newEventId(),
      workflow: 'review_objection',
      step: 'resolve',
      subjectKind: 'review',
      subjectId: input.reviewId,
      decider: { kind: 'human', userId: input.by },
      decision: status,
      reasonCode: input.to === 'restore' ? 'objection_dismissed' : 'objection_upheld',
      evidence: [{ kind: 'review', id: input.reviewId }],
    });

    await logObjectionNote(client, {
      reviewId: input.reviewId,
      by: input.by,
      action: input.to,
      note: input.note,
      beforeStatus: review.status,
      afterStatus: status,
    });

    if (review.author_user_id) {
      await notify(client, {
        userId: review.author_user_id,
        kind: 'notice',
        title: input.to === 'restore' ? '내 후기가 다시 보여요' : '내 후기를 내렸어요',
        body:
          input.to === 'restore'
            ? `${review.vendor_name}에 대한 후기가 확인을 마치고 다시 보여요.`
            : `${review.vendor_name}에 대한 후기를 내렸어요. 문의 창구로 물어보시면 사유를 알려드려요.`,
        targetId: input.reviewId,
      });
    }
  });
}
