import { createSessionRequestSchema } from '@weddingpick/api-contract';
import { AGE_BLOCKED_NOTICE } from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { ageVerdictFromBirthDate, ageVerdictFromRange, type AgeVerdict } from '../auth/age-range';
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
     * 만 14세 판정. **출생 연도가 주된 근거다**(2026-09-09 사용자 결정 — 카카오
     * 동의항목에서 출생 연도를 필수로 받고, 로그인 화면의 체크박스는 없앴다).
     *
     *   생일까지 있음 → 만 나이를 정확히 센다
     *   출생 연도만    → 경계(올해 - 연도 == 14)는 만 13일 수도 14일 수도 있어 `unknown`
     *   연령대만       → 예전 경로. 구간 아래끝으로 본다
     *   아무것도 없음  → `unknown`
     *
     *   14세 이상 → age_verified 기록
     *   미만      → 계정을 만들지 않고 403 under_age(앱은 WP-AUTH-010)
     *   모름      → 계정은 만들되 확인 표시를 남기지 않는다
     *
     * 판정 하나만 꺼내고 원래 값은 여기서 버린다 — `signIn`에 넘기기 전에 지워야
     * identities에도 남지 않는다. **나이는 판정이지 보관 대상이 아니다.**
     */
    const ageVerdict = verdictFor(identity.profile);

    if (identity.profile) {
      const { ageRange: _r, birthYear: _y, birthday: _d, ...rest } = identity.profile;
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

/**
 * 어떤 값이 왔든 만 14세 판정 하나로 모은다.
 *
 * 출생 연도가 필수 동의라 대부분 그것으로 갈린다. 생일까지 있으면 정확해지고,
 * 둘 다 없는 옛 경로(연령대만)도 계속 받는다 — 동의항목을 바꾸기 전에 가입한
 * 사람이 다시 로그인할 때 이 길로 온다.
 */
function verdictFor(profile: { ageRange?: string; birthYear?: string; birthday?: string } | undefined): AgeVerdict {
  if (profile?.birthYear) return ageVerdictFromBirthDate(profile.birthYear, profile.birthday);

  return ageVerdictFromRange(profile?.ageRange);
}
