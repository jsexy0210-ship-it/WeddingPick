import {
  createReviewReportRequestSchema,
  createReviewRequestSchema,
} from '@weddingpick/api-contract';
import {
  MINIMUM_BODY_LENGTH,
  REPORT_REASONS,
  REPORT_REASON_LABEL,
  REVIEWER_ROLES,
  REVIEWER_ROLE_LABEL,
  REVIEW_CAVEAT,
  REVIEW_VERIFICATION_LABEL,
  aspectsFor,
  aspectsForRole,
  canSubmitReview,
  reviewReportAcknowledgement,
  reviewVerificationFromQuote,
  verificationNote,
  type ReviewVerification,
  type ReviewerRole,
  type VendorCategory,
  type VerificationLevel,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';

import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { ApiError, notFound } from '../errors';
import { loadUsageScore } from '../review-view';

const listQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

type VendorRow = { id: string; name: string; category: VendorCategory };

async function loadVendor(pool: Pool, vendorId: string): Promise<VendorRow> {
  const { rows } = await pool.query<VendorRow>(
    'SELECT id, name, category FROM structured.vendors WHERE id = $1',
    [vendorId]
  );

  const vendor = rows[0];

  if (!vendor) {
    throw notFound('업체');
  }

  return vendor;
}

/**
 * 이 사람의 후기를 어디까지 확인해 줄 수 있는가.
 *
 * **작성자에게 묻지 않는다.** 자기 후기를 "계약 확인"이라고 말할 수 있으면 그 표시는
 * 아무 뜻이 없다. 이미 인증 심사를 통과한 문서를 서버가 찾아서 정한다 — 같은 것을
 * 두 번 확인하게 하면 사람들은 두 번째에서 그만둔다.
 *
 * 확인한 사람은 그 문서를 승인한 심사자를 그대로 이어받는다. 후기 쪽에서 새로
 * 만들지 않는다 — 자동 인증은 없다는 규칙이 여기서도 지켜져야 한다.
 */
async function verificationForAuthor(
  pool: Pool,
  userId: string,
  vendorId: string
): Promise<{ verification: ReviewVerification; quoteId: string | null; verifiedBy: string | null }> {
  const { rows } = await pool.query<{
    id: string;
    verification_level: VerificationLevel;
    decided_by: string | null;
  }>(
    `SELECT q.id, q.verification_level,
            (SELECT vr.decided_by
             FROM structured.verification_requests vr
             WHERE vr.quote_id = q.id AND vr.status = 'approved'
             ORDER BY vr.decided_at DESC
             LIMIT 1) AS decided_by
     FROM structured.quotes q
     JOIN structured.weddings w ON w.id = q.wedding_id
     WHERE q.vendor_id = $2
       AND (w.owner_user_id = $1 OR w.partner_user_id = $1)
     ORDER BY q.verification_level DESC, q.created_at DESC
     LIMIT 1`,
    [userId, vendorId]
  );

  const best = rows[0];
  const verification = best ? reviewVerificationFromQuote(best.verification_level) : null;

  /*
   * 등급은 올랐는데 승인한 사람이 없다면 확인해 주지 않는다.
   *
   * 지금 코드에서는 등급이 심사 승인으로만 오르므로 일어나지 않는다. 그래도 막아두는
   * 이유는, 나중에 등급을 올리는 다른 길이 생겼을 때 그 길이 조용히 "확인된 후기"를
   * 찍어내지 못하게 하기 위해서다.
   */
  if (!best || !verification || !best.decided_by) {
    return { verification: 'unverified', quoteId: null, verifiedBy: null };
  }

  return { verification, quoteId: best.id, verifiedBy: best.decided_by };
}

function encodeCursor(row: { created_at: Date; id: string }): string {
  return Buffer.from(JSON.stringify([row.created_at.toISOString(), row.id]), 'utf8').toString(
    'base64url'
  );
}

function decodeCursor(cursor: string): [string, string] | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));

    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string'
    ) {
      return [parsed[0], parsed[1]];
    }
  } catch {
    // 망가진 커서는 첫 쪽으로 되돌린다. 오류를 띄우느니 처음부터 보여주는 편이 낫다.
  }

  return null;
}

export function registerReviewRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  /** 신고 사유 목록. 앱에 박아두면 늘릴 때마다 앱을 새로 내야 한다. */
  app.get('/v1/review-report-reasons', auth, async () => ({
    reasons: REPORT_REASONS.map((value) => ({ value, label: REPORT_REASON_LABEL[value] })),
  }));

  /**
   * 후기 쓰기 화면에 필요한 것.
   *
   * 물어볼 항목을 앱이 정하지 않는다. 업종마다 다르고 역할마다 다르다 — 하객은
   * 계약 조건이나 추가비용을 모르고, 모르는 것을 물으면 짐작으로 채운다.
   */
  app.get<{ Params: { vendorId: string } }>(
    '/v1/vendors/:vendorId/review-form',
    auth,
    async (request) => {
      const userId = currentUserId(request);
      const vendor = await loadVendor(context.pool, request.params.vendorId);
      const { verification } = await verificationForAuthor(context.pool, userId, vendor.id);

      const written = await context.pool.query(
        'SELECT 1 FROM structured.reviews WHERE vendor_id = $1 AND author_user_id = $2',
        [vendor.id, userId]
      );

      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        roles: REVIEWER_ROLES.map((value) => ({
          value,
          label: REVIEWER_ROLE_LABEL[value],
          aspects: aspectsForRole(vendor.category, value).map(({ key, label }) => ({ key, label })),
        })),
        verification: {
          value: verification,
          label: REVIEW_VERIFICATION_LABEL[verification],
          note: verificationNote(verification),
        },
        alreadyWritten: written.rows.length > 0,
        minimumBodyLength: MINIMUM_BODY_LENGTH,
      };
    }
  );

  /** 후기 쓰기. 한 사람이 한 업체에 하나. */
  app.post<{ Params: { vendorId: string } }>(
    '/v1/vendors/:vendorId/reviews',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      const body = createReviewRequestSchema.parse(request.body);
      const vendor = await loadVendor(context.pool, request.params.vendorId);

      const check = canSubmitReview({
        overall: body.overall,
        body: body.body,
        role: body.role,
      });

      if (!check.ok) {
        throw new ApiError('invalid_request', check.reason);
      }

      /*
       * 이 역할에게 물은 항목만 받는다.
       *
       * 목록에 없는 항목을 받아주면 하객이 추가비용에 별점을 매길 수 있고, 그 짐작이
       * 업체 점수가 된다. 걸러내는 대신 되돌려 보낸다 — 조용히 버리면 앱이 보낸 것과
       * 저장된 것이 달라지고, 그 차이를 아무도 모른다.
       */
      const allowed = new Set(aspectsForRole(vendor.category, body.role).map((a) => a.key));
      const unknown = body.aspects.filter((aspect) => !allowed.has(aspect.key));

      if (unknown.length > 0) {
        throw new ApiError('invalid_request', '이 항목은 물어보지 않은 것입니다.');
      }

      const { verification, quoteId, verifiedBy } = await verificationForAuthor(
        context.pool,
        userId,
        vendor.id
      );

      const client = await context.pool.connect();

      try {
        await client.query('BEGIN');

        const created = await client.query<{ id: string }>(
          `INSERT INTO structured.reviews
             (vendor_id, author_user_id, role, overall, title, body, pros, cons,
              verification, verified_quote_id, verified_at, verified_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::review_verification, $10,
                   CASE WHEN $9::review_verification = 'unverified' THEN NULL ELSE now() END,
                   $11)
           RETURNING id`,
          [
            vendor.id,
            userId,
            body.role,
            body.overall,
            body.title.trim(),
            body.body.trim(),
            body.pros?.trim() || null,
            body.cons?.trim() || null,
            verification,
            quoteId,
            verifiedBy,
          ]
        );

        const reviewId = created.rows[0]!.id;

        for (const aspect of body.aspects) {
          await client.query(
            'INSERT INTO structured.review_aspects (review_id, aspect, rating) VALUES ($1, $2, $3)',
            [reviewId, aspect.key, aspect.rating]
          );
        }

        await client.query('COMMIT');

        return reply.status(201).send({
          reviewId,
          verification,
          verificationLabel: REVIEW_VERIFICATION_LABEL[verification],
          caveat: REVIEW_CAVEAT,
        });
      } catch (error) {
        await client.query('ROLLBACK');

        // 한 사람이 한 업체에 하나. 여러 개면 점수를 밀어 올릴 수 있다.
        if (error instanceof Error && error.message.includes('reviews_vendor_id_author_user_id')) {
          throw new ApiError('conflict', '이 업체에는 이미 후기를 쓰셨습니다.');
        }

        throw error;
      } finally {
        client.release();
      }
    }
  );

  /**
   * 업체의 후기.
   *
   * 이의 확인 중인 글은 보이지 않는다 — 뷰가 막는다. 작성자는 밝히지 않는다.
   */
  app.get<{ Params: { vendorId: string } }>(
    '/v1/vendors/:vendorId/reviews',
    auth,
    async (request) => {
      const userId = currentUserId(request);
      const query = listQuerySchema.parse(request.query);
      const vendor = await loadVendor(context.pool, request.params.vendorId);
      const after = query.cursor ? decodeCursor(query.cursor) : null;
      const labels = new Map(aspectsFor(vendor.category).map((a) => [a.key, a.label]));

      const { rows } = await context.pool.query<{
        id: string;
        role: ReviewerRole;
        overall: number;
        title: string;
        body: string;
        pros: string | null;
        cons: string | null;
        verification: ReviewVerification;
        created_at: Date;
        mine: boolean;
        aspects: { aspect: string; rating: number }[] | null;
      }>(
        `SELECT r.id, r.role, r.overall, r.title, r.body, r.pros, r.cons,
                r.verification, r.created_at,
                (r.author_user_id = $2) AS mine,
                (SELECT json_agg(json_build_object('aspect', a.aspect, 'rating', a.rating)
                                 ORDER BY a.aspect)
                 FROM structured.review_aspects a WHERE a.review_id = r.id) AS aspects
         FROM structured.visible_reviews r
         WHERE r.vendor_id = $1
           AND ($3::timestamptz IS NULL OR (r.created_at, r.id) < ($3, $4::uuid))
         ORDER BY r.created_at DESC, r.id DESC
         LIMIT $5`,
        [vendor.id, userId, after?.[0] ?? null, after?.[1] ?? null, query.limit + 1]
      );

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;

      return {
        reviews: page.map((row) => ({
          id: row.id,
          role: row.role,
          roleLabel: REVIEWER_ROLE_LABEL[row.role],
          overall: row.overall,
          title: row.title,
          body: row.body,
          pros: row.pros,
          cons: row.cons,
          verification: row.verification,
          verificationLabel: REVIEW_VERIFICATION_LABEL[row.verification],
          // 이름을 모르는 항목은 내보내지 않는다. 화면에 내부 키가 뜨는 것보다 낫다.
          aspects: (row.aspects ?? []).flatMap((a) => {
            const label = labels.get(a.aspect);

            return label ? [{ key: a.aspect, label, rating: a.rating }] : [];
          }),
          createdAt: row.created_at.toISOString(),
          mine: row.mine,
        })),
        nextCursor: hasMore && page.length > 0 ? encodeCursor(page[page.length - 1]!) : null,
        usageScore: await loadUsageScore(context.pool, vendor.id, vendor.category),
        caveat: REVIEW_CAVEAT,
      };
    }
  );

  /**
   * 후기 신고.
   *
   * 접수만 된다. 신고만으로 글이 내려가면 그건 신고가 아니라 삭제 버튼이고, 업체가
   * 불리한 후기를 지우는 데 쓴다. 내릴지는 사람이 정한다(서비스정책서 6번).
   */
  app.post<{ Params: { reviewId: string } }>(
    '/v1/reviews/:reviewId/reports',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      const body = createReviewReportRequestSchema.parse(request.body);

      const review = await context.pool.query(
        'SELECT 1 FROM structured.visible_reviews WHERE id = $1',
        [request.params.reviewId]
      );

      if (review.rows.length === 0) {
        throw notFound('후기');
      }

      const { rows } = await context.pool.query<{ id: string; received_at: Date }>(
        `INSERT INTO structured.review_reports (review_id, reporter_user_id, reason, note)
         VALUES ($1, $2, $3, $4)
         RETURNING id, received_at`,
        [request.params.reviewId, userId, body.reason, body.note ?? null]
      );

      return reply.status(201).send({
        reportId: rows[0]!.id,
        status: 'received',
        receivedAt: rows[0]!.received_at.toISOString(),
        acknowledgement: reviewReportAcknowledgement(),
      });
    }
  );
}
