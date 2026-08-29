import {
  createRebuttalRequestSchema,
  updateRebuttalRequestSchema,
} from '@weddingpick/api-contract';
import {
  REBUTTAL_STATUS_LABEL,
  REBUTTAL_STATUS_NOTE,
  checkRebuttal,
  isEditable,
  type RebuttalStatus,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { ApiError, notFound } from '../errors';

type RebuttalRow = {
  id: string;
  status: RebuttalStatus;
  claimed_role: string;
  body: string;
  decision_note: string | null;
  created_at: Date;
  review_id: string;
  vendor_id: string;
  vendor_name: string;
  review_title: string;
  review_body: string;
  review_overall: number;
  review_created_at: Date;
};

/**
 * 업체 반론. 디자인 핸드오프 20번.
 *
 * **여기서 게시되는 것은 없다.** 넣으면 확인 중으로 들어가고, 사람이 결정해야
 * 후기 옆에 붙는다(`structured.published_rebuttals`). 그 사실을 응답이 아니라
 * 스키마가 지킨다 — 이 경로에는 status를 정할 자리가 없다.
 */
export function registerRebuttalRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  app.post('/v1/rebuttals', auth, async (request, reply) => {
    const userId = currentUserId(request);
    const body = createRebuttalRequestSchema.parse(request.body);

    const check = checkRebuttal(body);
    if (!check.ok) throw new ApiError('invalid_request', check.message);

    /*
     * 보이는 후기에만 반론을 붙인다. 이미 내려간 글에 반론을 다는 것은 없는 글에
     * 답하는 일이고, 그 반론이 나중에 글과 함께 되살아나면 아무도 예상하지 못한다.
     */
    const review = await context.pool.query<{ id: string }>(
      'SELECT id FROM structured.visible_reviews WHERE id = $1',
      [body.reviewId]
    );

    if (review.rows.length === 0) throw notFound('후기');

    const existing = await context.pool.query<{ id: string }>(
      'SELECT id FROM structured.review_rebuttals WHERE review_id = $1',
      [body.reviewId]
    );

    if (existing.rows.length > 0) {
      // 표의 UNIQUE가 이미 막지만, 여기서 걸러야 사용자가 읽을 수 있는 말을 받는다.
      throw new ApiError('conflict', '이 후기에는 이미 등록된 반론이 있습니다.');
    }

    const { rows } = await context.pool.query<{ id: string }>(
      `INSERT INTO structured.review_rebuttals
         (review_id, submitted_by_user_id, claimed_role, body)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [body.reviewId, userId, body.claimedRole, body.body]
    );

    return reply.status(201).send({ rebuttalId: rows[0]!.id });
  });

  /**
   * 내가 낸 반론.
   *
   * 원본 후기를 함께 준다. 반론만 세우면 무엇에 대한 답인지 알 수 없고, 핸드오프도
   * 게시되면 어떻게 보일지를 그대로 보여달라고 적었다.
   */
  app.get('/v1/me/rebuttals', auth, async (request) => {
    const userId = currentUserId(request);

    const { rows } = await context.pool.query<RebuttalRow>(
      `SELECT b.id, b.status, b.claimed_role, b.body, b.decision_note, b.created_at,
              r.id AS review_id, r.vendor_id, v.name AS vendor_name,
              r.title AS review_title, r.body AS review_body,
              r.overall AS review_overall, r.created_at AS review_created_at
       FROM structured.review_rebuttals b
       JOIN structured.reviews r ON r.id = b.review_id
       JOIN structured.vendors v ON v.id = r.vendor_id
       WHERE b.submitted_by_user_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    );

    return {
      rebuttals: rows.map((row) => ({
        id: row.id,
        status: row.status,
        statusLabel: REBUTTAL_STATUS_LABEL[row.status],
        statusNote: REBUTTAL_STATUS_NOTE[row.status],
        claimedRole: row.claimed_role,
        body: row.body,
        decisionNote: row.decision_note,
        createdAt: row.created_at.toISOString(),
        review: {
          id: row.review_id,
          vendorId: row.vendor_id,
          vendorName: row.vendor_name,
          title: row.review_title,
          body: row.review_body,
          overall: row.review_overall,
          createdAt: row.review_created_at.toISOString(),
        },
      })),
    };
  });

  app.put<{ Params: { rebuttalId: string } }>(
    '/v1/rebuttals/:rebuttalId',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      const body = updateRebuttalRequestSchema.parse(request.body);

      const check = checkRebuttal(body);
      if (!check.ok) throw new ApiError('invalid_request', check.message);

      const current = await context.pool.query<{ status: RebuttalStatus }>(
        'SELECT status FROM structured.review_rebuttals WHERE id = $1 AND submitted_by_user_id = $2',
        [request.params.rebuttalId, userId]
      );

      const status = current.rows[0]?.status;
      if (!status) throw notFound('반론');

      if (!isEditable(status)) {
        /*
         * 게시된 글의 본문을 바꿀 수 있게 두면, 확인받은 글과 실제로 붙어 있는
         * 글이 달라진다. 고치려면 지우고 다시 내야 한다.
         */
        throw new ApiError('conflict', '확인이 끝난 반론은 고칠 수 없습니다.');
      }

      await context.pool.query(
        `UPDATE structured.review_rebuttals
         SET claimed_role = $2, body = $3, updated_at = now()
         WHERE id = $1`,
        [request.params.rebuttalId, body.claimedRole, body.body]
      );

      return reply.status(204).send();
    }
  );

  /** 지우기는 게시된 뒤에도 된다. 자기가 한 말을 거두는 것은 언제든 되어야 한다. */
  app.delete<{ Params: { rebuttalId: string } }>(
    '/v1/rebuttals/:rebuttalId',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);

      const { rowCount } = await context.pool.query(
        'DELETE FROM structured.review_rebuttals WHERE id = $1 AND submitted_by_user_id = $2',
        [request.params.rebuttalId, userId]
      );

      if (rowCount === 0) throw notFound('반론');

      return reply.status(204).send();
    }
  );
}
