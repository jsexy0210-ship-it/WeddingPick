import {
  parsePaymentTextRequestSchema,
  registerPaymentProofRequestSchema,
} from '@weddingpick/api-contract';
import {
  LOW_CONFIDENCE_THRESHOLD,
  PAYMENT_PROOF_RETENTION_HOURS,
  canRegisterPaymentProof,
  fieldsNeedingConfirmation,
  hasDataUnlock,
  parsePaymentText,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
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
    const { text } = parsePaymentTextRequestSchema.parse(request.body);
    const parsed = parsePaymentText(text);

    return {
      rejection: parsed.rejection,
      merchantName: parsed.merchantName,
      paidAmount: parsed.paidAmount,
      paidAt: parsed.paidAt,
      method: parsed.method,
      maskedIdentifiers: parsed.maskedIdentifiers,
      missing: parsed.missing,
      // 문서 쪽과 같은 기준값을 쓴다. 두 화면이 다르면 그 표시를 못 믿게 된다.
      needsConfirmation: fieldsNeedingConfirmation(parsed, LOW_CONFIDENCE_THRESHOLD),
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
      unlocked: hasDataUnlock({
        usablePaymentProofCount: Number(unlock.rows[0]?.proof_count ?? 0),
      }),
      originalDeletedBy: deletedBy?.rows[0]?.retention_until?.toISOString() ?? null,
    });
  });

  /**
   * 내 자격.
   *
   * 화면이 "몇 건 더 내면 열리는지"를 말할 수 있어야 한다. 잠긴 것만 보여주고
   * 왜 잠겼는지 말하지 않으면, 그건 팔려는 것처럼 보인다.
   */
  app.get('/v1/me/data-unlock', auth, async (request) => {
    const userId = currentUserId(request);

    const { rows } = await context.pool.query<{ proof_count: string }>(
      'SELECT proof_count FROM structured.data_unlocks WHERE user_id = $1',
      [userId]
    );

    const count = Number(rows[0]?.proof_count ?? 0);

    return {
      unlocked: hasDataUnlock({ usablePaymentProofCount: count }),
      paymentProofCount: count,
      retentionHours: PAYMENT_PROOF_RETENTION_HOURS,
    };
  });
}
