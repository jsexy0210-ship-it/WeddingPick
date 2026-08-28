import { createWeddingRequestSchema } from '@weddingpick/api-contract';
import type { FastifyInstance } from 'fastify';

import { assertWeddingAccess } from '../access';
import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { notFound } from '../errors';

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

    const { rows } = await context.pool.query<{ id: string }>(
      `SELECT id FROM structured.weddings
       WHERE owner_user_id = $1 OR partner_user_id = $1
       ORDER BY created_at LIMIT 1`,
      [userId]
    );

    return { userId, weddingId: rows[0]?.id ?? null };
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
