import { confirmFieldsRequestSchema } from '@weddingpick/api-contract';
import { computePriceStat, judgePrice, type PriceSample } from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { assertQuoteAccess, assertWeddingAccess } from '../access';
import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { withTransaction } from '../db';
import { ApiError, notFound } from '../errors';
import { loadQuote } from '../quote-view';

export function registerQuoteRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  app.get<{ Params: { quoteId: string } }>('/v1/quotes/:quoteId', auth, async (request) => {
    const userId = currentUserId(request);
    await assertQuoteAccess(context.pool, request.params.quoteId, userId);

    return loadQuote(context.pool, request.params.quoteId);
  });

  app.get<{ Params: { weddingId: string }; Querystring: { offset?: string; limit?: string } }>(
    '/v1/weddings/:weddingId/quotes',
    auth,
    async (request) => {
      const userId = currentUserId(request);
      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      // 페이지네이션 파라미터 - 에러 처리 강화
      let offset = 0;
      let limit = 20;

      if (request.query.offset) {
        const parsed = parseInt(request.query.offset, 10);
        if (isNaN(parsed) || parsed < 0) {
          throw new ApiError('invalid_request', 'offset은 0 이상의 정수여야 합니다.');
        }
        offset = parsed;
      }

      if (request.query.limit) {
        const parsed = parseInt(request.query.limit, 10);
        if (isNaN(parsed) || parsed < 1) {
          throw new ApiError('invalid_request', 'limit은 1 이상의 정수여야 합니다.');
        }
        if (parsed > 100) {
          throw new ApiError('invalid_request', 'limit은 최대 100입니다.');
        }
        limit = parsed;
      }

      // 전체 개수 조회
      const { rows: countRows } = await context.pool.query<{ total: number }>(
        'SELECT COUNT(*)::int AS total FROM structured.quotes WHERE wedding_id = $1',
        [request.params.weddingId]
      );
      const total = countRows[0]?.total || 0;

      // 페이지네이션된 결과 조회
      const { rows } = await context.pool.query<{ id: string }>(
        'SELECT id FROM structured.quotes WHERE wedding_id = $1 ORDER BY created_at DESC OFFSET $2 LIMIT $3',
        [request.params.weddingId, offset, limit]
      );

      const quotes = await Promise.all(rows.map((row) => loadQuote(context.pool, row.id)));

      // cursor 기반 페이지네이션 지원
      const nextCursor = offset + limit < total ? String(offset + limit) : null;

      return { quotes, nextCursor, total, offset, limit };
    }
  );

  /**
   * A-07 확인 단계. **읽은 그대로 맞다고 하는 것뿐이다**(v3.24).
   *
   * 핵심 필드가 모두 확인되면 confirmed_at을 채운다. 남아 있으면 채우지 않는다 —
   * DB 트리거도 같은 것을 막지만, 여기서 미리 판단해 오류 대신 진행 상태를 돌려준다.
   */
  app.post<{ Params: { quoteId: string } }>(
    '/v1/quotes/:quoteId/confirmations',
    auth,
    async (request) => {
      const userId = currentUserId(request);
      const { quoteId } = request.params;
      const body = confirmFieldsRequestSchema.parse(request.body);

      await assertQuoteAccess(context.pool, quoteId, userId);

      await withTransaction(context.pool, async (client) => {
        for (const field of body.fields) {
          /*
           * 확인 표시만 켠다. `corrected_value`는 건드리지 않는다 — 고쳐 보낼
           * 자리를 계약에서 뺐고(v3.24), 이미 고쳐진 옛 값은 그대로 남는다.
           */
          const { rowCount } = await client.query(
            `UPDATE structured.extraction_fields
             SET confirmed_by_user = true
             WHERE quote_id = $1 AND field_path = $2`,
            [quoteId, field.path]
          );

          if (rowCount === 0) {
            throw new ApiError('invalid_request', `${field.path} 항목이 없습니다.`);
          }
        }

        const pending = await client.query(
          `SELECT 1 FROM structured.extraction_fields
           WHERE quote_id = $1 AND requires_confirmation AND NOT confirmed_by_user`,
          [quoteId]
        );

        if (pending.rowCount === 0) {
          await client.query(
            'UPDATE structured.quotes SET confirmed_at = now() WHERE id = $1 AND confirmed_at IS NULL',
            [quoteId]
          );
        }
      });

      return loadQuote(context.pool, quoteId);
    }
  );

  /**
   * A-09 실제 가격 비교.
   *
   * 중앙값과 판단은 도메인 패키지가 계산한다 — AI는 읽고 서버가 센다(사업계획서 27번).
   * 비교할 수 없으면 값을 지어내지 않고 이유를 돌려준다.
   */
  app.get<{ Params: { quoteId: string } }>(
    '/v1/quotes/:quoteId/comparison',
    auth,
    async (request) => {
      const userId = currentUserId(request);
      const { quoteId } = request.params;

      await assertQuoteAccess(context.pool, quoteId, userId);

      const { rows } = await context.pool.query<{
        doc_type: string;
        vendor_id: string | null;
        product_key: string | null;
        total_amount: string | null;
        confirmed_at: Date | null;
      }>(
        `SELECT doc_type, vendor_id, product_key, total_amount, confirmed_at
         FROM structured.quotes WHERE id = $1`,
        [quoteId]
      );

      const quote = rows[0];

      if (!quote) {
        throw notFound('문서');
      }

      const docType = quote.doc_type as never;

      if (!quote.confirmed_at || quote.total_amount === null) {
        return { available: false, docType, reason: 'amount_unconfirmed' };
      }

      if (!quote.vendor_id) {
        return { available: false, docType, reason: 'vendor_unknown' };
      }

      if (!quote.product_key) {
        return { available: false, docType, reason: 'product_unknown' };
      }

      // 집계는 comparable_quotes 뷰만 본다. 등급·확인 조건이 뷰 안에 들어 있다.
      // 내 문서는 뺀다 — 내 가격이 섞인 분포와 견주면 비교가 되지 않는다.
      const samples = await context.pool.query<{
        amount: string;
        verification_level: PriceSample['verificationLevel'];
        contract_date: Date;
      }>(
        `SELECT total_amount AS amount, verification_level, contract_date
         FROM structured.comparable_quotes
         WHERE vendor_id = $1 AND product_key = $2 AND doc_type = $3 AND id <> $4`,
        [quote.vendor_id, quote.product_key, quote.doc_type, quoteId]
      );

      const stat = computePriceStat(
        samples.rows.map((row) => ({
          amount: Number(row.amount),
          verificationLevel: row.verification_level,
          contractDate: row.contract_date.toISOString().slice(0, 10),
        }))
      );

      if (!stat) {
        return {
          available: false,
          docType,
          reason: 'not_enough_samples',
          sampleCount: samples.rowCount ?? 0,
        };
      }

      const myAmount = Number(quote.total_amount);

      return {
        available: true,
        docType,
        myAmount,
        stat,
        judgement: judgePrice(myAmount, stat),
      };
    }
  );
}
