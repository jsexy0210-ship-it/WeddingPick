import { createCandidateRequestSchema } from '@weddingpick/api-contract';
import {
  MAX_CANDIDATES,
  VENDOR_CATEGORY_LABEL,
  canAddCandidate,
  comparableWithin,
  groupByCategory,
  type VendorCategory,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { assertWeddingAccess } from '../access';
import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { ApiError, notFound } from '../errors';

type CandidateRow = {
  id: string;
  vendor_id: string;
  vendor_name: string;
  category: VendorCategory;
  region: string;
  note: string | null;
  added_at: Date;
  added_by: string | null;
};

export function registerCandidateRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  /**
   * 담아둔 업체.
   *
   * 업종별로 나눠 준다. 서른 곳을 한 줄로 늘어놓으면 무엇을 견주는 중인지 보이지
   * 않는다. 그리고 비교는 **같은 업종끼리만** 뜻이 있어, 업종마다 따로 셈한다.
   */
  app.get<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/candidates',
    auth,
    async (request) => {
      const userId = currentUserId(request);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const { rows } = await context.pool.query<CandidateRow>(
        `SELECT c.id, c.vendor_id, v.name AS vendor_name, v.category, v.region,
                c.note, c.added_at, c.added_by
         FROM structured.vendor_candidates c
         JOIN structured.vendors v ON v.id = c.vendor_id
         WHERE c.wedding_id = $1
         ORDER BY c.added_at DESC`,
        [request.params.weddingId]
      );

      const grouped = groupByCategory(rows);

      return {
        groups: [...grouped.entries()].map(([category, candidates]) => ({
          category,
          categoryLabel: VENDOR_CATEGORY_LABEL[category],
          candidates: candidates.map((row) => ({
            id: row.id,
            vendorId: row.vendor_id,
            vendorName: row.vendor_name,
            category: row.category,
            region: row.region,
            note: row.note,
            addedAt: row.added_at.toISOString(),
            // 상대가 마음에 들어 한 곳인지 알아야 이야기가 된다.
            addedByPartner: row.added_by !== null && row.added_by !== userId,
          })),
          comparable: comparableWithin(candidates.length),
        })),
        total: rows.length,
        limit: MAX_CANDIDATES,
      };
    }
  );

  /** 담기. 배우자와 같은 목록을 본다 — 웨딩에 매달려 있기 때문이다. */
  app.post<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/candidates',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      const body = createCandidateRequestSchema.parse(request.body);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const vendor = await context.pool.query('SELECT 1 FROM structured.vendors WHERE id = $1', [
        body.vendorId,
      ]);

      if (vendor.rows.length === 0) {
        throw notFound('업체');
      }

      const counted = await context.pool.query<{ count: string }>(
        'SELECT count(*) FROM structured.vendor_candidates WHERE wedding_id = $1',
        [request.params.weddingId]
      );

      /*
       * 상한을 여기서도 본다. 트리거가 막긴 하지만, 그 예외는 사람이 읽을 말이
       * 아니다 — 왜 안 되는지와 무엇을 하면 되는지를 알려주려면 여기서 걸러야 한다.
       */
      const check = canAddCandidate({ currentCount: Number(counted.rows[0]!.count) });

      if (!check.ok) {
        throw new ApiError('invalid_request', check.reason);
      }

      try {
        const { rows } = await context.pool.query<{ id: string }>(
          `INSERT INTO structured.vendor_candidates (wedding_id, vendor_id, added_by, note)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [request.params.weddingId, body.vendorId, userId, body.note ?? null]
        );

        return reply.status(201).send({ candidateId: rows[0]!.id });
      } catch (error) {
        // 이미 담긴 곳. 배우자가 먼저 담았을 수도 있다.
        if (error instanceof Error && error.message.includes('vendor_candidates_wedding_id')) {
          throw new ApiError('conflict', '이미 담아둔 업체입니다.');
        }

        throw error;
      }
    }
  );

  /**
   * 빼기.
   *
   * 배우자가 담은 것도 뺄 수 있다. 담은 사람만 뺄 수 있게 하면 "저건 네가 담은
   * 거니 네가 빼"가 되고, 그건 함께 고르는 것이 아니다.
   */
  app.delete<{ Params: { weddingId: string; candidateId: string } }>(
    '/v1/weddings/:weddingId/candidates/:candidateId',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const { rowCount } = await context.pool.query(
        'DELETE FROM structured.vendor_candidates WHERE id = $1 AND wedding_id = $2',
        [request.params.candidateId, request.params.weddingId]
      );

      if (rowCount === 0) {
        throw notFound('후보');
      }

      return reply.status(204).send();
    }
  );
}
