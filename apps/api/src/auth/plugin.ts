import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AppContext } from '../context';
import { unauthenticated } from '../errors';
import { resolveSession } from './sessions';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

/** Authorization 헤더의 세션 토큰을 사용자로 바꾼다. 없거나 만료면 401. */
export function requireUser(context: AppContext) {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw unauthenticated();
    }

    const userId = await resolveSession(context.pool, header.slice('Bearer '.length));

    if (!userId) {
      throw unauthenticated();
    }

    request.userId = userId;
  };
}

/**
 * 토큰이 있으면 사용자를 붙이고, 없으면 그냥 지나간다.
 *
 * 사업계획서 v3 7번의 Level 1 — 검색·업체정보·후기·이용점수는 로그인 없이 본다.
 * 앱을 켜자마자 로그인을 요구하면, 무엇을 주는 서비스인지 보기도 전에 계정을
 * 만들라는 말이 된다.
 *
 * **틀린 토큰은 401이다.** 조용히 비로그인으로 떨어뜨리지 않는다 — 만료된 토큰을
 * 든 사람에게 "로그인이 풀렸다"가 아니라 남의 화면을 보여주게 되고, 그 사람은
 * 자기가 로그인한 줄 안다. 토큰이 아예 없는 것과 틀린 것은 다른 일이다.
 */
export function optionalUser(context: AppContext) {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      return;
    }

    const userId = await resolveSession(context.pool, header.slice('Bearer '.length));

    if (!userId) {
      throw unauthenticated();
    }

    request.userId = userId;
  };
}

/** 로그인했으면 누구인지, 아니면 null. `optionalUser`를 단 라우트에서 쓴다. */
export function optionalUserId(request: FastifyRequest): string | null {
  return request.userId ?? null;
}

/** 인증이 끝난 라우트에서만 부른다. */
export function currentUserId(request: FastifyRequest): string {
  if (!request.userId) {
    throw unauthenticated();
  }

  return request.userId;
}
