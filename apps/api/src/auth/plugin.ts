import { NOT_ACTIVATED_NOTICE } from '@weddingpick/domain';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AppContext } from '../context';
import { ApiError, unauthenticated } from '../errors';
import { resolveSession } from './sessions';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    /** 가입이 끝난 계정인가. `requireSignup`을 단 라우트에서만 false일 수 있다. */
    userActivated?: boolean;
  }
}

/**
 * 가입이 끝나지 않았다.
 *
 * 401이 아니라 403이다. 토큰은 멀쩡하고 다시 로그인해도 달라지지 않는다 —
 * 앱이 401을 보면 로그인 화면으로 돌려보내고, 그러면 사용자는 로그인과 동의
 * 화면 사이를 오간다.
 */
function notActivated(): ApiError {
  return new ApiError('forbidden', NOT_ACTIVATED_NOTICE);
}

/**
 * Authorization 헤더의 세션 토큰을 사용자로 바꾼다. 없거나 만료면 401.
 *
 * **가입이 끝나지 않은 계정은 여기서 막힌다.** 통합정책 v3.13 §N-2 —
 * 소셜 로그인 성공만으로 서비스를 쓰게 하지 않는다. 관문을 라우트마다 두지 않고
 * 여기 하나에 둔다.
 */
export function requireUser(context: AppContext) {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const user = await readSession(context, request);

    if (!user) {
      throw unauthenticated();
    }

    if (!user.activated) {
      throw notActivated();
    }

    request.userId = user.userId;
    request.userActivated = true;
  };
}

/**
 * 로그인은 했지만 아직 가입이 끝나지 않았을 수도 있는 자리.
 *
 * **가입 화면에만 단다.** 이걸 다른 곳에 달면 §N-2가 막으려던 그 상태 —
 * 동의를 건너뛴 계정이 서비스를 쓰는 상태 — 가 그대로 생긴다.
 */
export function requireSignup(context: AppContext) {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const user = await readSession(context, request);

    if (!user) {
      throw unauthenticated();
    }

    request.userId = user.userId;
    request.userActivated = user.activated;
  };
}

async function readSession(context: AppContext, request: FastifyRequest) {
  const header = request.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  return await resolveSession(context.pool, header.slice('Bearer '.length));
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

    const user = await resolveSession(context.pool, header.slice('Bearer '.length));

    if (!user) {
      throw unauthenticated();
    }

    /*
     * 대기 계정은 비로그인처럼 둔다. 여기는 로그인 없이도 보는 화면(Level 1)이라
     * 막을 것이 없고, 그렇다고 가입이 끝난 사람으로 세면 대기 계정이 개인화된
     * 화면을 받는다.
     */
    if (!user.activated) {
      return;
    }

    request.userId = user.userId;
    request.userActivated = true;
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
