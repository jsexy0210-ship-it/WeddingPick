import { createPriceReportRequestSchema } from '@weddingpick/api-contract';
import { PRICE_REPORT_CAVEAT, canSubmitPriceReport } from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { ApiError, notFound } from '../errors';

export function registerPriceReportRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  /**
   * 가격 제보.
   *
   * 문서를 받지 않는다. 그래서 이 값은 시장 대표가격에 들어가지 않고, 다른
   * 표(structured.price_reports)에 저장된다 — 서비스정책서 2번.
   *
   * 로그인을 요구하는 것은 익명이 아니라서가 아니다. 화면에는 익명으로 나가되,
   * 한 사람이 같은 상품에 여러 번 넣어 중앙값을 끄는 것을 막으려면 누가 넣었는지
   * 알아야 한다.
   */
  app.post('/v1/price-reports', auth, async (request, reply) => {
    const userId = currentUserId(request);
    const body = createPriceReportRequestSchema.parse(request.body);

    const check = canSubmitPriceReport({
      vendorId: body.vendorId,
      productName: body.productName,
      totalAmount: body.totalAmount,
      contractedOn: body.contractedOn,
    });

    if (!check.ok) {
      throw new ApiError('invalid_request', check.reason);
    }

    const vendor = await context.pool.query('SELECT 1 FROM structured.vendors WHERE id = $1', [
      body.vendorId,
    ]);

    if (vendor.rows.length === 0) {
      throw notFound('업체');
    }

    try {
      const { rows } = await context.pool.query<{ id: string }>(
        `INSERT INTO structured.price_reports
           (vendor_id, reporter_user_id, product_name, total_amount, contracted_on,
            guaranteed_guests, meal_price_per_person, included_note)
         VALUES ($1, $2, $3, $4, ($5 || '-01')::date, $6, $7, $8)
         RETURNING id`,
        [
          body.vendorId,
          userId,
          body.productName.trim(),
          body.totalAmount,
          body.contractedOn,
          body.guaranteedGuests ?? null,
          body.mealPricePerPerson ?? null,
          body.includedNote ?? null,
        ]
      );

      return reply.status(201).send({ reportId: rows[0]!.id, caveat: PRICE_REPORT_CAVEAT });
    } catch (error) {
      // 같은 사람이 같은 상품에 두 번. 스키마가 막는다.
      if (error instanceof Error && error.message.includes('price_reports_vendor_id')) {
        throw new ApiError(
          'invalid_request',
          '이 업체의 같은 상품에 이미 제보하셨습니다. 고치시려면 알려주세요.'
        );
      }

      throw error;
    }
  });
}
