import { z } from 'zod';

import { idSchema, timestampSchema } from './common';

/**
 * 로그인. OIDC 제공자는 id_token을 검증하고, 네이버는 일회용 인가 코드를 서버에서
 * 교환한다. 네이버 client secret은 앱이 아니라 서버에만 둔다.
 */
export const createSessionRequestSchema = z.union([
  z.object({
    provider: z.enum(['apple', 'kakao', 'google']),
    idToken: z.string().min(1),
    /** Apple이 최초 인증 때 토큰 밖에서 한 번만 주는 이름. */
    profileName: z.string().trim().min(1).max(100).optional(),
  }),
  z.object({
    provider: z.literal('naver'),
    authorizationCode: z.string().min(1),
    state: z.string().min(1).max(512),
    redirectUri: z.string().url().max(2048),
    codeVerifier: z.string().min(43).max(128).optional(),
  }),
]);

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
  provider: z.enum(['apple', 'kakao', 'google', 'naver']),
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
