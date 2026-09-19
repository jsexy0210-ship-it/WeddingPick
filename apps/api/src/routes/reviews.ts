import {
  createReviewCommentReportRequestSchema,
  createReviewCommentRequestSchema,
  createReviewMediaUploadTargetRequestSchema,
  createReviewReportRequestSchema,
  createReviewRequestSchema,
  updateReviewRequestSchema,
} from '@weddingpick/api-contract';
import {
  MINIMUM_BODY_LENGTH,
  PACKAGE_ROLE_LABEL,
  REPORT_REASONS,
  REPORT_REASON_LABEL,
  REVIEWER_ROLES,
  REVIEWER_ROLE_LABEL,
  REVIEW_CAVEAT,
  REVIEW_VERIFICATION_LABEL,
  VENDOR_CATEGORIES,
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
import { randomUUID } from 'node:crypto';

import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';

import {
  currentUserId,
  optionalUser,
  optionalUserId,
  requireOperatorUser,
  requireUser,
} from '../auth/plugin';
import type { AppContext } from '../context';
import { withTransaction } from '../db';
import { newEventId, recordDecision } from '../decisions';
import { ApiError, notFound } from '../errors';
import { isUuid } from '../uuid';
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

const loungeListQuerySchema = listQuerySchema.extend({
  category: z.enum(VENDOR_CATEGORIES).optional(),
});

type VendorRow = { id: string; name: string; category: VendorCategory };

async function loadVendor(pool: Pool, vendorId: string): Promise<VendorRow> {
  // 꼴이 아니면 DB에 묻지 않는다 — 물으면 22P02로 터져 500이 된다(`src/uuid.ts`).
  if (!isUuid(vendorId)) throw notFound('업체');

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

/**
 * 같은 패키지로 함께 계약한 다른 업체. 사업계획서 19번.
 *
 * 스튜디오·드레스·메이크업을 한 평점으로 합치지 않으려면 셋을 각자 물어야 한다.
 * 이 사람이 이 업체를 계약한 견적(`quote_sub_vendors`)에서 **같은 견적에 함께
 * 묶인 다른 업체**를 찾는다. 아직 후기를 안 쓴 곳만 담는다 — 이미 썼으면 다시
 * 물을 이유가 없다.
 */
async function packageSiblingsFor(
  pool: Pool,
  userId: string,
  vendorId: string
): Promise<{ vendorId: string; vendorName: string; roleLabel: string }[]> {
  const { rows } = await pool.query<{
    vendor_id: string;
    vendor_name: string;
    role: keyof typeof PACKAGE_ROLE_LABEL;
  }>(
    `SELECT DISTINCT ON (sibling.vendor_id)
            sibling.vendor_id, v.name AS vendor_name, sibling.role
     FROM structured.quote_sub_vendors mine
     JOIN structured.quotes q ON q.id = mine.quote_id
     JOIN structured.weddings w ON w.id = q.wedding_id
     JOIN structured.quote_sub_vendors sibling ON sibling.quote_id = mine.quote_id
     JOIN structured.vendors v ON v.id = sibling.vendor_id
     WHERE mine.vendor_id = $2
       AND (w.owner_user_id = $1 OR w.partner_user_id = $1)
       AND sibling.vendor_id IS NOT NULL
       AND sibling.vendor_id <> $2
       AND NOT EXISTS (
         SELECT 1 FROM structured.reviews r
         WHERE r.vendor_id = sibling.vendor_id AND r.author_user_id = $1
       )
     ORDER BY sibling.vendor_id, q.created_at DESC`,
    [userId, vendorId]
  );

  return rows.map((row) => ({
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    roleLabel: PACKAGE_ROLE_LABEL[row.role],
  }));
}

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


const REVIEW_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const REVIEW_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const REVIEW_MEDIA_URL_TTL_SECONDS = 15 * 60;

type ReviewInteractionFields = {
  media: { id: string; storage_key: string; mime_type: string }[] | null;
  helpful_count: number;
  helpful_mine: boolean;
  comment_count: number;
  comments:
    | { id: string; body: string; created_at: Date | string; mine: boolean }[]
    | null;
};

function reviewImageBytesMatch(bytes: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return (
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (mimeType === 'image/webp') {
    return (
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

async function reviewInteractionPayload(context: AppContext, row: ReviewInteractionFields) {
  const media = await Promise.all(
    (row.media ?? []).map(async (item) => ({
      id: item.id,
      url: await context.storage.getPublicUrl(item.storage_key, REVIEW_MEDIA_URL_TTL_SECONDS),
      mimeType: item.mime_type,
    }))
  );

  return {
    media,
    helpful: {
      count: Number(row.helpful_count ?? 0),
      mine: Boolean(row.helpful_mine),
    },
    comments: {
      count: Number(row.comment_count ?? 0),
      items: (row.comments ?? []).map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt:
          comment.created_at instanceof Date
            ? comment.created_at.toISOString()
            : new Date(comment.created_at).toISOString(),
        mine: Boolean(comment.mine),
      })),
    },
  };
}

async function helpfulState(pool: Pool, reviewId: string, userId: string) {
  const { rows } = await pool.query<{ count: number; mine: boolean }>(
    `SELECT
       (SELECT count(*)::int FROM structured.review_helpful WHERE review_id = $1) AS count,
       EXISTS (
         SELECT 1 FROM structured.review_helpful
         WHERE review_id = $1 AND user_id = $2
       ) AS mine`,
    [reviewId, userId]
  );
  return rows[0] ?? { count: 0, mine: false };
}

async function ensureVisibleReview(pool: Pool, reviewId: string): Promise<void> {
  if (!isUuid(reviewId)) throw notFound('후기');
  const found = await pool.query('SELECT 1 FROM structured.visible_reviews WHERE id = $1', [
    reviewId,
  ]);
  if (found.rowCount !== 1) throw notFound('후기');
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
      const createdAt = new Date(parsed[0]);

      // DB cast까지 잘못된 값을 넘기면 22P02/날짜 cast 오류가 500으로 번진다.
      // encodeCursor가 만드는 정규 ISO 문자열과 UUID만 cursor로 인정한다.
      if (
        !Number.isNaN(createdAt.getTime()) &&
        createdAt.toISOString() === parsed[0] &&
        isUuid(parsed[1])
      ) {
        return [parsed[0], parsed[1]];
      }
    }
  } catch {
    // 망가진 커서는 첫 쪽으로 되돌린다. 오류를 띄우느니 처음부터 보여주는 편이 낫다.
  }

  return null;
}

export function registerReviewRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };
  const operatorAuth = { preHandler: requireOperatorUser(context) };
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

      const packageSiblings = await packageSiblingsFor(context.pool, userId, vendor.id);
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
        packageSiblings,
      };
    }
  );

  /**
   * 후기 사진 업로드 자리. 파일은 API를 지나지 않고 저장소로 바로 간다.
   * 열쇠에 사용자 id를 넣어 다른 사람이 만든 업로드를 후기로 가로채지 못하게 한다.
   */
  app.post(
    '/v1/reviews/media/upload-target',
    auth,
    async (request) => {
      const userId = currentUserId(request);
      const body = createReviewMediaUploadTargetRequestSchema.parse(request.body);
      const extension = REVIEW_IMAGE_TYPES[body.mimeType];

      if (!extension) {
        throw new ApiError('invalid_request', 'JPG · PNG · WebP 사진만 올릴 수 있어요.');
      }

      return context.storage.createUploadTarget({
        storageKey: `reviews/${userId}/${randomUUID()}.${extension}`,
        mimeType: body.mimeType,
        expiresInSeconds: 600,
      });
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

      const mediaKeys = new Set<string>();
      for (const media of body.media) {
        const extension = REVIEW_IMAGE_TYPES[media.mimeType];
        const expectedPrefix = `reviews/${userId}/`;
        const expectedSuffix = extension ? `.${extension}` : '';

        if (
          !extension ||
          !media.storageKey.startsWith(expectedPrefix) ||
          !media.storageKey.endsWith(expectedSuffix) ||
          mediaKeys.has(media.storageKey)
        ) {
          throw new ApiError('invalid_request', '후기 사진 업로드 정보를 다시 확인해주세요.');
        }
        mediaKeys.add(media.storageKey);

        let bytes: Buffer;
        try {
          bytes = await context.storage.download(media.storageKey);
        } catch {
          throw new ApiError('invalid_request', '사진이 다 올라오지 않았어요. 다시 올려주세요.');
        }

        if (
          bytes.length === 0 ||
          bytes.length > REVIEW_IMAGE_MAX_BYTES ||
          !reviewImageBytesMatch(bytes, media.mimeType)
        ) {
          throw new ApiError('invalid_request', '사진 형식이나 크기를 확인해주세요.');
        }
      }

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

        for (const [position, media] of body.media.entries()) {
          await client.query(
            `INSERT INTO structured.review_media
               (review_id, storage_key, mime_type, position, rights_confirmed_at)
             VALUES ($1, $2, $3, $4, now())`,
            [reviewId, media.storageKey, media.mimeType, position]
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
   * 라운지의 전체 후기.
   *
   * 공개 여부는 `structured.visible_reviews` 하나가 정한다. 작성자 식별자·증빙 원문은
   * 응답에 싣지 않고, 업체 정보와 후기 본문·검증 단계·게시된 반론만 내보낸다.
   * 업종 필터 뒤에도 `created_at, id` 순서를 유지해 cursor가 흔들리지 않는다.
   */
  app.get('/v1/reviews', open, async (request) => {
    const userId = optionalUserId(request);
    const query = loungeListQuerySchema.parse(request.query);
    const after = query.cursor ? decodeCursor(query.cursor) : null;

    const { rows } = await context.pool.query<{
      id: string;
      vendor_id: string;
      vendor_name: string;
      vendor_category: VendorCategory;
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
    } & ReviewInteractionFields>(
      `SELECT r.id,
              v.id AS vendor_id,
              v.name AS vendor_name,
              v.category AS vendor_category,
              r.role, r.overall, r.title, r.body, r.pros, r.cons,
              r.verification, r.created_at,
              coalesce(r.author_user_id = $2::uuid, false) AS mine,
              (SELECT json_agg(json_build_object('aspect', a.aspect, 'rating', a.rating)
                               ORDER BY a.aspect)
               FROM structured.review_aspects a WHERE a.review_id = r.id) AS aspects,
              (SELECT json_agg(
                         json_build_object('id', m.id, 'storage_key', m.storage_key, 'mime_type', m.mime_type)
                         ORDER BY m.position)
               FROM structured.review_media m
               WHERE m.review_id = r.id) AS media,
              (SELECT count(*)::int FROM structured.review_helpful h
               WHERE h.review_id = r.id) AS helpful_count,
              EXISTS (
                SELECT 1 FROM structured.review_helpful h
                WHERE h.review_id = r.id AND h.user_id = $2::uuid
              ) AS helpful_mine,
              (SELECT count(*)::int FROM structured.review_comments rc
               WHERE rc.review_id = r.id AND rc.status = 'published') AS comment_count,
              (SELECT json_agg(
                         json_build_object(
                           'id', recent.id,
                           'body', recent.body,
                           'created_at', recent.created_at,
                           'mine', coalesce(recent.author_user_id = $2::uuid, false)
                         )
                         ORDER BY recent.created_at, recent.id)
               FROM (
                 SELECT rc.id, rc.body, rc.created_at, rc.author_user_id
                 FROM structured.review_comments rc
                 WHERE rc.review_id = r.id AND rc.status = 'published'
                 ORDER BY rc.created_at, rc.id
                 LIMIT 2
               ) recent) AS comments,
              b.claimed_role AS rebuttal_role,
              b.body AS rebuttal_body,
              b.published_at AS rebuttal_published_at
       FROM structured.visible_reviews r
       JOIN structured.vendors v ON v.id = r.vendor_id
       LEFT JOIN structured.published_rebuttals b ON b.review_id = r.id
       WHERE ($1::vendor_category IS NULL OR v.category = $1::vendor_category)
         AND ($3::timestamptz IS NULL OR (r.created_at, r.id) < ($3, $4::uuid))
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT $5`,
      [
        query.category ?? null,
        userId,
        after?.[0] ?? null,
        after?.[1] ?? null,
        query.limit + 1,
      ]
    );

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      reviews: await Promise.all(page.map(async (row) => {
        const labels = new Map(aspectsFor(row.vendor_category).map((a) => [a.key, a.label]));
        const interactions = await reviewInteractionPayload(context, row);

        return {
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
          vendor: {
            id: row.vendor_id,
            name: row.vendor_name,
            category: row.vendor_category,
          },
          ...interactions,
        };
      })),
      nextCursor: hasMore && page.length > 0 ? encodeCursor(page[page.length - 1]!) : null,
      caveat: REVIEW_CAVEAT,
    };
  });

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
      } & ReviewInteractionFields>(
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
                (SELECT json_agg(
                           json_build_object('id', m.id, 'storage_key', m.storage_key, 'mime_type', m.mime_type)
                           ORDER BY m.position)
                 FROM structured.review_media m
                 WHERE m.review_id = r.id) AS media,
                (SELECT count(*)::int FROM structured.review_helpful h
                 WHERE h.review_id = r.id) AS helpful_count,
                EXISTS (
                  SELECT 1 FROM structured.review_helpful h
                  WHERE h.review_id = r.id AND h.user_id = $2::uuid
                ) AS helpful_mine,
                (SELECT count(*)::int FROM structured.review_comments rc
                 WHERE rc.review_id = r.id AND rc.status = 'published') AS comment_count,
                (SELECT json_agg(
                           json_build_object(
                             'id', recent.id,
                             'body', recent.body,
                             'created_at', recent.created_at,
                             'mine', coalesce(recent.author_user_id = $2::uuid, false)
                           )
                           ORDER BY recent.created_at, recent.id)
                 FROM (
                   SELECT rc.id, rc.body, rc.created_at, rc.author_user_id
                   FROM structured.review_comments rc
                   WHERE rc.review_id = r.id AND rc.status = 'published'
                   ORDER BY rc.created_at, rc.id
                   LIMIT 2
                 ) recent) AS comments,
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
        reviews: await Promise.all(page.map(async (row) => {
          const interactions = await reviewInteractionPayload(context, row);
          return {
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
          ...interactions,
        };
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

  /** 도움돼요는 사용자×후기 한 줄이라 PUT을 여러 번 불러도 하나만 남는다. */
  app.put<{ Params: { reviewId: string } }>(
    '/v1/reviews/:reviewId/helpful',
    auth,
    async (request) => {
      const userId = currentUserId(request);
      await ensureVisibleReview(context.pool, request.params.reviewId);
      await context.pool.query(
        `INSERT INTO structured.review_helpful (review_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (review_id, user_id) DO NOTHING`,
        [request.params.reviewId, userId]
      );
      return helpfulState(context.pool, request.params.reviewId, userId);
    }
  );

  /** 해제도 이미 없는 상태에서 성공한다. 빠른 연타가 404를 만들지 않는다. */
  app.delete<{ Params: { reviewId: string } }>(
    '/v1/reviews/:reviewId/helpful',
    auth,
    async (request) => {
      const userId = currentUserId(request);
      await ensureVisibleReview(context.pool, request.params.reviewId);
      await context.pool.query(
        'DELETE FROM structured.review_helpful WHERE review_id = $1 AND user_id = $2',
        [request.params.reviewId, userId]
      );
      return helpfulState(context.pool, request.params.reviewId, userId);
    }
  );

  /** 후기 댓글. 작성자 식별자는 계약에 내보내지 않고 mine만 계산한다. */
  app.get<{ Params: { reviewId: string } }>(
    '/v1/reviews/:reviewId/comments',
    open,
    async (request) => {
      await ensureVisibleReview(context.pool, request.params.reviewId);
      const userId = optionalUserId(request);
      const query = listQuerySchema.parse(request.query);
      const after = query.cursor ? decodeCursor(query.cursor) : null;

      const total = await context.pool.query<{ count: number }>(
        `SELECT count(*)::int AS count
         FROM structured.review_comments
         WHERE review_id = $1 AND status = 'published'`,
        [request.params.reviewId]
      );

      const { rows } = await context.pool.query<{
        id: string;
        body: string;
        created_at: Date;
        mine: boolean;
      }>(
        `SELECT id, body, created_at,
                coalesce(author_user_id = $2::uuid, false) AS mine
         FROM structured.review_comments
         WHERE review_id = $1
           AND status = 'published'
           AND ($3::timestamptz IS NULL OR (created_at, id) > ($3, $4::uuid))
         ORDER BY created_at, id
         LIMIT $5`,
        [
          request.params.reviewId,
          userId,
          after?.[0] ?? null,
          after?.[1] ?? null,
          query.limit + 1,
        ]
      );

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      return {
        comments: page.map((row) => ({
          id: row.id,
          body: row.body,
          createdAt: row.created_at.toISOString(),
          mine: row.mine,
        })),
        nextCursor: hasMore && page.length > 0 ? encodeCursor(page[page.length - 1]!) : null,
        count: Number(total.rows[0]?.count ?? 0),
      };
    }
  );

  app.post<{ Params: { reviewId: string } }>(
    '/v1/reviews/:reviewId/comments',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      const body = createReviewCommentRequestSchema.parse(request.body);
      await ensureVisibleReview(context.pool, request.params.reviewId);

      const risky = scanForRisk(body.body);
      if (risky.length > 0) {
        throw new ApiError('invalid_request', riskNotice(risky));
      }

      const { rows } = await context.pool.query<{ id: string; created_at: Date }>(
        `INSERT INTO structured.review_comments (review_id, author_user_id, body)
         VALUES ($1, $2, $3)
         RETURNING id, created_at`,
        [request.params.reviewId, userId, body.body]
      );

      return reply.status(201).send({
        id: rows[0]!.id,
        body: body.body,
        createdAt: rows[0]!.created_at.toISOString(),
        mine: true,
      });
    }
  );

  /** 자기 댓글만 지운다. 없는 글과 남의 글은 같은 404로 답한다. */
  app.delete<{ Params: { commentId: string } }>(
    '/v1/review-comments/:commentId',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      if (!isUuid(request.params.commentId)) throw notFound('댓글');
      const removed = await context.pool.query(
        `DELETE FROM structured.review_comments
         WHERE id = $1 AND author_user_id = $2
         RETURNING id`,
        [request.params.commentId, userId]
      );
      if (removed.rowCount !== 1) throw notFound('댓글');
      return reply.status(204).send();
    }
  );

  /** 댓글 신고도 접수만 한다. 신고만으로 댓글을 가리지 않는다. */
  app.post<{ Params: { commentId: string } }>(
    '/v1/review-comments/:commentId/reports',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      const body = createReviewCommentReportRequestSchema.parse(request.body);
      if (!isUuid(request.params.commentId)) throw notFound('댓글');

      const visible = await context.pool.query(
        `SELECT 1
         FROM structured.review_comments c
         JOIN structured.visible_reviews r ON r.id = c.review_id
         WHERE c.id = $1 AND c.status = 'published'`,
        [request.params.commentId]
      );
      if (visible.rowCount !== 1) throw notFound('댓글');

      const { rows } = await context.pool.query<{ id: string; received_at: Date }>(
        `INSERT INTO structured.review_comment_reports
           (comment_id, reporter_user_id, reason, note)
         VALUES ($1, $2, $3, $4)
         RETURNING id, received_at`,
        [request.params.commentId, userId, body.reason, body.note ?? null]
      );

      return reply.status(201).send({
        reportId: rows[0]!.id,
        status: 'received' as const,
        receivedAt: rows[0]!.received_at.toISOString(),
        acknowledgement: reviewReportAcknowledgement(),
      });
    }
  );

  /**
   * 운영자 가림. 신고와 분리한다 — 신고 버튼을 누른 사람이 게시 여부를 결정할 수
   * 없고, 운영자 판단이 들어온 시각과 사람을 남긴다.
   */
  app.post<{ Params: { commentId: string } }>(
    '/v1/admin/review-comments/:commentId/hide',
    operatorAuth,
    async (request, reply) => {
      const operatorId = currentUserId(request);
      if (!isUuid(request.params.commentId)) throw notFound('댓글');
      const hidden = await context.pool.query(
        `UPDATE structured.review_comments
         SET status = 'hidden', hidden_at = now(), hidden_by = $2, updated_at = now()
         WHERE id = $1 AND status = 'published'
         RETURNING id`,
        [request.params.commentId, operatorId]
      );
      if (hidden.rowCount !== 1) throw notFound('댓글');
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
