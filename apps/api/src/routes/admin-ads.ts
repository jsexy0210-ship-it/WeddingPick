import { ADVERTISING_MUST_NOT_AFFECT, PROTECTED_SURFACE_LABEL } from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { addPlacement, listPlacements, removePlacement } from '../ad-admin';
import { currentUserId, requireOperator } from '../auth/plugin';
import type { AppContext } from '../context';
import { NotAnOperator } from '../decisions';
import { ApiError, forbidden } from '../errors';

const addPlacementRequestSchema = z.object({
  vendorId: z.string(),
  surface: z.string(),
  tier: z.string(),
  category: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  startsOn: z.string(),
  endsOn: z.string(),
});

/**
 * 광고 지면 API. `ad-admin.ts`의 조회·잡기·내리기를 그대로 연다. 최종통합정책
 * v2.0 E장 — 광고를 넣어도 검색 순위는 달라지지 않는다.
 */
export function registerAdminAdRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireOperator(context) };

  app.get('/v1/admin/ads/firewall', auth, async () => ({
    protectedSurfaces: ADVERTISING_MUST_NOT_AFFECT.map((surface) => ({
      surface,
      label: PROTECTED_SURFACE_LABEL[surface],
    })),
  }));

  app.get('/v1/admin/ads/placements', auth, async () => {
    const placements = await listPlacements(context.pool);

    return {
      placements: placements.map((row) => ({
        id: row.id,
        vendorName: row.vendorName,
        surface: row.surface,
        category: row.category,
        region: row.region,
        startsOn: row.startsOn.toISOString().slice(0, 10),
        endsOn: row.endsOn.toISOString().slice(0, 10),
        live: row.live,
      })),
    };
  });

  app.post('/v1/admin/ads/placements', auth, async (request, reply) => {
    const by = currentUserId(request);
    const body = addPlacementRequestSchema.parse(request.body);

    const id = await runAsOperator(() =>
      addPlacement(
        context.pool,
        {
          vendorId: body.vendorId,
          surface: body.surface,
          tier: body.tier,
          category: body.category ?? null,
          region: body.region ?? null,
          startsOn: body.startsOn,
          endsOn: body.endsOn,
        },
        by
      )
    );

    return reply.status(201).send({ id });
  });

  app.delete<{ Params: { id: string } }>(
    '/v1/admin/ads/placements/:id',
    auth,
    async (request) => {
      const by = currentUserId(request);
      const removed = await runAsOperator(() =>
        removePlacement(context.pool, request.params.id, by)
      );

      if (!removed) throw new ApiError('not_found', '없는 자리입니다.');

      return { ok: true };
    }
  );
}

/**
 * `ad-admin.ts`의 동작들은 잘못된 상태를 평범한 `Error`로 던진다(CLI에서는
 * 메시지만 찍으면 됐다). HTTP에서는 이걸 400으로 바꾼다.
 */
async function runAsOperator<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof NotAnOperator) throw forbidden();
    if (error instanceof ApiError) throw error;
    if (error instanceof Error) throw new ApiError('invalid_request', error.message);

    throw error;
  }
}
