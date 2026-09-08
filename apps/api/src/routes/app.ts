import type { VendorCategory } from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { optionalUser, optionalUserId } from '../auth/plugin';
import { recommendVendors } from './recommendations';
import type { AppContext } from '../context';
import { notificationSummary } from '../notify';

/**
 * 홈 부팅 한 번에.
 *
 * 홈은 회원 · 알림 · 많이 확인된 곳 · 담아둔 후보 · 웨딩픽 추천을 원래 다섯 번
 * 따로 물었다. 뒤 셋 중 일부는 앞의 답에 진짜로 기댄다(웨딩픽 추천은 담아둔
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
/** 웨딩픽 추천에 세우는 곳의 수. 셋을 넘기면 한 줄에 들어가지 않는다. */
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
        ? injectJson<{ nextCategory: string | null; groups: { candidates: unknown[] }[] }>(
            `/v1/weddings/${member.weddingId}/candidates`
          )
        : Promise.resolve(null),
    ]);

    /*
     * 웨딩픽 추천 — TOP3와 같은 함수(지역 + 스타일 + 업체 안내 가격 · 실 제보가 붙는
     * 대로 가중치 상승). 업종은 담아둔 후보가 지목한 다음 업종, 없으면 준비 현황에서
     * 아직 안 정한 첫 업종. 이유 문장을 함께 내려 홈 카드가 «고른 스타일이랑 맞아요»를
     * 적는다.
     */
    /*
     * 업종은 담아둔 후보가 있을 때만 후보가 지목한 다음 업종을 따른다. 아무 데도 담아둔
     * 곳이 없으면(홈 0개 구간) recommendVendors의 기본 — 준비 현황에서 아직 안 정한
     * 첫 업종, 웨딩홀부터(SPEC §13.8 «웨딩홀부터 정해볼까요?») — 를 쓴다.
     */
    const picking = (candidates?.groups ?? []).some((group) => group.candidates.length > 0);
    const recommended = await recommendVendors(context, {
      userId: userId!,
      category: picking
        ? ((candidates?.nextCategory as VendorCategory | null | undefined) ?? undefined)
        : undefined,
      limit: PICK_COUNT,
    });
    let recommendations: unknown[] = recommended.items.map(({ reasonKeys: _keys, ...item }) => item);

    /*
     * 자격(실 제보 3건 · 업체 안내 · 스타일 일치)을 갖춘 곳이 하나도 없으면 실 제보
     * 많은 순으로 채운다 — 추천 자리가 비면 홈 골격이 무너진다(SPEC §13.8 «섹션 순서와
     * 개수는 바뀌지 않는다»). 이때는 이유 문장이 없고, 카드는 이유 줄을 접는다.
     */
    if (recommendations.length === 0) {
      recommendations = await injectJson<{ vendors: unknown[] }>(
        `/v1/vendors?sort=data&limit=${PICK_COUNT}&category=${recommended.category}`
      ).then((body) => body?.vendors ?? []);
    }

    return { member, notifications, popularVendors, candidates, recommendations };
  });
}
