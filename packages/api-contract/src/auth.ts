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

/**
 * 쓸 수 있는 로그인 방법. 서버가 실제로 무엇을 켜뒀는지 앱이 짐작하지 않게 한다.
 */
export const authProviderSchema = z.object({
  provider: z.enum(['apple', 'kakao']),
  /** 개발용 대체 경로면 true. 화면이 이 사실을 감추지 않는다. */
  isDevelopmentStandIn: z.boolean(),
});

export const authProvidersResponseSchema = z.object({
  providers: z.array(authProviderSchema),
});

export type AuthProvider = z.infer<typeof authProviderSchema>;
export type AuthProvidersResponse = z.infer<typeof authProvidersResponseSchema>;
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;
export type CreateSessionResponse = z.infer<typeof createSessionResponseSchema>;
