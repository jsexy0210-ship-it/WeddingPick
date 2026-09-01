import {
  completeSetupRequestSchema,
  createWeddingRequestSchema,
  displayNameRequestSchema,
} from '@weddingpick/api-contract';
import {
  MEMBER_TIER_LABEL,
  WEDDING_DATE_HINT,
  checkDisplayName,
  isSelectableWeddingDate,
  tierOf,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { assertWeddingAccess } from '../access';
import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { withTransaction } from '../db';
import { ApiError, notFound } from '../errors';

type WeddingRow = {
  id: string;
  wedding_date: string | null;
  owner_user_id: string;
  partner_user_id: string | null;
  created_at: Date;
  partner_joined_at: Date | null;
};

async function loadDetail(context: AppContext, weddingId: string, viewerId: string) {
  const { rows } = await context.pool.query<WeddingRow>(
    `SELECT id, wedding_date, owner_user_id, partner_user_id, created_at, partner_joined_at
     FROM structured.weddings WHERE id = $1`,
    [weddingId]
  );

  const row = rows[0];

  if (!row) {
    throw notFound('웨딩');
  }

  /*
   * 배우자의 개인정보는 내려보내지 않는다. 이용약관 제5조.
   *
   * 누가 누구인지는 이름이 아니라 isMe로 구분한다 — 상대의 이름을 보여주려면 그 사람의
   * 개인정보를 꺼내야 한다.
   */
  const members: { role: 'owner' | 'partner'; joinedAt: string; isMe: boolean }[] = [
    {
      role: 'owner',
      joinedAt: row.created_at.toISOString(),
      isMe: row.owner_user_id === viewerId,
    },
  ];

  if (row.partner_user_id) {
    members.push({
      role: 'partner',
      joinedAt: (row.partner_joined_at ?? row.created_at).toISOString(),
      isMe: row.partner_user_id === viewerId,
    });
  }

  return {
    id: row.id,
    weddingDate: row.wedding_date,
    partnerLinked: row.partner_user_id !== null,
    createdAt: row.created_at.toISOString(),
    members,
  };
}

/**
 * 지금 로그인한 사람의 상태 한 벌.
 *
 * `/v1/me`와 `/v1/me/setup`이 **같은 함수를 쓴다**. 계약이 두 경로에 같은 모양을
 * 적어둔 이상, 만드는 곳도 하나여야 한다 — 따로 적으면 한쪽이 필드를 빠뜨려도
 * 서버는 조용하고, 앱이 응답을 검증하다 처음 깨진다.
 */
async function loadCurrentUser(context: AppContext, userId: string) {
  const { rows } = await context.pool.query<{
    id: string | null;
    wedding_date: Date | null;
    region: string | null;
    budget_amount: string | null;
    display_name: string | null;
    spouse_linked: boolean;
    has_payment_proof: boolean;
    has_pick: boolean;
    has_compared: boolean;
  }>(
    `SELECT
       w.id,
       w.wedding_date,
       w.region,
       w.budget_amount,
       u.display_name,
       coalesce(w.owner_user_id IS NOT NULL AND w.partner_user_id IS NOT NULL, false)
         AS spouse_linked,
       EXISTS (
         SELECT 1 FROM structured.usable_payment_proofs p WHERE p.reporter_user_id = u.id
       ) AS has_payment_proof,
       EXISTS (
         SELECT 1 FROM structured.vendor_candidates c WHERE c.wedding_id = w.id
       ) AS has_pick,
       /* 비교할 수 있는 상태가 아니라 실제로 비교한 사실이다(0044). */
       EXISTS (
         SELECT 1 FROM structured.comparisons x WHERE x.wedding_id = w.id
       ) AS has_compared
     FROM structured.users u
     LEFT JOIN LATERAL (
       SELECT id, wedding_date, region, budget_amount, owner_user_id, partner_user_id
       FROM structured.weddings
       WHERE owner_user_id = u.id OR partner_user_id = u.id
       ORDER BY created_at LIMIT 1
     ) w ON true
     WHERE u.id = $1`,
    [userId]
  );

  const row = rows[0];
  const weddingDate = row?.wedding_date ? row.wedding_date.toISOString().slice(0, 10) : null;
  const displayName = row?.display_name ?? null;
  const region = row?.region ?? null;
  /*
   * bigint는 드라이버가 문자열로 준다. 결혼 예산은 자바스크립트 정수 한계보다
   * 한참 작아서 수로 바꿔도 값이 흐려지지 않는다 — 계약도 수로 적혀 있다.
   */
  const budgetAmount =
    row?.budget_amount === null || row?.budget_amount === undefined
      ? null
      : Number(row.budget_amount);

  const facts = {
    // 이 함수를 부르는 두 경로가 모두 로그인을 요구한다. 여기까지 왔으면 로그인한 사람이다.
    loggedIn: true,
    spouseLinked: row?.spouse_linked ?? false,
    hasPaymentProof: row?.has_payment_proof ?? false,
    /* 최소 온보딩이 받는 것은 예식일과 지역 둘이다(v3.10 §3). 둘 다 있어야 설정한 것이다. */
    weddingSet: weddingDate !== null && region !== null,
    hasPick: row?.has_pick ?? false,
    hasCompared: row?.has_compared ?? false,
  };

  const tier = tierOf(facts);

  return {
    userId,
    weddingId: row?.id ?? null,
    displayName,
    weddingDate,
    region,
    budgetAmount,
    /*
     * 앱이 이 값 하나로 첫 화면을 정한다. 두 값을 따로 보고 판단하게 두면
     * 어느 화면은 날짜만 보고 어느 화면은 지역만 보게 된다.
     *
     * **이름은 여기 들어가지 않는다.** v3.10 §3이 닉네임을 최초 필수입력에서
     * 뺐다 — 이름이 없다고 첫 화면에 다시 붙잡아두면 그게 강제 가입이다.
     */
    setupComplete: facts.weddingSet,
    spouseLinked: facts.spouseLinked,
    hasPaymentProof: facts.hasPaymentProof,
    hasPick: facts.hasPick,
    hasCompared: facts.hasCompared,
    /*
     * 등급은 서버가 정한다. 앱이 세 값으로 계산하게 두면 화면마다 조건을 다시
     * 적게 되고, 언젠가 한 곳이 어긋나 같은 사람이 화면에 따라 다른 등급으로 보인다.
     */
    tier,
    tierLabel: MEMBER_TIER_LABEL[tier],
  };
}

export function registerWeddingRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  app.get('/v1/me', auth, async (request) =>
    loadCurrentUser(context, currentUserId(request))
  );

  /**
   * 최소 온보딩. 통합정책 v3.10 §3 — 받는 것은 **예식일과 지역**이다.
   *
   * 이름은 받지 않는다. v3.10이 닉네임을 최초 필수입력에서 뺐다. 부를 이름은
   * `/v1/me/display-name`으로 나중에 정한다.
   *
   * 예식일과 지역을 한 번에 받는다. 따로 받으면 날짜만 넣고 나간 사람이 생기고,
   * 그 사람에게 보여줄 수 있는 것은 전국 평균뿐이다.
   *
   * 총예산은 선택이다. 넘기지 않으면 **건드리지 않는다** — `아직 모르겠어요`를
   * 고른 것과 이 화면을 다시 열지 않은 것이 같은 결과가 되면 안 된다. 명시적인
   * null만 "안 정함"으로 되돌린다.
   *
   * 웨딩이 없으면 여기서 만든다. "먼저 웨딩을 만드세요"라고 할 자리가 아니다 —
   * 사용자에게 웨딩은 만드는 것이 아니라 이미 있는 것이다.
   */
  app.post('/v1/me/setup', auth, async (request) => {
    const userId = currentUserId(request);
    const body = completeSetupRequestSchema.parse(request.body);

    // 결혼식은 미래다. 오늘과 과거는 고를 수 없다(핸드오프 3번).
    if (!isSelectableWeddingDate(body.weddingDate)) {
      throw new ApiError('invalid_request', WEDDING_DATE_HINT);
    }

    const region = body.region.trim();
    /* 예산을 아예 안 보냈는가. null을 보낸 것(`아직 모르겠어요`)과 구분해야 한다. */
    const budgetGiven = 'budgetAmount' in body;
    const budget = body.budgetAmount ?? null;

    await withTransaction(context.pool, async (client) => {
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM structured.weddings
         WHERE owner_user_id = $1 OR partner_user_id = $1
         ORDER BY created_at LIMIT 1`,
        [userId]
      );

      const weddingId = existing.rows[0]?.id;

      if (weddingId) {
        await client.query(
          `UPDATE structured.weddings
           SET wedding_date = $2,
               region = $3,
               budget_amount = CASE WHEN $4::boolean THEN $5::bigint ELSE budget_amount END
           WHERE id = $1`,
          [weddingId, body.weddingDate, region, budgetGiven, budget]
        );

        return;
      }

      await client.query(
        `INSERT INTO structured.weddings (owner_user_id, wedding_date, region, budget_amount)
         VALUES ($1, $2, $3, $4::bigint)`,
        [userId, body.weddingDate, region, budget]
      );
    });

    /*
     * 저장한 뒤 상태를 다시 읽어 돌려준다. 계약이 이 경로의 응답도 `/v1/me`와 같은
     * 모양이라고 적어뒀다 — 여기서 몇 칸만 손으로 채우면 앱이 검증에서 깨진다.
     */
    return loadCurrentUser(context, userId);
  });

  /**
   * 부를 이름. MY에서 정한다.
   *
   * 최소 온보딩에서 뺀 값이라 이 경로가 없으면 이름을 정할 방법이 아예 없어진다.
   * 비우는 것도 허용한다 — 한 번 적었다고 영영 못 지우게 할 이유가 없다.
   */
  app.post('/v1/me/display-name', auth, async (request) => {
    const userId = currentUserId(request);
    const body = displayNameRequestSchema.parse(request.body);
    const displayName = body.displayName === null ? null : body.displayName.trim();

    if (displayName !== null) {
      const check = checkDisplayName(displayName);

      if (!check.ok) {
        throw new ApiError('invalid_request', check.reason);
      }
    }

    await context.pool.query('UPDATE structured.users SET display_name = $2 WHERE id = $1', [
      userId,
      displayName,
    ]);

    return { displayName };
  });

  app.post('/v1/weddings', auth, async (request, reply) => {
    const userId = currentUserId(request);
    const body = createWeddingRequestSchema.parse(request.body ?? {});

    const { rows } = await context.pool.query<{ id: string }>(
      'INSERT INTO structured.weddings (owner_user_id, wedding_date) VALUES ($1, $2) RETURNING id',
      [userId, body.weddingDate ?? null]
    );

    return reply.status(201).send(await loadDetail(context, rows[0]!.id, userId));
  });

  app.get<{ Params: { weddingId: string } }>('/v1/weddings/:weddingId', auth, async (request) => {
    const userId = currentUserId(request);
    await assertWeddingAccess(context.pool, request.params.weddingId, userId);

    return loadDetail(context, request.params.weddingId, userId);
  });
}
