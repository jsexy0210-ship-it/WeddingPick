import {
  parsePaymentTextRequestSchema,
  registerPaymentProofRequestSchema,
} from '@weddingpick/api-contract';
import {
  PAYMENT_PROOF_RETENTION_HOURS,
  canRegisterPaymentProof,
  hasDeepData,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { readPaymentProof } from '../analysis/proof-pipeline';
import { withTransaction } from '../db';
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
   * 결제문자 읽기. **AI를 부르지 않는다.**
   *
   * 스펙 7.3의 처리 순서를 그대로 따른다 — 규칙으로 읽어보고, 못 읽은 것만 다음
   * 단계로 간다. 결제문자는 카드사가 기계로 찍어 보내는 글이라 형태가 고정돼 있어
   * 대부분 여기서 읽힌다. 이걸 AI에 보내는 것은 곱셈을 시키려고 사람을 부르는 것과
   * 같다.
   *
   * **읽기만 하고 저장하지 않는다.** 사람이 확인한 뒤에 등록이 따로 온다 — 잘못
   * 읽은 값이 확인 없이 분포에 들어가면, 그건 읽기 실패보다 나쁘다.
   */
  app.post('/v1/payment-proofs/parse', auth, async (request) => {
    const userId = currentUserId(request);
    const body = parsePaymentTextRequestSchema.parse(request.body);

    if (!body.text && !body.rawDocumentId) {
      throw new ApiError('invalid_request', '읽을 글이나 사진이 필요합니다.');
    }

    /*
     * 사진은 규칙이 못 읽었을 때만 쓰인다(proof-pipeline이 판단한다). 여기서는
     * 넘겨줄 준비만 한다 — 남의 업로드를 읽지 못하게 주인부터 본다.
     */
    const images = body.rawDocumentId
      ? await loadProofImages(context, userId, body.rawDocumentId)
      : [];

    const result = await readPaymentProof({
      pool: context.pool,
      reader: context.proofReader,
      models: {
        cheap: context.config.proofReaderCheapModel,
        strong: context.config.proofReaderStrongModel,
      },
      text: body.text,
      images,
    });

    const { reading } = result;
    // 파서와 모델이 같은 모양을 내보내므로 여기서 갈라질 것이 없다.
    const field = <T>(value: T | null) =>
      value === null ? null : { value, confidence: reading.confidence };

    return {
      rejection: reading.rejection,
      merchantName: field(reading.merchantName),
      paidAmount: field(reading.paidAmount),
      paidAt: field(reading.paidAt),
      method: field(reading.method),
      maskedIdentifiers: reading.maskedIdentifiers,
      missing: (['merchantName', 'paidAmount', 'paidAt', 'method'] as const).filter(
        (key) => reading[key] === null
      ),
      needsConfirmation: result.needsConfirmation,
      readingId: result.usageId,
      notice: result.notice,
    };
  });

  /**
   * 결제인증 등록.
   *
   * **심사가 아니다.** 인증 신청(`/v1/quotes/{id}/verification-requests`)과 다른
   * 경로다 — 사람이 보지 않고, 문서 등급을 올리지 않으며, 시장 대표가격에도
   * 들어가지 않는다. 하는 일은 둘이다: 결제인증 표시와 실제 결제 분포 열기.
   *
   * 카드번호를 받을 필드가 계약에 없다. 앱이 보내려 해도 보낼 곳이 없다.
   */
  app.post('/v1/payment-proofs', auth, async (request, reply) => {
    const userId = currentUserId(request);
    const body = registerPaymentProofRequestSchema.parse(request.body);

    const check = canRegisterPaymentProof({
      merchantName: body.merchantName,
      paidAmount: body.paidAmount,
      paidAt: body.paidAt,
    });

    if (!check.ok) {
      throw new ApiError('invalid_request', check.reason);
    }

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
    if (body.rawDocumentId) {
      const owned = await context.pool.query(
        `SELECT 1 FROM originals.raw_documents
         WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL`,
        [body.rawDocumentId, userId]
      );

      if (owned.rows.length === 0) {
        throw notFound('촬영한 원본');
      }
    }

    const vendorId = body.vendorId ?? (await matchVendor(context.pool, body.merchantName));

    let proofId: string;

    try {
      proofId = await withTransaction(context.pool, async (client) => {
        const created = await client.query<{ id: string }>(
          `INSERT INTO structured.payment_proofs
             (reporter_user_id, vendor_id, merchant_name, paid_amount, paid_at, method,
              masked_identifiers, raw_document_id, analyzed_at)
           VALUES ($1, $2, $3, $4, $5, $6::payment_method,
                   $7::masked_identifier_kind[], $8, now())
           RETURNING id`,
          [
            userId,
            vendorId,
            body.merchantName.trim(),
            body.paidAmount,
            body.paidAt,
            body.method,
            body.maskedIdentifiers,
            body.rawDocumentId ?? null,
          ]
        );

        /*
         * 원본의 종류를 못박는다. 업로드 때 이미 받지만(documents.ts), 예전에 올린
         * 것을 뒤늦게 등록하는 길이 있어 여기서도 맞춰둔다. 24시간 시계가 이 값에
         * 걸려 있으므로 어긋나면 안 된다.
         */
        if (body.rawDocumentId) {
          await client.query(
            `UPDATE originals.raw_documents SET kind = 'payment_proof' WHERE id = $1`,
            [body.rawDocumentId]
          );
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
     * 이 값이 높으면 읽기가 나쁜 것이고, 그러면 모델을 바꾸거나 규칙을 손봐야 한다.
     * 재지 않으면 나쁜지도 모른다.
     */
    if (body.readingId !== undefined && body.readingCorrected !== undefined) {
      await context.pool.query(
        'UPDATE structured.ai_usage SET user_corrected = $2 WHERE id = $1',
        [body.readingId, body.readingCorrected]
      );
    }

    const unlock = await context.pool.query(
      'SELECT proof_count FROM structured.data_unlocks WHERE user_id = $1',
      [userId]
    );

    const deletedBy = body.rawDocumentId
      ? await context.pool.query<{ retention_until: Date | null }>(
          'SELECT retention_until FROM originals.document_retention_schedule WHERE id = $1',
          [body.rawDocumentId]
        )
      : null;

    return reply.status(201).send({
      paymentProofId: proofId,
      matchedVendorId: vendorId,
      unmatchedNote: vendorId
        ? null
        : '영수증의 가맹점 이름으로 업체를 찾지 못했습니다. 어디인지 알려주시면 이어붙이겠습니다.',
      deepData: hasDeepData({
        usablePaymentProofCount: Number(unlock.rows[0]?.proof_count ?? 0),
      }),
      originalDeletedBy: deletedBy?.rows[0]?.retention_until?.toISOString() ?? null,
    });
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
