import { createHash, randomBytes } from 'node:crypto';

import { acceptInviteRequestSchema } from '@weddingpick/api-contract';
import {
  INVITE_STATE_MESSAGE,
  INVITE_TTL_HOURS,
  PARTNER_NOT_SHARED,
  PARTNER_SHARED,
  inviteState,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { assertWeddingAccess } from '../access';
import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { withTransaction } from '../db';
import { ApiError, notFound } from '../errors';
import { notify } from '../notify';

/** 코드 원문은 저장하지 않는다. DB가 유출돼도 그것만으로 남의 웨딩에 들어갈 수 없다. */
function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export function registerWeddingInviteRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  /**
   * A-18 배우자 초대 만들기.
   *
   * 한 웨딩에 살아 있는 초대는 하나다(부분 유니크 색인). 새로 만들면 이전 것을 취소한다 —
   * 여러 장을 뿌려두면 취소한 줄 알았던 링크가 살아 있게 된다.
   */
  app.post<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/invites',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      const { weddingId } = request.params;

      await assertWeddingAccess(context.pool, weddingId, userId);

      const { rows } = await context.pool.query<{ partner_user_id: string | null }>(
        'SELECT partner_user_id FROM structured.weddings WHERE id = $1',
        [weddingId]
      );

      if (rows[0]?.partner_user_id) {
        throw new ApiError('conflict', '이미 배우자가 연결되어 있습니다.');
      }

      const code = randomBytes(24).toString('base64url');
      const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

      const created = await withTransaction(context.pool, async (client) => {
        await client.query(
          `UPDATE structured.wedding_invites
           SET status = 'revoked', revoked_at = now()
           WHERE wedding_id = $1 AND status = 'pending'`,
          [weddingId]
        );

        const inserted = await client.query<{ id: string }>(
          `INSERT INTO structured.wedding_invites (wedding_id, invited_by, code_hash, expires_at)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [weddingId, userId, hashCode(code), expiresAt]
        );

        return inserted.rows[0]!;
      });

      return reply.status(201).send({
        inviteId: created.id,
        // 여기서 한 번만 내려간다. 서버는 해시만 들고 있어 다시 보여줄 수 없다.
        code,
        expiresAt: expiresAt.toISOString(),
        shared: [...PARTNER_SHARED],
        notShared: [...PARTNER_NOT_SHARED],
      });
    }
  );

  /** 지금 살아 있는 초대. 코드는 들어 있지 않다 — 다시 보여줄 수 없다. */
  app.get<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/invites',
    auth,
    async (request) => {
      const userId = currentUserId(request);
      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const { rows } = await context.pool.query<{
        id: string;
        expires_at: Date;
        created_at: Date;
      }>(
        `SELECT id, expires_at, created_at FROM structured.usable_wedding_invites
         WHERE wedding_id = $1`,
        [request.params.weddingId]
      );

      const invite = rows[0];

      return {
        invite: invite
          ? {
              inviteId: invite.id,
              expiresAt: invite.expires_at.toISOString(),
              createdAt: invite.created_at.toISOString(),
            }
          : null,
      };
    }
  );

  app.delete<{ Params: { weddingId: string; inviteId: string } }>(
    '/v1/weddings/:weddingId/invites/:inviteId',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      await context.pool.query(
        `UPDATE structured.wedding_invites
         SET status = 'revoked', revoked_at = now()
         WHERE id = $1 AND wedding_id = $2 AND status = 'pending'`,
        [request.params.inviteId, request.params.weddingId]
      );

      return reply.status(204).send();
    }
  );

  /**
   * 받아들이기 전에 무엇에 동의하는지 본다.
   *
   * 초대한 사람이 누구인지는 알려주지 않는다 — 이름을 보여주려면 그 사람의 개인정보를
   * 꺼내야 하고, 링크를 가진 사람이 늘 배우자인 것도 아니다.
   */
  app.post('/v1/wedding-invites/preview', auth, async (request) => {
    const { code } = acceptInviteRequestSchema.parse(request.body);

    const { rows } = await context.pool.query<{
      status: 'pending' | 'accepted' | 'revoked';
      expires_at: Date;
      partner_user_id: string | null;
    }>(
      `SELECT i.status, i.expires_at, w.partner_user_id
       FROM structured.wedding_invites i
       JOIN structured.weddings w ON w.id = i.wedding_id
       WHERE i.code_hash = $1`,
      [hashCode(code)]
    );

    const invite = rows[0];

    if (!invite) {
      return {
        usable: false,
        reason: 'not_found',
        message: '이 초대를 찾을 수 없습니다. 링크를 다시 확인해주세요.',
      };
    }

    const state = inviteState({
      status: invite.status,
      expiresAt: invite.expires_at.toISOString(),
      partnerAlreadyLinked: invite.partner_user_id !== null,
    });

    if (state !== 'usable') {
      return { usable: false, reason: state, message: INVITE_STATE_MESSAGE[state] };
    }

    return {
      usable: true,
      expiresAt: invite.expires_at.toISOString(),
      shared: [...PARTNER_SHARED],
      notShared: [...PARTNER_NOT_SHARED],
    };
  });

  /**
   * 초대 받아들이기. 여기서 연결이 이뤄진다.
   *
   * 조건은 usable_wedding_invites 뷰 안에 있고, 갱신은 그 조건을 다시 확인하며 한 번에
   * 일어난다 — 두 사람이 동시에 눌러도 한 명만 들어온다.
   */
  app.post('/v1/wedding-invites/accept', auth, async (request) => {
    const userId = currentUserId(request);
    const { code } = acceptInviteRequestSchema.parse(request.body);

    return withTransaction(context.pool, async (client) => {
      const { rows } = await client.query<{ id: string; wedding_id: string; invited_by: string }>(
        `SELECT id, wedding_id, invited_by FROM structured.usable_wedding_invites
         WHERE code_hash = $1 FOR UPDATE`,
        [hashCode(code)]
      );

      const invite = rows[0];

      if (!invite) {
        throw new ApiError('invalid_request', '지금은 쓸 수 없는 초대입니다.');
      }

      if (invite.invited_by === userId) {
        // 스키마의 partner_is_not_owner도 막지만, 이유를 말해주는 편이 낫다.
        throw new ApiError('invalid_request', '자기 자신을 배우자로 연결할 수 없습니다.');
      }

      const existing = await client.query(
        `SELECT 1 FROM structured.weddings
         WHERE owner_user_id = $1 OR partner_user_id = $1`,
        [userId]
      );

      if (existing.rowCount && existing.rowCount > 0) {
        throw new ApiError(
          'conflict',
          '이미 참여 중인 웨딩이 있습니다. 한 계정은 한 웨딩에만 속합니다.'
        );
      }

      const linked = await client.query(
        `UPDATE structured.weddings SET partner_user_id = $2
         WHERE id = $1 AND partner_user_id IS NULL`,
        [invite.wedding_id, userId]
      );

      if (linked.rowCount === 0) {
        throw new ApiError('conflict', '이미 배우자가 연결되어 있습니다.');
      }

      await client.query(
        `UPDATE structured.wedding_invites
         SET status = 'accepted', accepted_at = now(), accepted_by = $2
         WHERE id = $1`,
        [invite.id, userId]
      );

      /*
       * 초대한 사람에게 알린다. 초대장을 보낸 쪽은 상대가 눌렀는지 알 길이 없다 —
       * 앱을 다시 열어 배우자 화면에 들어가 보는 수밖에 없다.
       *
       * 같은 트랜잭션 안에서 남긴다. 연결은 됐는데 알림만 빠지는 상태를 만들지
       * 않기 위해서다.
       */
      await notify(client, {
        userId: invite.invited_by,
        kind: 'partner',
        title: '배우자가 연결됐어요',
        body: '이제 Pick한 곳과 지출내역을 함께 보실 수 있어요',
        targetId: invite.wedding_id,
      });

      return { weddingId: invite.wedding_id };
    });
  });

  /**
   * 연결 끊기. 어느 쪽이든 끊을 수 있다.
   *
   * 한쪽이 붙잡아둘 수 있으면 그건 연결이 아니라 구속이다.
   */
  app.delete<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/partner',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      const { weddingId } = request.params;

      await assertWeddingAccess(context.pool, weddingId, userId);

      const { rowCount } = await context.pool.query(
        // partner_joined_at은 트리거가 함께 비운다.
        'UPDATE structured.weddings SET partner_user_id = NULL WHERE id = $1 AND partner_user_id IS NOT NULL',
        [weddingId]
      );

      if (rowCount === 0) {
        throw notFound('연결된 배우자');
      }

      return reply.status(204).send();
    }
  );
}
