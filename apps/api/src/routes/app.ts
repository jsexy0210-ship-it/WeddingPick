import type { FastifyInstance } from 'fastify';

import { optionalUser, optionalUserId } from '../auth/plugin';
import type { AppContext } from '../context';
import { notificationSummary } from '../notify';

/**
 * 홈 부팅 한 번에.
 *
 * 홈은 회원 · 알림 · 많이 확인된 곳 · 담아둔 후보 · 오늘의 Pick을 원래 다섯 번
 * 따로 물었다. 뒤 셋 중 일부는 앞의 답에 진짜로 기댄다(오늘의 Pick은 담아둔
 * 후보가 지목한 업종을 알아야 나온다) — 그래서 순서를 완전히는 못 없앤다. 다만
 * 그 순서를 **기기와 서버 사이**가 아니라 서버 안에서 오가게 하면, 인터넷을
 * 왕복하는 횟수가 다섯에서 하나로 준다.
 *
 * 로직을 다시 적지 않는다. `/v1/vendors`·`/v1/me`·`/v1/weddings/:id/candidates`는
 * 이미 있고 각자 자기 자리에서 계속 불릴 이유가 있다(검색·설정 화면 등) —
 * 여기서는 `app.inject`로 그 라우트를 그대로, 실제 네트워크 없이 안에서 부른다.
 * 인증 헤더도 그대로 넘겨야 각 라우트가 로그인 여부를 스스로 판단한다.
 */
/** 많이 확인된 곳에 세우는 줄 수. 홈 화면(apps/mobile (tabs)/index.tsx)과 같은 수다. */
const POPULAR_COUNT = 4;
/** 오늘의 Pick에 세우는 곳의 수. 셋을 넘기면 한 줄에 들어가지 않는다. */
const PICK_COUNT = 3;

export function registerAppRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: optionalUser(context) };

  app.get('/v1/app/bootstrap', auth, async (request) => {
    const userId = optionalUserId(request);
    const authHeader = request.headers.authorization;
    const headers = authHeader ? { authorization: authHeader } : {};

    async function injectJson<T>(url: string): Promise<T | null> {
      const response = await app.inject({ method: 'GET', url, headers });

      return response.statusCode === 200 ? (response.json() as T) : null;
    }

    const [popularVendors, member] = await Promise.all([
      injectJson<{ vendors: unknown[] }>(`/v1/vendors?sort=data&limit=${POPULAR_COUNT}`).then(
        (body) => body?.vendors ?? []
      ),
      userId ? injectJson<{ weddingId: string | null }>('/v1/me') : Promise.resolve(null),
    ]);

    if (!member) {
      return {
        member: null,
        notifications: null,
        popularVendors,
        candidates: null,
        recommendations: [],
      };
    }

    const [notifications, candidates] = await Promise.all([
      notificationSummary(context.pool, userId!),
      member.weddingId
        ? injectJson<{ nextCategory: string | null }>(
            `/v1/weddings/${member.weddingId}/candidates`
          )
        : Promise.resolve(null),
    ]);

    const recommendations = candidates?.nextCategory
      ? await injectJson<{ vendors: unknown[] }>(
          `/v1/vendors?sort=data&limit=${PICK_COUNT}&category=${candidates.nextCategory}`
        ).then((body) => body?.vendors ?? [])
      : [];

    return { member, notifications, popularVendors, candidates, recommendations };
  });
}
