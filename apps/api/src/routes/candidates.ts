import {
  createCandidateRequestSchema,
  decideCategoryRequestSchema,
  recordComparisonRequestSchema,
} from '@weddingpick/api-contract';
import {
  MAX_CANDIDATES,
  PREPARATION_STATE_LABEL,
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  canAddCandidate,
  comparableWithin,
  groupByCategory,
  nextCategory,
  preparationProgress,
  type CategoryProgress,
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

      /*
       * 결정은 후보와 다른 표에 있다(0041). 따로 읽어 붙이는 이유는 "이 업종은
       * 여기로 정했다"가 후보 한 줄의 속성이 아니라 웨딩과 업종에 붙는 결론이기
       * 때문이다.
       */
      const decisions = await context.pool.query<{ category: VendorCategory; vendor_id: string }>(
        'SELECT category, vendor_id FROM structured.category_decisions WHERE wedding_id = $1',
        [request.params.weddingId]
      );

      const decidedBy = new Map(decisions.rows.map((row) => [row.category, row.vendor_id]));
      const grouped = groupByCategory(rows);

      /*
       * 진행률은 업종 전체를 분모로 센다. 담은 업종만 세면 아무것도 안 담은
       * 사람의 진행률이 0/0이 되고, 그건 아무 말도 하지 않는 숫자다.
       */
      const progress: CategoryProgress[] = VENDOR_CATEGORIES.map((category) => {
        const picks = grouped.get(category) ?? [];
        const decided = decidedBy.get(category) ?? null;

        return {
          category,
          label: VENDOR_CATEGORY_LABEL[category],
          state: decided ? 'decided' : picks.length > 0 ? 'picking' : 'before',
          pickCount: picks.length,
          decidedVendorId: decided,
        };
      });

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
          state: decidedBy.has(category) ? ('decided' as const) : ('picking' as const),
          stateLabel: PREPARATION_STATE_LABEL[decidedBy.has(category) ? 'decided' : 'picking'],
          decidedVendorId: decidedBy.get(category) ?? null,
        })),
        total: rows.length,
        limit: MAX_CANDIDATES,
        progress: preparationProgress(progress),
        nextCategory: nextCategory(progress),
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

  /**
   * 최종 결정. v3.2 §6.
   *
   * **Pick한 곳 중에서만 정할 수 있다.** 표의 외래키가 이미 막지만, 여기서
   * 걸러야 사용자가 읽을 수 있는 말을 받는다.
   *
   * 다시 부르면 그 업종의 결정을 바꾼다 — 마음이 바뀌는 일이라 되돌릴 수 없게
   * 두지 않는다.
   */
  app.put<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/decisions',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      const body = decideCategoryRequestSchema.parse(request.body);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const picked = await context.pool.query<{ category: VendorCategory }>(
        `SELECT v.category
         FROM structured.vendor_candidates c
         JOIN structured.vendors v ON v.id = c.vendor_id
         WHERE c.wedding_id = $1 AND c.vendor_id = $2`,
        [request.params.weddingId, body.vendorId]
      );

      const category = picked.rows[0]?.category;

      if (!category) {
        throw new ApiError('invalid_request', 'Pick한 곳 중에서 정할 수 있어요.');
      }

      // 업종은 업체가 정한다. 보내온 값과 다르면 화면이 잘못 알고 있는 것이다.
      if (category !== body.category) {
        throw new ApiError('invalid_request', '업종이 맞지 않아요.');
      }

      await context.pool.query(
        `INSERT INTO structured.category_decisions (wedding_id, category, vendor_id, decided_by)
         VALUES ($1, $2::vendor_category, $3, $4)
         ON CONFLICT (wedding_id, category)
         DO UPDATE SET vendor_id = EXCLUDED.vendor_id,
                       decided_at = now(),
                       decided_by = EXCLUDED.decided_by`,
        [request.params.weddingId, body.category, body.vendorId, userId]
      );

      return reply.status(204).send();
    }
  );

  /**
   * 비교했다는 사실을 남긴다. v3.7 §9의 미션 ③.
   *
   * **비교할 수 있는 상태가 아니라 비교한 사실이다.** 후보 두 곳을 담았다고
   * 비교한 것은 아니다 — 버튼이 옆에 있는 것과 눌러본 것은 다르고, 미션은
   * 눌러보게 하려고 있는 장치다.
   *
   * 처음 한 번만 남긴다. 몇 번 비교했는지는 미션이 묻지 않는다.
   */
  app.post<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/comparisons',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      const body = recordComparisonRequestSchema.parse(request.body);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      await context.pool.query(
        `INSERT INTO structured.comparisons (wedding_id, category)
         VALUES ($1, $2::vendor_category)
         ON CONFLICT (wedding_id, category) DO NOTHING`,
        [request.params.weddingId, body.category]
      );

      return reply.status(204).send();
    }
  );

  /** 결정 되돌리기. 그 업종은 다시 후보를 고르는 중이 된다. */
  app.delete<{ Params: { weddingId: string; category: string } }>(
    '/v1/weddings/:weddingId/decisions/:category',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const { rowCount } = await context.pool.query(
        `DELETE FROM structured.category_decisions
         WHERE wedding_id = $1 AND category = $2::vendor_category`,
        [request.params.weddingId, request.params.category]
      );

      if (rowCount === 0) throw notFound('결정');

      return reply.status(204).send();
    }
  );

  /**
   * Pick에서 뺀 업체 이력. 핸드오프 Pick 히스토리.
   *
   * `removed_candidates`(0067)가 triger로 채운다 — vendor_candidates DELETE 시
   * 자동으로 기록된다. 업종별로 묶어 내려준다.
   */
  app.get<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/candidates/removed',
    auth,
    async (request) => {
      const userId = currentUserId(request);
      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      type RemovedRow = {
        id: string;
        vendor_id: string | null;
        vendor_name: string;
        category: VendorCategory;
        added_at: Date | null;
        removed_at: Date;
      };

      const { rows } = await context.pool.query<RemovedRow>(
        `SELECT rc.id, rc.vendor_id, rc.vendor_name, rc.category::vendor_category AS category,
                rc.added_at, rc.removed_at
         FROM structured.removed_candidates rc
         WHERE rc.wedding_id = $1
         ORDER BY rc.removed_at DESC`,
        [request.params.weddingId]
      );

      // 업종별로 묶는다. 화면이 같은 업종끼리 모아 보여준다.
      const grouped = groupByCategory(
        rows.map((row) => ({ ...row, vendor_id: row.vendor_id ?? '', note: null, added_by: null }))
      );

      return {
        groups: [...grouped.entries()].map(([category, items]) => ({
          category,
          categoryLabel: VENDOR_CATEGORY_LABEL[category],
          items: items.map((row) => ({
            id: row.id,
            vendorId: row.vendor_id || null,
            vendorName: row.vendor_name,
            category: row.category,
            categoryLabel: VENDOR_CATEGORY_LABEL[row.category],
            addedAt: row.added_at ? row.added_at.toISOString() : null,
            removedAt: row.removed_at.toISOString(),
          })),
        })),
      };
    }
  );
}
