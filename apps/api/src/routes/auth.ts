import { createSessionRequestSchema } from '@weddingpick/api-contract';
import { AGE_BLOCKED_NOTICE, AGE_UNVERIFIED_NOTICE, type AgeVerifiedVia } from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { ageVerdictFromRange } from '../auth/age-range';
import type { IdentityProviderName } from '../auth/identity-provider';
import { markAgeVerified, sessionEntry, signIn, signOut } from '../auth/sessions';
import type { AppContext } from '../context';
import { ApiError } from '../errors';

export function registerAuthRoutes(app: FastifyInstance, context: AppContext): void {
  // 기존 네이버 HTTPS callback을 네이티브 앱 스킴으로 전달한다.
  app.get('/v1/auth/naver/callback', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('Referrer-Policy', 'no-referrer');
    const query = request.query as { code?: string; state?: string; error?: string; error_description?: string };
    const params = new URLSearchParams();
    // 임의 쿼리가 아니라 인증 callback에 필요한 필드만 전달한다.
    for (const key of ['code', 'state', 'error', 'error_description'] as const) {
      const value = query[key];
      if (typeof value === 'string' && value.length > 0) params.set(key, value);
    }
    return reply.redirect(`weddingpick://auth/naver?${params.toString()}`);
  });

  app.get('/v1/auth/providers', async () => ({
    providers: (Object.keys(context.providers) as IdentityProviderName[]).sort().map((name) => ({
      provider: name,
      isDevelopmentStandIn: Boolean(context.providers[name]?.isDevelopmentStandIn),
    })),
  }));

  app.post('/v1/auth/sessions', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('Pragma', 'no-cache');
    const body = createSessionRequestSchema.parse(request.body);
    const provider = context.providers[body.provider];
    if (!provider) throw new ApiError('invalid_request', `${body.provider} 로그인은 아직 쓸 수 없습니다.`);

    let appleProfileName: string | undefined;
    let identity;
    try {
      if (provider.flow === 'id_token' && 'idToken' in body) {
        identity = await provider.verify(
          body.idToken,
          body.provider === 'apple' ? body.nonce : undefined
        );
        if (body.provider === 'apple' && body.profileName) appleProfileName = body.profileName;
      } else if (provider.flow === 'authorization_code' && 'authorizationCode' in body) {
        identity = await provider.verify({
          authorizationCode: body.authorizationCode,
          state: body.state,
          redirectUri: body.redirectUri,
          codeVerifier: body.codeVerifier,
        });
      } else {
        throw new Error('로그인 제공자와 인증 방식이 맞지 않는다.');
      }
    } catch (caught) {
      request.log.warn({ err: caught, provider: body.provider }, '로그인 검증 실패');
      throw new ApiError('unauthenticated', '로그인 정보를 확인하지 못했습니다.');
    }

    const verdict = ageVerdictFromRange(identity.profile?.ageRange);
    // 제공자 객체를 변경하지 않고 연령 원문을 저장 경로에서 제외한다.
    const { ageRange: _droppedAgeRange, ...profileWithoutAgeRange } = identity.profile ?? {};
    const profileToStore = identity.profile || appleProfileName
      ? { ...profileWithoutAgeRange, ...(appleProfileName ? { name: appleProfileName } : {}) }
      : undefined;
    const identityToStore = { ...identity, ...(profileToStore ? { profile: profileToStore } : {}) };
    request.log.info({ provider: body.provider, verdict }, '만 14세 판정');
    if (verdict === 'under_age') throw new ApiError('under_age', AGE_BLOCKED_NOTICE);

    let verifiedVia: AgeVerifiedVia;
    if (verdict === 'verified') verifiedVia = 'provider';
    else if (body.ageAcknowledged === true) verifiedVia = 'self_declared';
    else throw new ApiError('age_unverified', AGE_UNVERIFIED_NOTICE);

    const session = await signIn(
      context.pool,
      identityToStore,
      context.config.sessionTtlDays,
      context.config.operatorSessionTtlDays
    );
    try {
      await markAgeVerified(context.pool, session.userId, verifiedVia);
      return reply.status(201).send({
        token: session.token,
        userId: session.userId,
        expiresAt: session.expiresAt.toISOString(),
        ...(await sessionEntry(context.pool, session.userId)),
      });
    } catch (error) {
      // 가입 상태 조회 등이 실패하면 응답하지 못한 세션은 폐기한다.
      try {
        await signOut(context.pool, session.token);
      } catch (cleanupError) {
        request.log.error({ err: cleanupError }, '미발급 사용자 세션 폐기 실패');
      }
      throw error;
    }
  });

  app.delete('/v1/auth/sessions', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) await signOut(context.pool, header.slice('Bearer '.length));
    return reply.status(204).send();
  });
}
