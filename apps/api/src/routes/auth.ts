import { createSessionRequestSchema } from '@weddingpick/api-contract';
import { AGE_BLOCKED_NOTICE, AGE_UNVERIFIED_NOTICE, type AgeVerifiedVia } from '@weddingpick/domain';
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

    /**
     * Apple이 최초 인증 때 토큰 밖에서 한 번만 주는 이름. 여기서 바로 얹지 않고
     * 들고만 있다가 아래에서 **사본에** 얹는다 — 제공자가 준 객체는 제공자의
     * 것이다.
     */
    let appleProfileName: string | undefined;

    let identity;
    try {
      if (provider.flow === 'id_token' && 'idToken' in body) {
        identity = await provider.verify(body.idToken);
        if (body.provider === 'apple' && body.profileName) {
          appleProfileName = body.profileName;
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
     * ── 만 14세 관문 ──────────────────────────────────────────────────────
     *
     *   연령대 있음 · 14세 이상   통과            via 'provider'
     *   연령대 있음 · 미달        계정 없음 · 403 under_age(앱은 WP-AUTH-009)
     *   연령대 없음 · 화면 확인 O 통과            via 'self_declared'
     *   연령대 없음 · 화면 확인 X 계정 없음 · 403 age_unverified
     *
     * **마지막 줄이 2026-09-10에 뚫려 있던 자리다.** 예전에는 연령대를 못 받으면
     * 그대로 통과시키고 판정을 로그인 화면의 체크박스에 맡겼는데, v3.24가 그
     * 체크박스를 지우면서 판정할 것이 아무것도 남지 않았다 — 연령대를 못 받은
     * 사람이 전원 무확인 통과했다. 확인하지 못한 것의 기본값은 통과가 아니다.
     *
     * **화면의 확인은 `unknown`일 때만 본다.** 제공자가 미달로 판정한 사람을
     * 클라이언트가 보낸 값이 뒤집지 못한다 — 뒤집을 수 있으면 그 관문은 서버가
     * 아니라 앱이 여는 것이 되고, 그것이 원래 뚫린 이유다.
     */
    const verdict = ageVerdictFromRange(identity.profile?.ageRange);

    /*
     * 연령대 문자열을 여기서 버린다. **제공자가 준 객체를 고치지 않고 새로 만든다**
     * — 그 객체는 제공자 모듈의 것이고, 캐시하거나 재사용하는 제공자가 생기면
     * 남의 값을 지우게 된다. 판정은 이미 위에서 뽑았으니 아래로는 사본만 간다.
     */
    const { ageRange: _droppedAgeRange, ...profileWithoutAgeRange } = identity.profile ?? {};
    const profileToStore =
      identity.profile || appleProfileName
        ? { ...profileWithoutAgeRange, ...(appleProfileName ? { name: appleProfileName } : {}) }
        : undefined;
    const identityToStore = { ...identity, ...(profileToStore ? { profile: profileToStore } : {}) };

    /*
     * 판정만 남긴다. **연령대 문자열도 계정 id도 찍지 않는다** — 알아야 하는 것은
     * 「연령대를 못 받는 일이 늘고 있는가」이고, 그 물음에 사람을 특정할 값은
     * 필요 없다. 콘솔에서 연령대가 선택 동의로 내려가면 unknown이 치솟는 것으로
     * 드러난다.
     */
    request.log.info({ provider: body.provider, verdict }, '만 14세 판정');

    if (verdict === 'under_age') {
      // 아무것도 만들지 않았다. 지울 것도 없다.
      throw new ApiError('under_age', AGE_BLOCKED_NOTICE);
    }

    /* 확인 경로. `unknown`이면서 화면 확인도 없으면 여기서 끝난다. */
    let verifiedVia: AgeVerifiedVia;

    if (verdict === 'verified') {
      verifiedVia = 'provider';
    } else if (body.ageAcknowledged === true) {
      verifiedVia = 'self_declared';
    } else {
      throw new ApiError('age_unverified', AGE_UNVERIFIED_NOTICE);
    }

    const session = await signIn(
      context.pool,
      identityToStore,
      context.config.sessionTtlDays,
      context.config.operatorSessionTtlDays
    );

    await markAgeVerified(context.pool, session.userId, verifiedVia);

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
