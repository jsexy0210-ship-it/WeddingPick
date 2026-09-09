import { createSessionRequestSchema } from '@weddingpick/api-contract';
import { AGE_BLOCKED_NOTICE } from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { ageVerdictFromRange } from '../auth/age-range';
import type { IdentityProviderName } from '../auth/identity-provider';
import { markAgeVerified, sessionEntry, signIn, signOut } from '../auth/sessions';
import type { AppContext } from '../context';
import { ApiError } from '../errors';

export function registerAuthRoutes(app: FastifyInstance, context: AppContext): void {
  /**
   * 네이버는 Callback URL에 HTTPS 주소만 허용한다. 브라우저가 이 주소로
   * 돌아오면 인증 코드와 state만 앱의 등록된 커스텀 스킴으로 전달한다.
   * 토큰 교환은 앱이 PKCE verifier를 보유한 상태에서 기존 API로 수행한다.
   */
  app.get('/v1/auth/naver/callback', async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string; error_description?: string };
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string' && value.length > 0) params.set(key, value);
    }

    return reply.redirect(`weddingpick://auth/naver?${params.toString()}`);
  });

  /**
   * 쓸 수 있는 로그인 방법.
   *
   * 앱이 어느 제공자가 켜져 있는지 짐작하지 않게 한다. 개발용 대체 경로는 그렇다고
   * 밝힌다 — 개발용 문을 실제 로그인인 척 그려두면 그 빌드가 어디까지 나가는지 모른다.
   */
  app.get('/v1/auth/providers', async () => ({
    providers: (Object.keys(context.providers) as IdentityProviderName[]).sort().map((name) => ({
      provider: name,
      isDevelopmentStandIn: Boolean(context.providers[name]?.isDevelopmentStandIn),
    })),
  }));

  app.post('/v1/auth/sessions', async (request, reply) => {
    const body = createSessionRequestSchema.parse(request.body);
    const provider = context.providers[body.provider];

    if (!provider) {
      throw new ApiError('invalid_request', `${body.provider} 로그인은 아직 쓸 수 없습니다.`);
    }

    let identity;
    try {
      if (provider.flow === 'id_token' && 'idToken' in body) {
        identity = await provider.verify(body.idToken);
        if (body.provider === 'apple' && body.profileName) {
          identity.profile = { ...identity.profile, name: body.profileName };
        }
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
      // 이유는 서버 로그에만 남긴다. 그대로 내려주면 토큰을 맞춰보는 데 쓰인다.
      // 로그가 없으면 제공자 설정이 틀렸을 때 아무도 원인을 볼 수 없다 —
      // 실제로 카카오 로그인이 막혔을 때 서버에도 클라이언트에도 단서가 없었다.
      request.log.warn({ err: caught, provider: body.provider }, '로그인 검증 실패');
      throw new ApiError('unauthenticated', '로그인 정보를 확인하지 못했습니다.');
    }

    /*
     * 연령대(v3.22 SPEC 3.5). 판정 하나만 꺼내고 문자열은 여기서 버린다 —
     * `signIn`에 넘기기 전에 지워야 identities에도 남지 않는다.
     *
     *   있음 · 14세 이상 → 체크박스 없이 통과(age_verified)
     *   있음 · 미만      → 계정을 만들지 않고 403 under_age(앱은 WP-AUTH-010)
     *   없음             → 체크박스 그대로
     */
    const ageVerdict = ageVerdictFromRange(identity.profile?.ageRange);

    if (identity.profile) {
      const { ageRange: _dropped, ...rest } = identity.profile;
      identity.profile = rest;
    }

    if (ageVerdict === 'under_age') {
      // 아무것도 만들지 않았다. 지울 것도 없다.
      throw new ApiError('under_age', AGE_BLOCKED_NOTICE);
    }

    const session = await signIn(
      context.pool,
      identity,
      context.config.sessionTtlDays,
      context.config.operatorSessionTtlDays
    );

    if (ageVerdict === 'verified') {
      await markAgeVerified(context.pool, session.userId);
    }

    return reply.status(201).send({
      token: session.token,
      userId: session.userId,
      expiresAt: session.expiresAt.toISOString(),
      ...(await sessionEntry(context.pool, session.userId)),
    });
  });

  app.delete('/v1/auth/sessions', async (request, reply) => {
    const header = request.headers.authorization;

    if (header?.startsWith('Bearer ')) {
      await signOut(context.pool, header.slice('Bearer '.length));
    }

    return reply.status(204).send();
  });
}
