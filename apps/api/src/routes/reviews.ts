import {
  createReviewReportRequestSchema,
  createReviewRequestSchema,
  updateReviewRequestSchema,
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
  checklistFor,
  evaluationModeFor,
  canSubmitReview,
  reviewReportAcknowledgement,
  reviewVerificationFromQuote,
  RISK_REASON_CODE,
  riskNotice,
  scanForRisk,
  strongerVerification,
  verificationNote,
  type ChecklistAnswer,
  type ReviewVerification,
  type ReviewerRole,
  type VendorCategory,
  type VerificationLevel,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';

import { currentUserId, optionalUser, optionalUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { withTransaction } from '../db';
import { newEventId, recordDecision } from '../decisions';
import { ApiError, notFound } from '../errors';
import { notify } from '../notify';
import { loadUsageScore } from '../review-view';

/**
 * 규칙의 판. 결정 기록에 함께 남는다 — 규칙이 바뀌면 과거 결정을 다시 읽을 수
 * 있어야 하고, 어느 판이 내렸는지 모르면 재현할 수 없다.
 */
const RISK_SCAN_VERSION = 'risk-scan@1';

/**
 * 가려두는 기간. 정보통신망법 제44조의2가 30일을 상한으로 정했고, 스키마의
 * 트리거가 그 상한을 지킨다.
 *
 * 상한까지 쓰지 않는다. 위험정보를 지우고 다시 올리는 데 한 달이 필요하지 않고,
 * 길게 잡을수록 자동으로 가린 글이 오래 안 보인다.
 */
const RISK_HOLD_DAYS = 7;

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
type AuthorVerification = {
  verification: ReviewVerification;
  quoteId: string | null;
  paymentProofId: string | null;
  verifiedBy: string | null;
};

async function verificationForAuthor(
  pool: Pool,
  userId: string,
  vendorId: string
): Promise<AuthorVerification> {
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

  /*
   * 결제인증도 확인의 근거가 된다.
   *
   * 결제인증이 있으면 그 사람이 그 업체에 돈을 낸 것은 사실이고, "실제로
   * 이용했다"에는 그것으로 충분하다. 다만 심사가 아니라 등록이라 계약 확인보다
   * 약하다 — 배지를 나눠 붙인다.
   */
  const proof = await pool.query<{ id: string }>(
    `SELECT id FROM structured.usable_payment_proofs
     WHERE vendor_id = $2 AND reporter_user_id = $1
     ORDER BY paid_at DESC
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
  const fromPayment: AuthorVerification | null = proof.rows[0]
    ? {
        verification: 'payment',
        quoteId: null,
        paymentProofId: proof.rows[0].id,
        // 결제인증에는 확인한 사람이 없다. 심사가 아니라 등록이라서다.
        verifiedBy: null,
      }
    : null;

  if (!best || !verification || !best.decided_by) {
    return (
      fromPayment ?? {
        verification: 'reported',
        quoteId: null,
        paymentProofId: null,
        verifiedBy: null,
      }
    );
  }

  const fromQuote: AuthorVerification = {
    verification,
    quoteId: best.id,
    paymentProofId: null,
    verifiedBy: best.decided_by,
  };

  if (!fromPayment) return fromQuote;

  // 둘 다 있으면 사람이 심사한 쪽이 이긴다.
  return strongerVerification(fromQuote.verification, fromPayment.verification) ===
    fromQuote.verification
    ? fromQuote
    : fromPayment;
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
  /* 읽기는 로그인 없이. 쓰기·신고는 여전히 로그인이 필요하다(아래 참조). */
  const open = { preHandler: optionalUser(context) };

  /** 신고 사유 목록. 앱에 박아두면 늘릴 때마다 앱을 새로 내야 한다. */
  app.get('/v1/review-report-reasons', open, async () => ({
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

      const mode = evaluationModeFor(vendor.category);

      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        evaluationMode: mode,
        // 결정사만 체크리스트다. 역할과 무관하게 같은 문항을 묻는다 —
        // 계약 조건에 관한 질문이라 계약자만 답할 수 있다.
        checklist:
          mode === 'checklist'
            ? checklistFor(vendor.category).map(({ key, label, question }) => ({
                key,
                label,
                question,
              }))
            : [],
        roles: REVIEWER_ROLES.map((value) => ({
          value,
          label: REVIEWER_ROLE_LABEL[value],
          aspects:
            mode === 'rating'
              ? aspectsForRole(vendor.category, value).map(({ key, label }) => ({ key, label }))
              : [],
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
       * 위험정보는 올라가기 전에 막는다. 원문 24번 · v2.0 K-3.
       *
       * 올린 뒤에 가리는 것보다 낫다 — 가리는 사이에도 그 글은 이미 보였고,
       * 화면을 캡처한 사람에게는 지워지지 않는다.
       *
       * **이름은 여기서 잡지 않는다.** 한국어 성은 형태로 잡히지 않아, 기계로
       * 거르려 하면 멀쩡한 글이 걸리거나 진짜가 빠져나간다(0020). 이름은 신고와
       * 사람의 몫이다.
       */
      const risky = scanForRisk(`${body.title}\n${body.body}\n${body.pros ?? ''}\n${body.cons ?? ''}`);

      if (risky.length > 0) {
        // 값을 되읽어주지 않는다. 지우라고 말하면서 한 번 더 적는 셈이 된다.
        throw new ApiError('invalid_request', riskNotice(risky));
      }

      /*
       * 이 역할에게 물은 항목만 받는다.
       *
       * 목록에 없는 항목을 받아주면 하객이 추가비용에 별점을 매길 수 있고, 그 짐작이
       * 업체 점수가 된다. 걸러내는 대신 되돌려 보낸다 — 조용히 버리면 앱이 보낸 것과
       * 저장된 것이 달라지고, 그 차이를 아무도 모른다.
       */
      /*
       * 업종이 방식을 정한다. 다른 방식으로 온 것은 받지 않는다.
       *
       * 섞이면 업체평가에 별점 막대와 비율 막대가 나란히 서고, 읽는 사람은 두
       * 숫자가 같은 것을 재는 줄 안다. 스키마 트리거가 막긴 하지만 그 예외는
       * 사람이 읽을 말이 아니다.
       */
      const mode = evaluationModeFor(vendor.category);

      if (mode === 'checklist' && body.aspects.length > 0) {
        throw new ApiError('invalid_request', '이 업종은 체크리스트로 평가합니다.');
      }

      if (mode === 'rating' && body.checklist.length > 0) {
        throw new ApiError('invalid_request', '이 업종은 항목별 평가로 받습니다.');
      }

      const allowed = new Set(
        mode === 'checklist'
          ? checklistFor(vendor.category).map((item) => item.key)
          : aspectsForRole(vendor.category, body.role).map((aspect) => aspect.key)
      );

      const unknown = [
        ...body.aspects.map((aspect) => aspect.key),
        ...body.checklist.map((answer) => answer.key),
      ].filter((key) => !allowed.has(key));

      if (unknown.length > 0) {
        throw new ApiError('invalid_request', '이 항목은 물어보지 않은 것입니다.');
      }

      const { verification, quoteId, paymentProofId, verifiedBy } = await verificationForAuthor(
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
              verification, verified_quote_id, verified_payment_proof_id, verified_at,
              verified_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::review_verification, $10, $11,
                   CASE WHEN $9::review_verification = 'reported' THEN NULL ELSE now() END,
                   $12)
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
            paymentProofId,
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

        // '모름'도 저장한다. 답하지 않은 것과 모른다고 답한 것은 다르다.
        for (const answer of body.checklist) {
          await client.query(
            `INSERT INTO structured.review_checklist_answers (review_id, item, answer)
             VALUES ($1, $2, $3::checklist_answer)`,
            [reviewId, answer.key, answer.answer]
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
    open,
    async (request) => {
      // 비로그인이면 null. "내가 쓴 글"이 없을 뿐 목록은 그대로 보인다.
      const userId = optionalUserId(request);
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
        rebuttal_role: string | null;
        rebuttal_body: string | null;
        rebuttal_published_at: Date | null;
      }>(
        /*
         * 반론은 structured.published_rebuttals에서만 가져온다. 조건을 여기서
         * 다시 적지 않는 것이 요점이다 — 적기 시작하면 언젠가 한 경로가 빠지고,
         * 그 한 곳에서 심사받지 않은 반론이 후기 옆에 실린다.
         */
        `SELECT r.id, r.role, r.overall, r.title, r.body, r.pros, r.cons,
                r.verification, r.created_at,
                (r.author_user_id = $2) AS mine,
                (SELECT json_agg(json_build_object('aspect', a.aspect, 'rating', a.rating)
                                 ORDER BY a.aspect)
                 FROM structured.review_aspects a WHERE a.review_id = r.id) AS aspects,
                b.claimed_role AS rebuttal_role,
                b.body AS rebuttal_body,
                b.published_at AS rebuttal_published_at
         FROM structured.visible_reviews r
         LEFT JOIN structured.published_rebuttals b ON b.review_id = r.id
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
          rebuttal:
            row.rebuttal_body && row.rebuttal_role && row.rebuttal_published_at
              ? {
                  claimedRole: row.rebuttal_role,
                  body: row.rebuttal_body,
                  publishedAt: row.rebuttal_published_at.toISOString(),
                }
              : null,
        })),
        nextCursor: hasMore && page.length > 0 ? encodeCursor(page[page.length - 1]!) : null,
        usageScore: await loadUsageScore(context.pool, vendor.id, vendor.category),
        caveat: REVIEW_CAVEAT,
      };
    }
  );

  /**
   * 후기 고치기. 원문 23번.
   *
   * **자기 글만 고친다.** 그리고 고친 글도 위험정보 검사를 다시 지난다 — 한 번
   * 통과했다고 다음에도 통과하는 것이 아니다.
   *
   * 규칙이 가린 글은 고치면 되살아난다. 0033이 작성자에게 "지우고 다시
   * 올려주세요"라고 말했으니, 그 말을 지킬 길이 있어야 한다.
   *
   * **사람이 내린 임시조치는 여기서 풀리지 않는다.** `auto_hidden_at`이 그 둘을
   * 가른다 — 법적 분쟁으로 가린 글을 작성자가 스스로 되살릴 수 있으면 그건
   * 임시조치가 아니다.
   */
  app.put<{ Params: { reviewId: string } }>(
    '/v1/reviews/:reviewId',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      const body = updateReviewRequestSchema.parse(request.body);

      const check = canSubmitReview({ overall: body.overall, body: body.body, role: 'contractor' });

      if (!check.ok) {
        throw new ApiError('invalid_request', check.reason);
      }

      const risky = scanForRisk(
        `${body.title}\n${body.body}\n${body.pros ?? ''}\n${body.cons ?? ''}`
      );

      if (risky.length > 0) {
        throw new ApiError('invalid_request', riskNotice(risky));
      }

      await withTransaction(context.pool, async (client) => {
        const { rows } = await client.query<{ status: string; auto_hidden_at: Date | null }>(
          `SELECT status, auto_hidden_at FROM structured.reviews
           WHERE id = $1 AND author_user_id = $2
           FOR UPDATE`,
          [request.params.reviewId, userId]
        );

        const found = rows[0];

        // 남의 글과 없는 글이 같은 답을 받는다. 다르면 남의 글 id를 알아낼 수 있다.
        if (!found) throw notFound('후기');

        if (found.status === 'under_objection' && found.auto_hidden_at === null) {
          throw new ApiError(
            'conflict',
            '확인 중인 후기는 고칠 수 없습니다. 결과를 알려드리겠습니다.'
          );
        }

        if (found.status === 'removed') {
          throw new ApiError('conflict', '내려간 후기는 고칠 수 없습니다.');
        }

        const restored = found.auto_hidden_at !== null;

        await client.query(
          `UPDATE structured.reviews
           SET title = $2, body = $3, pros = $4, cons = $5, overall = $6,
               status = 'published',
               objection_hold_until = NULL,
               auto_hidden_at = NULL,
               updated_at = now()
           WHERE id = $1`,
          [
            request.params.reviewId,
            body.title,
            body.body,
            body.pros ?? null,
            body.cons ?? null,
            body.overall,
          ]
        );

        if (restored) {
          // 되살린 것도 결정이다. 왜 다시 보이게 됐는지에 답할 수 있어야 한다.
          await recordDecision(client, {
            eventId: newEventId(),
            workflow: 'review_report',
            step: 'restore',
            subjectKind: 'review',
            subjectId: request.params.reviewId,
            decider: { kind: 'rule', ruleVersion: RISK_SCAN_VERSION },
            decision: 'restored',
            reasonCode: 'risk_info_removed',
            evidence: [{ kind: 'review', id: request.params.reviewId }],
          });
        }
      });

      // COMMIT이 끝난 뒤에 보낸다.
      return reply.status(204).send();
    }
  );

  /**
   * 후기 삭제.
   *
   * 한 사람이 한 업체에 하나라, 지우는 길이 없으면 **다시 쓸 수도 없다.** 고치는
   * 길(PUT)만 있고 지우는 길이 없어 지금까지는 문의 창구로 와야 했다.
   *
   * 실제로 지운다. 내려두는 것(`removed`)은 운영자가 하는 일이고, 그건 "우리가 이
   * 글을 안 보이게 했다"는 뜻이다 — 작성자가 자기 글을 거둔 것과 다른 사실이라
   * 같은 상태로 적으면 안 된다.
   *
   * **확인 중인 글은 지울 수 없다.** 고치기와 같은 규칙이다(0034) — 사람이 내린
   * 임시조치는 법적 분쟁 중이라는 뜻이고, 그때 작성자가 지우면 다투던 자료가
   * 사라진다. 규칙이 가린 것(`auto_hidden_at`)은 지울 수 있다.
   */
  app.delete<{ Params: { reviewId: string } }>(
    '/v1/reviews/:reviewId',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);

      await withTransaction(context.pool, async (client) => {
        const { rows } = await client.query<{
          status: string;
          auto_hidden_at: Date | null;
          vendor_name: string;
          rebuttal_by: string | null;
        }>(
          `SELECT r.status, r.auto_hidden_at, v.name AS vendor_name,
                  b.submitted_by_user_id AS rebuttal_by
           FROM structured.reviews r
           JOIN structured.vendors v ON v.id = r.vendor_id
           LEFT JOIN structured.review_rebuttals b
             ON b.review_id = r.id AND b.status = 'published'
           WHERE r.id = $1 AND r.author_user_id = $2
           FOR UPDATE OF r`,
          [request.params.reviewId, userId]
        );

        const found = rows[0];

        // 남의 글과 없는 글이 같은 답을 받는다. 다르면 남의 글 id를 알아낼 수 있다.
        if (!found) throw notFound('후기');

        if (found.status === 'under_objection' && found.auto_hidden_at === null) {
          throw new ApiError(
            'conflict',
            '확인 중인 후기는 지울 수 없습니다. 결과를 알려드리겠습니다.'
          );
        }

        /*
         * 실려 있던 반론은 후기와 함께 사라진다(CASCADE). 그 사람에게는 자기 글이
         * 어느 날 없어진 것이므로, 없어졌다는 사실은 알려야 한다. 누가 지웠는지는
         * 적지 않는다 — 작성자가 누구인지는 그 사람이 알 일이 아니다.
         */
        if (found.rebuttal_by) {
          await notify(client, {
            userId: found.rebuttal_by,
            kind: 'rebuttal',
            title: '반론을 달았던 후기가 사라졌어요',
            body: `${found.vendor_name}에 대한 그 후기가 지워져서 반론도 함께 내려갔어요.`,
            targetId: null,
          });
        }

        await client.query('DELETE FROM structured.reviews WHERE id = $1', [
          request.params.reviewId,
        ]);
      });

      return reply.status(204).send();
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

      const review = await context.pool.query<{
        author_user_id: string;
        title: string;
        body: string;
        pros: string | null;
        cons: string | null;
      }>(
        `SELECT author_user_id, title, body, pros, cons
         FROM structured.visible_reviews WHERE id = $1`,
        [request.params.reviewId]
      );

      const found = review.rows[0];

      if (!found) {
        throw notFound('후기');
      }

      const created = await withTransaction(context.pool, async (client) => {
        const { rows } = await client.query<{ id: string; received_at: Date }>(
          `INSERT INTO structured.review_reports (review_id, reporter_user_id, reason, note)
           VALUES ($1, $2, $3, $4)
           RETURNING id, received_at`,
          [request.params.reviewId, userId, body.reason, body.note ?? null]
        );

        const reportId = rows[0]!.id;
        const eventId = newEventId();

        /*
         * 명백한 위험정보는 바로 가린다. 원문 24번이 정한 다섯 가지 중 숫자로 된
         * 것들이고, 규칙으로 잡히므로 모델을 부를 일이 아니다(A-3).
         *
         * 나머지는 가리지 않는다 — **업체에 부정적인 후기라는 이유만으로
         * 블라인드하지 않는다**(원문 24번). 신고만으로 글이 내려가면 그건 신고가
         * 아니라 삭제 버튼이고, 업체가 불리한 후기를 지우는 데 쓴다.
         */
        const risky = scanForRisk(
          `${found.title}\n${found.body}\n${found.pros ?? ''}\n${found.cons ?? ''}`
        );

        if (risky.length > 0) {
          await client.query(
            `UPDATE structured.reviews
             SET status = 'under_objection',
                 objection_hold_until = now() + ($2 || ' days')::interval,
                 -- 규칙이 가렸다는 표시. 이게 있어야 작성자가 고쳐서 되살릴 수 있다.
                 auto_hidden_at = now(),
                 updated_at = now()
             WHERE id = $1`,
            [request.params.reviewId, RISK_HOLD_DAYS]
          );

          await recordDecision(client, {
            eventId,
            workflow: 'review_report',
            step: 'auto_hide',
            subjectKind: 'review',
            subjectId: request.params.reviewId,
            decider: { kind: 'rule', ruleVersion: RISK_SCAN_VERSION },
            decision: 'hidden',
            reasonCode: RISK_REASON_CODE,
            // 무엇을 봤는지는 가리키기만 한다. 찾은 값은 어디에도 적지 않는다.
            evidence: [{ kind: 'review_report', id: reportId }],
          });

          await notify(client, {
            userId: found.author_user_id,
            kind: 'notice',
            title: '후기를 잠시 가렸어요',
            body: riskNotice(risky),
            targetId: request.params.reviewId,
          });
        } else {
          /*
           * 규칙이 못 잡는 것(이름, 맥락)은 사람이 본다. 끝나지 않은 결정으로
           * 남겨 `structured.open_decisions`에 뜨게 한다 — 자동으로 처리한 척
           * 하고 아무 일도 하지 않는 것이 가장 나쁘다.
           */
          await recordDecision(client, {
            eventId,
            workflow: 'review_report',
            step: 'triage',
            subjectKind: 'review',
            subjectId: request.params.reviewId,
            decider: { kind: 'rule', ruleVersion: RISK_SCAN_VERSION },
            decision: 'needs_review',
            reasonCode: 'no_rule_match',
            evidence: [{ kind: 'review_report', id: reportId }],
            execution: 'pending',
          });
        }

        return {
          reportId,
          status: 'received' as const,
          receivedAt: rows[0]!.received_at.toISOString(),
          acknowledgement: reviewReportAcknowledgement(),
        };
      });

      /*
       * **COMMIT이 끝난 뒤에 보낸다.** 트랜잭션 안에서 send하면 응답이 먼저
       * 나가고 COMMIT이 뒤에 끝나, 201을 받고 곧바로 다시 읽은 클라이언트가
       * 낡은 값을 본다. 테스트가 실제로 그 순간을 잡았다.
       */
      return reply.status(201).send(created);
    }
  );
}
