import { registerDeviceRequestSchema } from '@weddingpick/api-contract';
import { isExpoPushToken } from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { ApiError } from '../errors';

export function registerDeviceRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  /**
   * 푸시 받을 기기 등록.
   *
   * 같은 토큰이 이미 있으면 새로 만들지 않고 주인을 옮긴다. 기기를 넘겨주거나
   * 한 폰에서 계정을 바꿔 로그인하면 같은 토큰이 다른 사람에게 붙는데, 그대로
   * 두면 이전 사람에게 갈 알림이 지금 쓰는 사람 폰으로 간다.
   *
   * 이 경로로는 어떤 권한도 오르지 않는다. 파기 알림은 운영자에게만 가고,
   * 운영자 표시는 사람이 DB에서 직접 켠다.
   */
  app.post('/v1/devices', auth, async (request, reply) => {
    const userId = currentUserId(request);
    const body = registerDeviceRequestSchema.parse(request.body);

    // 아무 문자열이나 받아두면 보낼 때가 되어서야 실패하고, 그때는 왜 안 갔는지
    // 알기 어렵다.
    if (!isExpoPushToken(body.token)) {
      throw new ApiError('invalid_request', '알림을 받을 수 있는 기기가 아닙니다.');
    }

    const { rows } = await context.pool.query<{ id: string }>(
      `INSERT INTO structured.device_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             platform = EXCLUDED.platform,
             last_seen_at = now(),
             -- 다시 등록했다는 것은 기기가 살아 있다는 뜻이다.
             disabled_at = NULL,
             disabled_reason = NULL
       RETURNING id`,
      [userId, body.token.trim(), body.platform]
    );

    return reply.status(201).send({ deviceId: rows[0]!.id });
  });
}
