import {
  claimPaymentProofFieldsRequestSchema,
  registerPaymentProofRequestSchema,
} from '@weddingpick/api-contract';
import {
  PAYMENT_PROOF_CLAIMED_NOTE,
  PAYMENT_PROOF_RETENTION_HOURS,
  claimPaymentProofFields,
  hasDeepData,
  paymentProofIntake,
  type PaymentMethod,
  type PaymentProofField,
  type PaymentProofReviewState,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { readPaymentProof } from '../analysis/proof-pipeline';
import { withTransaction } from '../db';
import { qualifyReferral } from '../rewards';
import { ApiError, notFound } from '../errors';

/**
 * 가맹점 이름으로 업체를 찾는다.
 *
 * 이름 맞추기는 DB의 normalize_vendor_name을 그대로 쓴다 — 서버가 따로 흉내내면
 * 색인에 저장된 값과 어긋나 "분명히 있는데 안 잡히는" 업체가 생긴다. 검색이 쓰는
 * 것과 같은 함수다.
 *
 * **여러 곳이 걸리면 고르지 않는다.** 가맹점 이름은 짧고 겹치기 쉬워서, 아무거나
 * 고르면 남의 업체 분포에 내 결제가 들어간다. 못 찾은 것으로 둔다.
 */
async function matchVendor(pool: Pool, merchantName: string): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    `WITH needle AS (SELECT structured.normalize_vendor_name($1) AS value)
     SELECT v.id
     FROM structured.vendors v, needle n
     WHERE v.normalized_name = n.value
        OR EXISTS (SELECT 1 FROM structured.vendor_aliases a
                   WHERE a.vendor_id = v.id AND a.normalized_alias = n.value)
     LIMIT 2`,
    [merchantName]
  );

  return rows.length === 1 ? rows[0]!.id : null;
}

/**
 * 읽어줄 이미지를 스토리지에서 가져온다.
 *
 * **주인부터 본다.** 남의 업로드 id를 넣어 남의 영수증을 읽게 할 수 없다.
 */
async function loadProofImages(context: AppContext, userId: string, rawDocumentId: string) {
  const owned = await context.pool.query(
    `SELECT 1 FROM originals.raw_documents
     WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL`,
    [rawDocumentId, userId]
  );

  if (owned.rows.length === 0) {
    throw notFound('촬영한 원본');
  }

  const { rows } = await context.pool.query<{ storage_key: string; mime_type: string }>(
    `SELECT storage_key, mime_type FROM originals.raw_document_pages
     WHERE raw_document_id = $1 ORDER BY page_index`,
    [rawDocumentId]
  );

  return Promise.all(
    rows.map(async (row) => ({
      mimeType: row.mime_type,
      bytes: await context.storage.download(row.storage_key),
    }))
  );
}

export function registerPaymentProofRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  /**
   * 결제인증 등록 — **사진 한 장.**
   *
   * 핸드오프 v3.24가 제보를 «사진 찍기 또는 업로드»로 압축했다. 사용자가 하는 일은
   * 사진 한 장이고, 금액·업체·날짜를 **받지 않는다** — 받을 자리가 없으니 화면이
   * 지어낸 값을 보낼 수 없다.
   *
   * 못 읽었으면 접수는 성립하되 `pending_review`로 남는다. 「못 읽었다」가 정상
   * 상태다 — 보류인 동안에는 어떤 통계·Unlock·지출에도 들어가지 않는다(0150의
   * `usable_payment_proofs` · `wedding_expenses`).
   *
   * **심사가 아니다.** 인증 신청(`/v1/quotes/{id}/verification-requests`)과 다른
   * 경로다 — 사람이 등급을 올리지 않고, 시장 대표가격에도 들어가지 않는다.
   *
   * 카드번호를 받을 필드가 계약에 없다. 앱이 보내려 해도 보낼 곳이 없다.
   */
  app.post('/v1/payment-proofs', auth, async (request, reply) => {
    const userId = currentUserId(request);
    const body = registerPaymentProofRequestSchema.parse(request.body);

    /*
     * 동의 없이는 받지 않는다. 핸드오프 10번 · 19번.
     *
     * **관문은 뷰 하나다**(`active_payment_consents`). 화면이 동의 화면을
     * 지나게 하는 것으로 충분하다고 두면, 철회한 사람이 옛 화면을 열어둔 채
     * 등록하는 길이 남는다.
     */
    const consent = await context.pool.query(
      'SELECT 1 FROM structured.active_payment_consents WHERE user_id = $1',
      [userId]
    );

    if (consent.rows.length === 0) {
      throw new ApiError('forbidden', '결제내역 등록에 먼저 동의해주세요.');
    }

    if (body.vendorId) {
      const found = await context.pool.query('SELECT 1 FROM structured.vendors WHERE id = $1', [
        body.vendorId,
      ]);

      if (found.rows.length === 0) {
        throw notFound('업체');
      }
    }

    // 원본은 자기 것만 쓸 수 있다. 남의 업로드에 내 제보를 붙일 수 없게.
    const images = await loadProofImages(context, userId, body.rawDocumentId);

    /*
     * 읽기는 서버가 한다. 예전에는 앱이 `/parse`를 부르고 그 값을 확인 화면에
     * 채워 되보냈다 — 그 확인 화면이 폐기되면서 되보낼 사람이 없어졌다.
     */
    const read = await readPaymentProof({
      pool: context.pool,
      reader: context.proofReader,
      models: {
        cheap: context.config.proofReaderCheapModel,
        strong: context.config.proofReaderStrongModel,
      },
      images,
    });

    const intake = paymentProofIntake({
      merchantName: read.reading.merchantName,
      paidAmount: read.reading.paidAmount,
      paidAt: read.reading.paidAt,
      needsConfirmation: read.needsConfirmation,
      rejection: read.reading.rejection,
    });

    /*
     * 보류 사유는 한 번만 정하고 표와 응답에 같은 것을 쓴다. 예산이 바닥나
     * 읽지 못한 것은 「못 읽었다」보다 구체적이라 그쪽을 앞세운다.
     */
    const reviewNote = read.notice ?? intake.reviewNote;

    /*
     * 업체는 읽어낸 가맹점 이름으로만 찾는다. 보류 줄은 이름을 못 읽었을 수
     * 있고, 그때는 찾지 않는다 — 없는 이름으로 아무 업체나 걸면 남의 분포에
     * 내 결제가 들어간다.
     */
    const vendorId =
      body.vendorId ??
      (intake.state === 'accepted' && read.reading.merchantName
        ? await matchVendor(context.pool, read.reading.merchantName)
        : null);

    let proofId: string;

    try {
      proofId = await withTransaction(context.pool, async (client) => {
        const created = await client.query<{ id: string }>(
          `INSERT INTO structured.payment_proofs
             (reporter_user_id, vendor_id, merchant_name, paid_amount, paid_at, method,
              masked_identifiers, raw_document_id, analyzed_at,
              review_state, pending_fields, review_note)
           VALUES ($1, $2, $3, $4, $5, $6::payment_method,
                   $7::masked_identifier_kind[], $8, now(),
                   $9::payment_proof_review_state, $10::payment_proof_field[], $11)
           RETURNING id`,
          [
            userId,
            vendorId,
            read.reading.merchantName?.trim() || null,
            read.reading.paidAmount,
            read.reading.paidAt,
            read.reading.method ?? 'unknown',
            read.reading.maskedIdentifiers,
            body.rawDocumentId,
            intake.state,
            intake.pendingFields,
            reviewNote,
          ]
        );

        /*
         * 원본의 종류를 못박는다. 업로드 때 이미 받지만(documents.ts), 예전에 올린
         * 것을 뒤늦게 등록하는 길이 있어 여기서도 맞춰둔다. 24시간 시계가 이 값에
         * 걸려 있으므로 어긋나면 안 된다.
         */
        await client.query(
          `UPDATE originals.raw_documents SET kind = 'payment_proof' WHERE id = $1`,
          [body.rawDocumentId]
        );

        /*
         * 초대받고 들어온 사람의 첫 결제인증이면 초대한 사람의 보상 조건이
         * 찬다(I-1 · K-7). **같은 트랜잭션에 둔다** — 결제인증은 됐는데 원장에만
         * 안 남으면 그 사람은 영영 못 받고 우리는 그 사실도 모른다.
         *
         * 보류 줄로는 차지 않는다. 보상 조건은 `usable_payment_proofs`를 보므로
         * 여기서 불러도 세어지지 않지만, 부르지 않는 편이 뜻이 분명하다.
         */
        if (intake.state === 'accepted') {
          await qualifyReferral(client, userId);
        }

        return created.rows[0]!.id;
      });
    } catch (error) {
      // 같은 가맹점·시각·금액. 같은 결제를 두 번 넣어 분포를 끌 수 없다.
      if (error instanceof Error && error.message.includes('payment_proofs_reporter_user_id')) {
        throw new ApiError('conflict', '같은 결제를 이미 등록하셨습니다.');
      }

      throw error;
    }

    /*
     * 읽어준 값을 사람이 고쳤는지 남긴다. 스펙 7.3의 user_correction_rate.
     *
     * **이제 고칠 화면이 없다**(v3.24가 확인 화면을 폐기했다). 대신 보류로 남았는지를
     * 같은 자리에 적는다 — 재려던 것은 「읽기가 얼마나 나빴나」이고, 사람이 고친
     * 횟수든 검수로 넘어간 횟수든 그 답을 준다.
     */
    if (read.usageId !== null) {
      await context.pool.query(
        'UPDATE structured.ai_usage SET user_corrected = $2 WHERE id = $1',
        [read.usageId, intake.state === 'pending_review']
      );
    }

    const unlock = await context.pool.query(
      'SELECT proof_count FROM structured.data_unlocks WHERE user_id = $1',
      [userId]
    );

    const deletedBy = await context.pool.query<{ retention_until: Date | null }>(
      'SELECT retention_until FROM originals.document_retention_schedule WHERE id = $1',
      [body.rawDocumentId]
    );

    return reply.status(201).send({
      paymentProofId: proofId,
      status: intake.state,
      pendingFields: intake.pendingFields,
      reviewNote,
      merchantName: read.reading.merchantName,
      paidAmount: read.reading.paidAmount,
      paidAt: read.reading.paidAt,
      method: read.reading.method ?? 'unknown',
      maskedIdentifiers: read.reading.maskedIdentifiers,
      matchedVendorId: vendorId,
      unmatchedNote:
        vendorId || intake.state === 'pending_review'
          ? null
          : '영수증의 가맹점 이름으로 업체를 찾지 못했습니다. 어디인지 알려주시면 이어붙이겠습니다.',
      deepData: hasDeepData({
        usablePaymentProofCount: Number(unlock.rows[0]?.proof_count ?? 0),
      }),
      originalDeletedBy: deletedBy.rows[0]?.retention_until?.toISOString() ?? null,
    });
  });

  /**
   * 못 읽은 칸을 사용자가 직접 적는다 — WP-RPT-004 「직접 입력」. 2026-09-14 대표 지시.
   *
   * **사진을 낸 줄에만 열린다.** 대상은 내 제보 중 `pending_review`인 줄이고, 그런
   * 줄은 사진을 올렸기 때문에 존재한다. 증빙 없이 금액만 받던 화면(폐기된
   * WP-RPT-010)과 갈리는 자리가 여기다 — 보낼 대상 자체가 없다.
   *
   * **못 읽은 칸만 받는다.** 기계가 읽어낸 칸을 보내오면 거절한다. 읽은 값을 사람이
   * 덮어쓰는 길을 열면 「기계가 읽은 값」이라는 말이 그때부터 거짓이 된다.
   *
   * **적었다고 반영되지 않는다.** 줄은 `pending_review`에 그대로 머무르고, 사람이
   * 적었다는 사실이 칸 단위로 남는다(0240의 `claimed_fields`). 운영자가 확인해야
   * `accepted`가 되고, 그때서야 금액 구간·지출·Unlock에 들어간다.
   */
  app.post('/v1/payment-proofs/:paymentProofId/claimed-fields', auth, async (request) => {
    const userId = currentUserId(request);
    const { paymentProofId } = request.params as { paymentProofId: string };
    const claim = claimPaymentProofFieldsRequestSchema.parse(request.body);

    /*
     * 남의 제보에 값을 적을 수 없다. 주인을 조건에 넣어 「없는 것」과 「남의 것」을
     * 같은 답으로 돌려준다 — 어느 id가 있는지를 밖에서 세어볼 수 없게 한다.
     */
    const { rows } = await context.pool.query<{
      review_state: PaymentProofReviewState;
      pending_fields: PaymentProofField[];
      merchant_name: string | null;
      paid_amount: string | null;
      paid_at: Date | null;
      method: PaymentMethod;
      has_original: boolean;
    }>(
      /*
       * `pending_fields`를 `::text[]`로 꺼낸다. node-pg는 우리가 만든 enum의 배열을
       * 풀어주지 못해 `'{a,b}'` 문자열 그대로 돌려주고, 그것을 배열로 알고 쓰면
       * 못 읽은 칸 목록이 한 글자씩 쪼개진다.
       */
      `SELECT p.review_state, p.pending_fields::text[], p.merchant_name, p.paid_amount::text,
              p.paid_at, p.method, (p.raw_document_id IS NOT NULL) AS has_original
       FROM structured.payment_proofs p
       WHERE p.id = $1 AND p.reporter_user_id = $2`,
      [paymentProofId, userId]
    );

    const found = rows[0];

    if (!found) {
      throw notFound('제보');
    }

    const decided = claimPaymentProofFields(
      {
        reviewState: found.review_state,
        pendingFields: found.pending_fields,
        merchantName: found.merchant_name,
        // bigint는 pg가 문자열로 준다. 큰 수가 조용히 부정확해지지 않게 한 번만 바꾼다.
        paidAmount: found.paid_amount === null ? null : Number(found.paid_amount),
        paidAt: found.paid_at?.toISOString() ?? null,
        method: found.method,
        hasOriginal: found.has_original,
      },
      claim
    );

    if (!decided.ok) {
      throw new ApiError('invalid_request', decided.reason);
    }

    /*
     * `review_state`와 `pending_fields`를 건드리지 않는다. 사람이 적었어도 그 칸은
     * 여전히 **검수를 기다리는 칸**이고, 비우면 운영자 목록에서 왜 걸린 줄인지가
     * 사라진다(0150의 `payment_proofs_pending_has_reason`이 지키는 것도 그것이다).
     *
     * 업체도 여기서 잇지 않는다. 잇는 판단은 검수하는 사람이 한다 — 사람이 적은
     * 가맹점 이름으로 자동으로 이으면, 확인 전 값이 남의 업체 분포로 들어간다.
     */
    const updated = await context.pool.query(
      `UPDATE structured.payment_proofs
          SET merchant_name = $2,
              paid_amount = $3,
              paid_at = $4,
              claimed_fields = $5::payment_proof_field[],
              claimed_source = 'user',
              claimed_by = $6,
              claimed_at = now(),
              review_note = $7
        WHERE id = $1 AND review_state = 'pending_review'`,
      [
        paymentProofId,
        decided.merchantName,
        decided.paidAmount,
        decided.paidAt,
        decided.fields,
        userId,
        PAYMENT_PROOF_CLAIMED_NOTE,
      ]
    );

    // 그 사이 운영자가 먼저 검수를 끝냈다. 사람이 확인한 값을 덮어쓰지 않는다.
    if (updated.rowCount === 0) {
      throw new ApiError('conflict', '이미 확인이 끝난 제보예요.');
    }

    return {
      paymentProofId,
      status: 'pending_review' as const,
      claimedFields: decided.fields,
      claimedSource: 'user' as const,
      reviewNote: PAYMENT_PROOF_CLAIMED_NOTE,
    };
  });

  /**
   * 내가 낸 결제인증과, 그것으로 열린 것.
   *
   * **가격을 여는 값이 아니다.** 최종통합정책 v2.0 K-6이 그 잠금을 폐기했다 —
   * 실제 결제 구간은 누구나 본다. 여기서 열리는 것은 조건이 비슷한 사례다.
   */
  app.get('/v1/me/data-unlock', auth, async (request) => {
    const userId = currentUserId(request);

    const { rows } = await context.pool.query<{ proof_count: string }>(
      'SELECT proof_count FROM structured.data_unlocks WHERE user_id = $1',
      [userId]
    );

    const count = Number(rows[0]?.proof_count ?? 0);

    return {
      deepData: hasDeepData({ usablePaymentProofCount: count }),
      paymentProofCount: count,
      retentionHours: PAYMENT_PROOF_RETENTION_HOURS,
    };
  });
}
