import { WEDDING_FEED_STAGE_ORDER } from '@weddingpick/api-contract';
import type { VendorCategory } from '@weddingpick/domain';
import { WEDDING_FEED_TARGET_PUBLISHED } from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { optionalUser, optionalUserId } from '../auth/plugin';
import { recommendVendors } from './recommendations';
import type { AppContext } from '../context';
import { notificationSummary } from '../notify';
import { loadPreparationStage } from '../preparation-stage';
import * as weddingFeed from '../wedding-feed';

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

/**
 * 히어로가 쓰는 두 가지 — 예산과 배우자 초대.
 *
 * **예산 구간만 고른 사람을 예산 미설정으로 읽지 않는다.** 온보딩의 «4,000만원 이상» ·
 * «아직 모르겠어요»는 상한이 없어 숫자 예산이 서지 않지만 이미 답한 사람이다. 그 사람에게
 * «예산을 정해볼까요?»를 다시 묻는 것이 `features/home/priority.ts`가 주석으로 적어둔
 * 바로 그 함정이다.
 *
 * 초대는 «살아 있는 초대가 있는가»만 본다 — 코드도 누구에게 보냈는지도 여기서는 필요 없다.
 */
async function heroFacts(
  context: AppContext,
  weddingId: string
): Promise<{
  budget: { total: number; spent: number; remaining: number } | null;
  bracketAnswered: boolean;
  partnerInvitePending: boolean;
}> {
  const [wedding, spent, invite] = await Promise.all([
    context.pool.query<{ budget_amount: string | null; budget_bracket: string | null; partner_user_id: string | null }>(
      `SELECT budget_amount, budget_bracket::text AS budget_bracket, partner_user_id
       FROM structured.weddings WHERE id = $1`,
      [weddingId]
    ),
    /* 낸 돈만 센다 — 예정 지출을 «썼다»고 적으면 사용률이 실제보다 앞선다. */
    context.pool.query<{ total: string | null }>(
      `SELECT sum(amount) AS total FROM structured.wedding_expenses
       WHERE wedding_id = $1 AND status = 'paid'`,
      [weddingId]
    ),
    context.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM structured.wedding_invites
         WHERE wedding_id = $1 AND status = 'pending' AND revoked_at IS NULL AND expires_at > now()
       ) AS exists`,
      [weddingId]
    ),
  ]);

  const row = wedding.rows[0];
  const total = row?.budget_amount === null || row?.budget_amount === undefined ? null : Number(row.budget_amount);
  const paid = Number(spent.rows[0]?.total ?? 0);

  return {
    budget:
      total !== null && Number.isFinite(total) && total > 0
        ? { total, spent: paid, remaining: total - paid }
        : null,
    bracketAnswered: (row?.budget_bracket ?? null) !== null,
    /* 이미 연결됐으면 기다리는 초대가 아니다 — 살아 있는 초대가 남아 있어도 그렇다. */
    partnerInvitePending: (row?.partner_user_id ?? null) === null && invite.rows[0]?.exists === true,
  };
}

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

    /*
     * 첫 묶음에는 «앞의 답을 기다릴 이유가 없는 것»을 전부 넣는다. 알림 요약은
     * 회원의 웨딩이 아니라 userId만 있으면 세므로, 예전처럼 `/v1/me`가 돌아온
     * 뒤에 부르면 그만큼 늦어질 뿐이었다(2026-09-09).
     */
    const [popularVendors, member, notifications] = await Promise.all([
      injectJson<{ vendors: unknown[] }>(`/v1/vendors?sort=data&limit=${POPULAR_COUNT}`).then(
        (body) => body?.vendors ?? []
      ),
      userId ? injectJson<{ weddingId: string | null }>('/v1/me') : Promise.resolve(null),
      userId ? notificationSummary(context.pool, userId) : Promise.resolve(null),
    ]);

    if (!member) {
      return {
        member: null,
        notifications: null,
        popularVendors,
        candidates: null,
        recommendations: [],
        budget: null,
        bracketAnswered: false,
        partnerInvitePending: false,
      };
    }

    const candidates = member.weddingId
      ? await injectJson<{ nextCategory: string | null; groups: { candidates: unknown[] }[] }>(
          `/v1/weddings/${member.weddingId}/candidates`
        )
      : null;

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

    /*
     * 히어로가 적는 예산 한 줄과 초대 상태. 둘 다 작은 값인데 각자 왕복을 타면 홈이 두 번 더
     * 기다린다 — 여기서 같이 읽는다. 지출 화면은 계속 `/v1/weddings/:id/expenses`를 쓴다.
     */
    const hero = member.weddingId
      ? await heroFacts(context, member.weddingId)
      : { budget: null, bracketAnswered: false, partnerInvitePending: false };

    return { member, notifications, popularVendors, candidates, recommendations, ...hero };
  });

  /*
   * 웨딩피드 — 홈 아래쪽 읽을거리. 공개된 글만 나간다. 로그인 여부와 무관해서
   * 홈은 이 자리를 `/v1/app/bootstrap`과 나란히, 기다리지 않고 부른다.
   */
  /*
   * `order=stage`(홈 「웨딩 준비 팁」)면 로그인한 사람의 준비 단계에 맞춰 순서를 바꾼다 —
   * 2026-09-26 대표 오더. 그때만 토큰을 본다(`optionalUser` — 틀린 토큰은 401). 라운지처럼
   * 순서를 안 묻는 목록은 예전처럼 누구에게나 같은 목록이고 토큰을 보지 않는다.
   */
  const stageAuth = optionalUser(context);

  app.get<{ Querystring: { limit?: string; order?: string } }>(
    '/v1/wedding-feed',
    {
      preHandler: async (request, reply) => {
        if (request.query.order === WEDDING_FEED_STAGE_ORDER) await stageAuth(request, reply);
      },
    },
    async (request) => {
      const limit = Number(request.query.limit ?? WEDDING_FEED_TARGET_PUBLISHED);
      const userId = request.query.order === WEDDING_FEED_STAGE_ORDER ? optionalUserId(request) : null;
      const stage = userId === null ? null : await loadPreparationStage(context.pool, userId);

      return weddingFeed.listPublished(
        context.pool,
        context.storage,
        Number.isFinite(limit) && limit > 0 ? limit : WEDDING_FEED_TARGET_PUBLISHED,
        stage
      );
    }
  );

  /*
   * 글 하나 — 카드를 눌러 들어간 자리(`(tabs)/(home)/feed/[id].tsx`).
   *
   * 목록과 같은 조건(공개된 것만)이라 목록에 없는 글은 주소로도 안 열린다.
   * 본문은 여기서만 나간다 — 목록에 실으면 읽지도 않을 본문 여덟 편이 같이 온다.
   */
  app.get<{ Params: { id: string } }>('/v1/wedding-feed/:id', async (request) =>
    weddingFeed.getPublished(context.pool, context.storage, request.params.id)
  );
}
