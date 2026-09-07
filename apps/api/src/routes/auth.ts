import {
  createEmailAccountRequestSchema,
  createSessionRequestSchema,
  emailLookupRequestSchema,
  passwordResetConfirmRequestSchema,
  passwordResetRequestSchema,
} from '@weddingpick/api-contract';
import { normalizeEmail } from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import type { AttemptLimiter } from '../auth/attempt-limiter';
import {
  createEmailAccount,
  createPasswordReset,
  findEmailAccount,
  resetPasswordWithToken,
} from '../auth/email-account';
import type { IdentityProviderName } from '../auth/identity-provider';
import { hashPassword, verifyPassword } from '../auth/password';
import { signIn, signOut } from '../auth/sessions';
import type { AppContext } from '../context';
import { ApiError } from '../errors';

/** 비밀번호 시도 5번까지 허용 — WP-AUTH-005 "5번 더 시도할 수 있어요"가 첫 실패 직후의 문구다. */
export const PASSWORD_MAX_ATTEMPTS = 6;
export const PASSWORD_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export function registerAuthRoutes(
  app: FastifyInstance,
  context: AppContext,
  passwordAttempts: AttemptLimiter
): void {
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

    if (body.provider === 'email') {
      const email = normalizeEmail(body.email);

      if (!passwordAttempts.allowed(email)) {
        throw new ApiError('rate_limited', '여러 번 틀려서 잠시 막았어요. 15분 뒤에 다시 시도해주세요.');
      }

      const account = await findEmailAccount(context.pool, email);
      const correct = account ? await verifyPassword(body.password, account.passwordHash) : false;

      if (!correct) {
        passwordAttempts.fail(email);

        // 계정이 없어도 "맞지 않다"고만 말한다 — 등록 여부를 여기서 드러내지 않는다.
        const remaining = PASSWORD_MAX_ATTEMPTS - passwordAttempts.failCount(email);
        throw new ApiError(
          'unauthenticated',
          remaining > 0 ? `비밀번호가 맞지 않아요. ${remaining}번 더 시도할 수 있어요.` : '비밀번호가 맞지 않아요.'
        );
      }

      passwordAttempts.reset(email);

      const session = await signIn(
        context.pool,
        { provider: 'email', subject: email },
        context.config.sessionTtlDays
      );

      return reply
        .status(201)
        .send({ token: session.token, userId: session.userId, expiresAt: session.expiresAt.toISOString() });
    }

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

  /**
   * 이메일 판정(WP-AUTH-002). 있으면 비밀번호 입력으로, 없으면 비밀번호 만들기로 —
   * 화면이 이 값만 보고 다음 화면을 정한다. 사용자가 가입·로그인을 고르지 않는다.
   */
  app.post('/v1/auth/email/lookup', async (request) => {
    const { email } = emailLookupRequestSchema.parse(request.body);
    const account = await findEmailAccount(context.pool, normalizeEmail(email));

    return { exists: account !== null };
  });

  /** 가입(비밀번호 만들기). 성공하면 바로 세션을 연다 — 가입과 로그인을 나눠 다시 묻지 않는다. */
  app.post('/v1/auth/email/accounts', async (request, reply) => {
    const { email: rawEmail, password } = createEmailAccountRequestSchema.parse(request.body);
    const email = normalizeEmail(rawEmail);
    const passwordHash = await hashPassword(password);
    const created = await createEmailAccount(context.pool, email, passwordHash);

    if (!created) {
      throw new ApiError('conflict', '이미 가입된 이메일이에요. 로그인해주세요.');
    }

    const account = await findEmailAccount(context.pool, email);
    const session = await signIn(
      context.pool,
      { provider: 'email', subject: email },
      context.config.sessionTtlDays
    );

    return reply
      .status(201)
      .send({ token: session.token, userId: session.userId, expiresAt: session.expiresAt.toISOString() });
  });

  /**
   * 비밀번호 찾기(WP-AUTH-006). 계정이 있든 없든 항상 204다 — "메일을 보냈어요"로
   * 같은 화면을 보여줘서 등록 여부를 드러내지 않는다(§3.3 보안 규칙).
   */
  app.post('/v1/auth/email/password-reset', async (request, reply) => {
    const { email } = passwordResetRequestSchema.parse(request.body);
    const account = await findEmailAccount(context.pool, normalizeEmail(email));

    if (account) {
      if (!context.config.passwordResetUrl) {
        app.log.warn('PASSWORD_RESET_URL이 없어 재설정 메일을 보내지 못했다.');
      } else {
        const token = await createPasswordReset(context.pool, account.identityId);
        const link = `${context.config.passwordResetUrl}?token=${encodeURIComponent(token)}`;

        await context.mailer.send({
          to: normalizeEmail(email),
          subject: '웨딩픽 비밀번호 재설정',
          text: `아래 링크에서 새 비밀번호를 만들어주세요. 30분 동안만 쓸 수 있어요.\n\n${link}`,
        });
      }
    }

    return reply.status(204).send();
  });

  /** 메일 링크의 토큰으로 새 비밀번호를 만든다. 이 계정의 다른 세션은 전부 끊긴다. */
  app.post('/v1/auth/email/password-reset/confirm', async (request, reply) => {
    const { token, password } = passwordResetConfirmRequestSchema.parse(request.body);
    const ok = await resetPasswordWithToken(context.pool, token, await hashPassword(password));

    if (!ok) {
      throw new ApiError('invalid_request', '링크가 만료됐거나 이미 사용됐어요. 비밀번호 찾기를 다시 해주세요.');
    }

    return reply.status(204).send();
  });

  app.delete('/v1/auth/sessions', async (request, reply) => {
    const header = request.headers.authorization;

    if (header?.startsWith('Bearer ')) {
      await signOut(context.pool, header.slice('Bearer '.length));
    }

    return reply.status(204).send();
  });
}
