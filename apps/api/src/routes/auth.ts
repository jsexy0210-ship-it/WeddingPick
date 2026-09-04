import { createSessionRequestSchema } from '@weddingpick/api-contract';
import type { FastifyInstance } from 'fastify';

import type { IdentityProviderName } from '../auth/identity-provider';
import { signIn, signOut } from '../auth/sessions';
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
    } catch {
      // 검증 실패 이유를 그대로 내려주면 토큰을 맞춰보는 데 쓰인다.
      throw new ApiError('unauthenticated', '로그인 정보를 확인하지 못했습니다.');
    }

    const session = await signIn(
      context.pool,
      identity,
      context.config.sessionTtlDays,
      context.config.operatorSessionTtlDays
    );

    return reply.status(201).send({
      token: session.token,
      userId: session.userId,
      expiresAt: session.expiresAt.toISOString(),
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
