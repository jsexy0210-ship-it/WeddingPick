import { NOT_ACTIVATED_NOTICE } from '@weddingpick/domain';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AppContext } from '../context';
import { ApiError, forbidden, unauthenticated } from '../errors';
import { type AdminRole, canWrite, resolveAdmin } from './admin-role';
import { resolveSession } from './sessions';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    /** 가입이 끝난 계정인가. `requireSignup`을 단 라우트에서만 false일 수 있다. */
    userActivated?: boolean;
    /** 관리자 콘솔 등급. `requireOperatorUser`를 단 라우트에서만 있다. */
    adminRole?: AdminRole;
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
 * 값을 바꾸지 않는 메서드. 이 둘이 아니면 쓰기로 본다.
 *
 * **모르는 메서드는 쓰기로 친다.** 목록에 없는 것을 읽기로 두면, 새 메서드가
 * 생기는 날 뷰어에게 조용히 열린다.
 */
const READ_METHODS = new Set(['GET', 'HEAD']);

/**
 * 로그인 + 관리자. 관리자 콘솔 라우트 전부가 이걸 쓴다.
 *
 * CLI 시절에는 각 결정 함수(`approve`·`decide`·`hold` 등)가 제 안에서
 * `requireOperator`를 불렀다 — 조회(`list`/`show`)는 부르지 않았다. 서버에
 * 접근할 수 있는 사람만 CLI를 돌릴 수 있다는 것이 조회 쪽의 유일한 통제였는데,
 * HTTP로 옮기면 그 암묵적 경계가 사라진다. 그래서 여기서는 **조회든 결정이든
 * 관리자 라우트는 전부** 맨 앞에서 관리자인지부터 본다 — 대상을 찾기도 전에.
 *
 * ---------------------------------------------------------------------------
 * 등급은 여기서 본다 — 라우트마다가 아니라
 * ---------------------------------------------------------------------------
 *
 * 0102가 뷰어 등급을 더했다. **화면에서 단추를 숨기는 것은 권한이 아니다** —
 * 뷰어 토큰으로 `PATCH`를 직접 부르면 그대로 통한다. 그래서 서버가 막는다.
 *
 * 막는 자리를 쓰기 라우트 열넷에 하나씩 적지 않고 여기 한 곳에 둔 이유는,
 * **열다섯 번째 라우트를 더하는 사람이 빠뜨릴 수 있기 때문이다.** 빠뜨린 것은
 * 고장으로 보이지 않아 아무도 모른다. 관문에서 메서드로 가르면 새 라우트가
 * 기본으로 닫힌 채 태어난다.
 *
 * 대신 이 방식이 놓치는 것은 「값을 바꾸는 GET」이다. 그런 라우트는 지금 없고,
 * `admin-write-guard.test.ts`가 등록된 라우트를 전수로 훑어 확인한다.
 */
export function requireOperatorUser(context: AppContext) {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const admin = await readAdmin(context, request);

    if (!READ_METHODS.has(request.method) && !canWrite(admin.role)) {
      /*
       * 무엇이 부족한지 말해 준다. 「접근 권한이 없습니다」만 돌려주면 뷰어는
       * 자기 토큰이 만료된 줄 알고 다시 로그인한다 — 다시 로그인해도 같다.
       */
      throw new ApiError('forbidden', '이 계정은 읽기 전용이에요. 변경은 운영 권한이 있어야 해요.');
    }
  };
}

/**
 * 슈퍼 관리자만. 계정 관리 라우트 전부가 이걸 쓴다.
 *
 * **등급을 올리는 것은 슈퍼 관리자만 할 수 있다.** 운영자가 자기를 슈퍼로 올릴 수
 * 있으면 등급이 있는 것과 없는 것이 같아진다. 그래서 계정 관리는 읽기(GET)도
 * 슈퍼 전용이다 — 누가 관리자인지 아는 것부터가 권한을 노리는 첫걸음이다.
 */
export function requireSuperAdmin(context: AppContext) {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const admin = await readAdmin(context, request);

    if (admin.role !== 'super') {
      throw new ApiError('forbidden', '관리자 계정 관리는 슈퍼 관리자만 할 수 있어요.');
    }
  };
}

/** 두 관문이 함께 쓰는 앞부분. 세션 → 등급까지. */
async function readAdmin(
  context: AppContext,
  request: FastifyRequest
): Promise<{ role: AdminRole }> {
  const user = await readSession(context, request);

  if (!user) {
    throw unauthenticated();
  }

  if (!user.activated) {
    throw notActivated();
  }

  const admin = await resolveAdmin(context.pool, user.userId);

  if (!admin) {
    throw forbidden();
  }

  request.userId = user.userId;
  request.userActivated = true;
  request.adminRole = admin.role;

  return admin;
}

/** 관문을 지난 관리자 라우트에서만 부른다. */
export function currentAdminRole(request: FastifyRequest): AdminRole {
  if (!request.adminRole) {
    throw forbidden();
  }

  return request.adminRole;
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
