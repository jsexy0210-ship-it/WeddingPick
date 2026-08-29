import {
  completeSetupRequestSchema,
  createWeddingRequestSchema,
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

export function registerWeddingRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  app.get('/v1/me', auth, async (request) => {
    const userId = currentUserId(request);

    const { rows } = await context.pool.query<{
      id: string | null;
      wedding_date: Date | null;
      display_name: string | null;
      spouse_linked: boolean;
      has_payment_proof: boolean;
    }>(
      `SELECT
         w.id,
         w.wedding_date,
         u.display_name,
         coalesce(w.owner_user_id IS NOT NULL AND w.partner_user_id IS NOT NULL, false)
           AS spouse_linked,
         EXISTS (
           SELECT 1 FROM structured.usable_payment_proofs p WHERE p.reporter_user_id = u.id
         ) AS has_payment_proof
       FROM structured.users u
       LEFT JOIN LATERAL (
         SELECT id, wedding_date, owner_user_id, partner_user_id
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

    const facts = {
      // 이 경로는 로그인이 필요하므로 여기까지 온 사람은 로그인한 사람이다.
      loggedIn: true,
      spouseLinked: row?.spouse_linked ?? false,
      hasPaymentProof: row?.has_payment_proof ?? false,
    };

    const tier = tierOf(facts);

    return {
      userId,
      weddingId: row?.id ?? null,
      displayName,
      weddingDate,
      /*
       * 앱이 이 값 하나로 첫 화면을 정한다. 두 값을 따로 보고 판단하게 두면
       * 어느 화면은 이름만 보고 어느 화면은 날짜만 보게 된다.
       */
      setupComplete: displayName !== null && weddingDate !== null,
      spouseLinked: facts.spouseLinked,
      hasPaymentProof: facts.hasPaymentProof,
      /*
       * 등급은 서버가 정한다. 앱이 세 값으로 계산하게 두면 화면마다 조건을 다시
       * 적게 되고, 언젠가 한 곳이 어긋나 같은 사람이 화면에 따라 다른 등급으로 보인다.
       */
      tier,
      tierLabel: MEMBER_TIER_LABEL[tier],
    };
  });

  /**
   * 이름·예식일 등록. 핸드오프 2번 — **스킵할 수 없는 화면**이다.
   *
   * 둘을 한 번에 받는다. 따로 받으면 이름만 넣고 나간 사람이 생기고, 그 사람의
   * 홈은 이름은 부르는데 D-Day가 없는 반쪽이 된다.
   *
   * 웨딩이 없으면 여기서 만든다. "먼저 웨딩을 만드세요"라고 할 자리가 아니다 —
   * 사용자에게 웨딩은 만드는 것이 아니라 이미 있는 것이다.
   */
  app.post('/v1/me/setup', auth, async (request) => {
    const userId = currentUserId(request);
    const body = completeSetupRequestSchema.parse(request.body);

    const check = checkDisplayName(body.displayName);

    if (!check.ok) {
      throw new ApiError('invalid_request', check.reason);
    }

    // 결혼식은 미래다. 오늘과 과거는 고를 수 없다(핸드오프 3번).
    if (!isSelectableWeddingDate(body.weddingDate)) {
      throw new ApiError('invalid_request', WEDDING_DATE_HINT);
    }

    return withTransaction(context.pool, async (client) => {
      await client.query('UPDATE structured.users SET display_name = $2 WHERE id = $1', [
        userId,
        body.displayName.trim(),
      ]);

      const existing = await client.query<{ id: string }>(
        `SELECT id FROM structured.weddings
         WHERE owner_user_id = $1 OR partner_user_id = $1
         ORDER BY created_at LIMIT 1`,
        [userId]
      );

      const weddingId = existing.rows[0]?.id;

      if (weddingId) {
        await client.query('UPDATE structured.weddings SET wedding_date = $2 WHERE id = $1', [
          weddingId,
          body.weddingDate,
        ]);

        return { userId, weddingId, displayName: body.displayName.trim(), weddingDate: body.weddingDate, setupComplete: true };
      }

      const created = await client.query<{ id: string }>(
        'INSERT INTO structured.weddings (owner_user_id, wedding_date) VALUES ($1, $2) RETURNING id',
        [userId, body.weddingDate]
      );

      return {
        userId,
        weddingId: created.rows[0]!.id,
        displayName: body.displayName.trim(),
        weddingDate: body.weddingDate,
        setupComplete: true,
      };
    });
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
