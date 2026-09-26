import { createHash, randomInt } from 'node:crypto';

import { acceptInviteRequestSchema } from '@weddingpick/api-contract';
import {
  INVITE_CODE_LENGTH,
  INVITE_CODE_SPACE,
  INVITE_STATE_MESSAGE,
  INVITE_TTL_HOURS,
  PARTNER_NOT_SHARED,
  PARTNER_SHARED,
  inviteState,
} from '@weddingpick/domain';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { assertWeddingAccess } from '../access';
import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { withTransaction } from '../db';
import { ApiError, notFound } from '../errors';
import { notify } from '../notify';
import { networkIdFor } from './admin-login';

/**
 * 코드 원문은 저장하지 않는다. 다만 4자리는 1만 가지뿐이라 해시만으로 원문이 숨지는
 * 않는다 — 막는 것은 72시간 기한과 아래 입력 실패 제한이다. 0439가 옛 코드를 가려낼 때
 * 이 규칙(UTF-8 SHA-256 · 소문자 16진수)을 SQL로 그대로 되풀이한다 — 바꾸면 함께 바꾼다.
 */
function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/**
 * 초대 코드 — 4자리 숫자(2026-09-26 대표 지시 「초대 코드 6자리 → 4자리」).
 * `randomInt`는 암호학적 난수다. 앞자리 0도 코드의 일부라 0을 채운다.
 */
export function generateInviteCode(): string {
  return randomInt(0, INVITE_CODE_SPACE).toString().padStart(INVITE_CODE_LENGTH, '0');
}

/** 대기 중인 초대와 겹치면 다시 뽑는다. 이 횟수 안에 못 뽑으면 잠시 뒤 다시 시도하게 한다. */
const CODE_DRAW_ATTEMPTS = 20;

/**
 * 코드 입력 실패 제한 — 4자리에서도 그대로 둔다(2026-09-26).
 *
 * 1만 가지는 맞혀 보기 쉽다. 15분 창에서 계정마다 5번, IP마다 20번 틀리면 그 창이
 * 끝날 때까지 받지 않는다. IP 한도가 더 넉넉한 것은 한 사무실 · 통신사 NAT 뒤의 여러
 * 사람이 같은 IP를 쓰기 때문이다. 틀린 것은 «그런 코드가 없다»뿐이다 — 기한이 지났거나
 * 취소된 코드는 맞힌 것이라 세지 않는다.
 */
export const INVITE_FAILURES_PER_USER = 5;
export const INVITE_FAILURES_PER_IP = 20;
/*
 * 한 계정이 72시간 기한 안에 넣어 볼 수 있는 것은 5 × 288창 = 1,440번이다
 * (`inviteGuessCeiling`) — 대기 중인 초대 하나를 그 안에 맞힐 확률 14.4%. 한 IP는
 * 20 × 288 = 5,760번까지라, IP 하나 뒤에서 계정을 여럿 돌려도 1만 가지를 다 훑지 못한다.
 * 4자리의 안전은 이 두 한도와 기한에 기댄다 — 늘리면 그만큼 약해진다.
 */
export const INVITE_ATTEMPT_WINDOW_MINUTES = 15;

function attemptKey(scope: 'user' | 'ip', id: string): string {
  return createHash('sha256').update(`invite-code\0${scope}\0${id}`).digest('hex');
}

function attemptKeys(request: FastifyRequest, userId: string) {
  return { user: attemptKey('user', userId), ip: attemptKey('ip', networkIdFor(request)) };
}

async function assertNotThrottled(context: AppContext, keys: { user: string; ip: string }): Promise<void> {
  await context.pool.query(
    `DELETE FROM structured.invite_code_attempts
      WHERE window_started_at <= now() - interval '15 minutes'`
  );

  const { rows } = await context.pool.query<{ attempt_key: string; failure_count: number }>(
    `SELECT attempt_key, failure_count FROM structured.invite_code_attempts
      WHERE attempt_key = ANY($1::text[])`,
    [[keys.user, keys.ip]]
  );
  const count = (key: string) => rows.find((row) => row.attempt_key === key)?.failure_count ?? 0;

  if (count(keys.user) >= INVITE_FAILURES_PER_USER || count(keys.ip) >= INVITE_FAILURES_PER_IP) {
    throw new ApiError('rate_limited', '코드를 여러 번 잘못 넣었어요. 15분 뒤에 다시 넣어주세요.');
  }
}

async function recordFailure(context: AppContext, keys: { user: string; ip: string }): Promise<void> {
  await context.pool.query(
    `INSERT INTO structured.invite_code_attempts AS current
       (attempt_key, failure_count, window_started_at, updated_at)
     SELECT key, 1, now(), now() FROM unnest($1::text[]) AS key
     ON CONFLICT (attempt_key) DO UPDATE
       SET failure_count = CASE
             WHEN current.window_started_at <= now() - interval '15 minutes' THEN 1
             ELSE current.failure_count + 1
           END,
           window_started_at = CASE
             WHEN current.window_started_at <= now() - interval '15 minutes' THEN now()
             ELSE current.window_started_at
           END,
           updated_at = now()`,
    [[keys.user, keys.ip]]
  );
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

      const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

      /*
       * 대기 중인 초대(0435 부분 유일 색인)와 겹치면 다시 뽑는다. 같은 순간 다른 웨딩이
       * 같은 숫자를 뽑아 색인에 걸리면(23505) 그것도 다시 뽑는다.
       */
      let issued: { id: string; code: string } | null = null;
      for (let attempt = 0; attempt < CODE_DRAW_ATTEMPTS && !issued; attempt += 1) {
        const candidate = generateInviteCode();
        issued = await withTransaction(context.pool, async (client) => {
          const taken = await client.query(
            `SELECT 1 FROM structured.wedding_invites WHERE code_hash = $1 AND status = 'pending'`,
            [hashCode(candidate)]
          );
          if (taken.rowCount && taken.rowCount > 0) return null;

          await client.query(
            `UPDATE structured.wedding_invites
             SET status = 'revoked', revoked_at = now()
             WHERE wedding_id = $1 AND status = 'pending'`,
            [weddingId]
          );

          const inserted = await client.query<{ id: string }>(
            `INSERT INTO structured.wedding_invites (wedding_id, invited_by, code_hash, expires_at)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [weddingId, userId, hashCode(candidate), expiresAt]
          );
          return { id: inserted.rows[0]!.id, code: candidate };
        }).catch((caught: unknown) => {
          // 트랜잭션은 이미 되돌려졌다. 코드 충돌만 다시 뽑고 나머지는 그대로 올린다.
          if ((caught as { code?: string }).code === '23505') return null;
          throw caught;
        });
      }

      if (!issued) {
        throw new ApiError('conflict', '초대 코드를 만들지 못했어요. 잠시 후 다시 시도해주세요.');
      }

      const { code } = issued;
      const created = { id: issued.id };

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
    const keys = attemptKeys(request, currentUserId(request));
    await assertNotThrottled(context, keys);

    const { rows } = await context.pool.query<{
      status: 'pending' | 'accepted' | 'revoked';
      expires_at: Date;
      partner_user_id: string | null;
    }>(
      `SELECT i.status, i.expires_at, w.partner_user_id
       FROM structured.wedding_invites i
       JOIN structured.weddings w ON w.id = i.wedding_id
       WHERE i.code_hash = $1
       /* 4자리는 자주 다시 뽑힌다 — 같은 숫자의 옛 줄보다 대기 중인 최신 줄을 먼저 본다. */
       ORDER BY (i.status = 'pending') DESC, i.created_at DESC
       LIMIT 1`,
      [hashCode(code)]
    );

    const invite = rows[0];

    if (!invite) {
      await recordFailure(context, keys);
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
    const keys = attemptKeys(request, userId);
    await assertNotThrottled(context, keys);

    /*
     * 틀린 코드는 트랜잭션 밖에서 센다 — 오류로 끝나는 트랜잭션 안에서 적으면 함께
     * 되돌아가 세어지지 않는다.
     */
    const known = await context.pool.query(
      'SELECT 1 FROM structured.wedding_invites WHERE code_hash = $1 LIMIT 1',
      [hashCode(code)]
    );
    if (!known.rowCount) {
      await recordFailure(context, keys);
      throw new ApiError('invalid_request', '지금은 쓸 수 없는 초대입니다.');
    }

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
