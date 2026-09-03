import { createVerificationRequestSchema } from '@weddingpick/api-contract';
import {
  REQUIRED_EVIDENCE_KIND,
  VERIFICATION_EVIDENCE_RULES,
  VERIFICATION_LEVEL_RULES,
  hasRequiredEvidence,
  isAtLeast,
  withObject,
  withSubject,
} from '@weddingpick/domain';
import type { VerificationLevel } from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { assertQuoteAccess } from '../access';
import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { withTransaction } from '../db';
import { ApiError, forbidden, notFound } from '../errors';

export function registerVerificationRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  /**
   * A-13 인증 신청.
   *
   * 접수만 한다. 등급은 사람이 증빙을 확인한 뒤에야 오른다 — 서비스정책서 7번.
   * 이 경로는 어떤 경우에도 verification_level을 건드리지 않는다.
   */
  app.post<{ Params: { quoteId: string } }>(
    '/v1/quotes/:quoteId/verification-requests',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      const { quoteId } = request.params;
      const body = createVerificationRequestSchema.parse(request.body);

      await assertQuoteAccess(context.pool, quoteId, userId);

      const { rows } = await context.pool.query<{
        confirmed_at: Date | null;
        verification_level: VerificationLevel;
      }>(
        'SELECT confirmed_at, verification_level FROM structured.quotes WHERE id = $1',
        [quoteId]
      );

      const quote = rows[0];

      if (!quote?.confirmed_at) {
        throw new ApiError(
          'confirmation_required',
          '금액과 계약일을 확인한 뒤에 인증을 신청할 수 있습니다.'
        );
      }

      // 이미 받은 등급을 다시 신청하면 심사자만 헛일한다.
      if (isAtLeast(quote.verification_level, body.targetLevel)) {
        throw new ApiError(
          'invalid_request',
          `이 문서는 이미 ${VERIFICATION_LEVEL_RULES[quote.verification_level].label}입니다.`
        );
      }

      /*
       * 목표 등급에 맞는 증빙이 없으면 접수하지 않는다.
       *
       * 계약인증(L2)부터는 시장가격에 반영된다(서비스정책서 2번). 견적서만 낸 신청을
       * 심사대기 줄에 세워두면, 언젠가 사람이 지쳐서 통과시킨다.
       */
      if (!hasRequiredEvidence(body.targetLevel, body.evidence.map((item) => item.kind))) {
        const required = VERIFICATION_EVIDENCE_RULES[REQUIRED_EVIDENCE_KIND[body.targetLevel]];

        throw new ApiError(
          'invalid_request',
          `${VERIFICATION_LEVEL_RULES[body.targetLevel].label}에는 ${withSubject(required.label)} 있어야 합니다. ${withObject(required.description)} 함께 올려주세요.`
        );
      }

      const requestId = await withTransaction(context.pool, async (client) => {
        const created = await client.query<{ id: string; received_at: Date }>(
          `INSERT INTO structured.verification_requests (quote_id, requested_by, target_level)
           VALUES ($1, $2, $3) RETURNING id, received_at`,
          [quoteId, userId, body.targetLevel]
        );

        const row = created.rows[0]!;

        for (const evidence of body.evidence) {
          const owned = await client.query(
            'SELECT 1 FROM originals.raw_documents WHERE id = $1 AND owner_user_id = $2',
            [evidence.rawDocumentId, userId]
          );

          if (owned.rowCount === 0) {
            throw new ApiError('invalid_request', '증빙 문서를 찾을 수 없습니다.');
          }

          await client.query(
            `INSERT INTO structured.verification_evidence (request_id, kind, raw_document_id)
             VALUES ($1, $2, $3)`,
            [row.id, evidence.kind, evidence.rawDocumentId]
          );
        }

        return row;
      });

      return reply.status(202).send({
        requestId: requestId.id,
        status: 'received',
        receivedAt: requestId.received_at.toISOString(),
      });
    }
  );

  app.get<{ Params: { requestId: string } }>(
    '/v1/verification-requests/:requestId',
    auth,
    async (request) => {
      const userId = currentUserId(request);

      const { rows } = await context.pool.query<{
        id: string;
        quote_id: string;
        requested_by: string;
        target_level: string;
        status: string;
        received_at: Date;
        decided_at: Date | null;
        rejection_reason: string | null;
        supplement_reason: string | null;
      }>(
        `SELECT id, quote_id, requested_by, target_level, status, received_at,
                decided_at, rejection_reason, supplement_reason
         FROM structured.verification_requests WHERE id = $1`,
        [request.params.requestId]
      );

      const found = rows[0];

      if (!found) {
        throw notFound('인증 신청');
      }

      if (found.requested_by !== userId) {
        throw forbidden();
      }

      return {
        requestId: found.id,
        quoteId: found.quote_id,
        targetLevel: found.target_level,
        status: found.status,
        receivedAt: found.received_at.toISOString(),
        decidedAt: found.decided_at?.toISOString() ?? null,
        ...(found.rejection_reason && { rejectionReason: found.rejection_reason }),
        ...(found.supplement_reason && { supplementReason: found.supplement_reason }),
      };
    }
  );
}
