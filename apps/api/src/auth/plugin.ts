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

/** 인증이 끝난 라우트에서만 부른다. */
export function currentUserId(request: FastifyRequest): string {
  if (!request.userId) {
    throw unauthenticated();
  }

  return request.userId;
}
