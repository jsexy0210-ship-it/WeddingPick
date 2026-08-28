import { createSessionRequestSchema } from '@weddingpick/api-contract';
import type { FastifyInstance } from 'fastify';

import { signIn, signOut } from '../auth/sessions';
import type { AppContext } from '../context';
import { ApiError } from '../errors';

export function registerAuthRoutes(app: FastifyInstance, context: AppContext): void {
  app.post('/v1/auth/sessions', async (request, reply) => {
    const body = createSessionRequestSchema.parse(request.body);
    const provider = context.providers[body.provider];

    if (!provider) {
      throw new ApiError('invalid_request', `${body.provider} 로그인은 아직 쓸 수 없습니다.`);
    }

    let identity;
    try {
      identity = await provider.verify(body.idToken);
    } catch {
      // 검증 실패 이유를 그대로 내려주면 토큰을 맞춰보는 데 쓰인다.
      throw new ApiError('unauthenticated', '로그인 정보를 확인하지 못했습니다.');
    }

    const session = await signIn(context.pool, identity, context.config.sessionTtlDays);

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
