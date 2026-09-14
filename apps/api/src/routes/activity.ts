import type { FastifyInstance } from 'fastify';

import { recordActivityRequestSchema } from '@weddingpick/api-contract';

import { recordActivity } from '../activity-ledger';
import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';

/**
 * 앱이 직접 보내는 활동 줄.
 *
 * **서버가 볼 수 없는 것만 받는다.** 업체 열람·검색·Pick은 서버가 이미 요청으로
 * 안다(`activity-hook.ts`) — 양쪽에서 받으면 한 사건이 두 줄이 된다.
 *
 * **받자마자 돌려준다.** 큐에 넣는 것이 전부라 DB를 기다리지 않는다. 앱도
 * 이 응답을 기다리지 않고 보낸다(`features/activity/ledger.ts`).
 */
export function registerActivityRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  app.post('/v1/activity/events', auth, async (request) => {
    const userId = currentUserId(request);
    const body = recordActivityRequestSchema.parse(request.body);

    for (const event of body.events) {
      recordActivity(context.pool, {
        userId,
        eventName: event.eventName,
        surface: event.surface,
        /*
         * 앱 시계는 틀릴 수 있다. **미래로 적힌 시각은 받은 시각으로 바꾼다** —
         * 아직 오지 않은 시각의 줄이 들어오면 집계 기간이 어긋나고, 그 줄은 어느
         * 주에도 들지 않거나 다음 주를 미리 채운다. 과거는 그대로 둔다: 오래
         * 꺼져 있던 앱이 밀린 줄을 올리는 것은 정상이다.
         */
        occurredAt: clampToNow(event.occurredAt),
        category: event.category ?? null,
        region: event.region ?? null,
        step: event.step ?? null,
        clientEventId: event.clientEventId,
      });
    }

    return { accepted: body.events.length };
  });
}

function clampToNow(occurredAt: string | undefined): Date {
  const now = new Date();

  if (!occurredAt) return now;

  const at = new Date(occurredAt);

  if (Number.isNaN(at.getTime())) return now;

  return at > now ? now : at;
}
