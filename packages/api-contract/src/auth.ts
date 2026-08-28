import { z } from 'zod';

import { idSchema, timestampSchema } from './common';

/**
 * 로그인. 제공자가 발급한 OIDC id_token을 넘기면 서버가 제공자 공개키로 검증한다.
 * 서버는 제공자의 비밀키를 들고 있지 않는다.
 */
export const createSessionRequestSchema = z.object({
  provider: z.enum(['apple', 'kakao']),
  idToken: z.string().min(1),
});

export const createSessionResponseSchema = z.object({
  /** 이후 모든 요청의 Authorization: Bearer <token>. 발급 시 한 번만 내려간다. */
  token: z.string().min(1),
  userId: idSchema,
  expiresAt: timestampSchema,
});

export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;
export type CreateSessionResponse = z.infer<typeof createSessionResponseSchema>;
