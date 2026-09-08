import { z } from 'zod';

import { idSchema, timestampSchema } from './common';

/**
 * 로그인. Apple·Google은 앱이 받은 id_token을 서버가 검증한다. 네이버·카카오는
 * 앱이 일회용 인가 코드만 받고 서버가 토큰으로 교환한다 — 카카오는
 * `/oauth/authorize`에서 id_token을 바로 주지 않고(`response_type=id_token`을
 * 지원하지 않는 SDK 요청으로 거부, KOE033) 토큰 교환 응답에 id_token을 실어 준다.
 * client secret은 앱이 아니라 서버에만 둔다.
 */
/** 대소문자·앞뒤 공백은 서버가 정리한다(`normalizeEmail`). 여기서는 모양만 본다. */
const emailSchema = z
  .string()
  .trim()
  .max(254)
  .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), '이메일 주소 형식이 아닙니다.');
/** 규칙(8자·영문+숫자·특수문자)은 `@weddingpick/domain`의 PASSWORD_RULES가 정한다. 여기서는 길이만 막는다. */
const passwordSchema = z.string().min(8).max(128);

export const createSessionRequestSchema = z.union([
  z.object({
    provider: z.enum(['apple', 'google']),
    idToken: z.string().min(1),
    /** Apple이 최초 인증 때 토큰 밖에서 한 번만 주는 이름. */
    profileName: z.string().trim().min(1).max(100).optional(),
  }),
  z.object({
    provider: z.enum(['naver', 'kakao']),
    authorizationCode: z.string().min(1),
    state: z.string().min(1).max(512),
    redirectUri: z.string().url().max(2048),
    codeVerifier: z.string().min(43).max(128).optional(),
  }),
  /** 이메일·비밀번호(WP-AUTH-003). 가입은 `createEmailAccount`가 따로 한다. */
  z.object({
    provider: z.literal('email'),
    email: emailSchema,
    password: passwordSchema,
  }),
]);

/**
 * 이메일 로그인(v3.12). 이메일을 넣으면 서버가 있는 계정인지 판정해 다음 화면을
 * 가른다 — 있으면 비밀번호 입력, 없으면 비밀번호 만들기.
 */
export const emailLookupRequestSchema = z.object({ email: emailSchema });
export const emailLookupResponseSchema = z.object({ exists: z.boolean() });

/** 가입 = 비밀번호 만들기. 성공하면 세션까지 연다(응답은 createSession과 같다). */
export const createEmailAccountRequestSchema = z.object({ email: emailSchema, password: passwordSchema });

/** 비밀번호 찾기. 계정이 있든 없든 204다 — 있는지 알려주는 건 lookup의 몫이다. */
export const passwordResetRequestSchema = z.object({ email: emailSchema });
/** 메일 링크의 토큰으로 새 비밀번호를 만든다. 그 사람의 기존 세션은 전부 끊긴다. */
export const passwordResetConfirmRequestSchema = z.object({
  token: z.string().min(1).max(512),
  password: passwordSchema,
});

export const createSessionResponseSchema = z.object({
  /** 이후 모든 요청의 Authorization: Bearer <token>. 발급 시 한 번만 내려간다. */
  token: z.string().min(1),
  userId: idSchema,
  expiresAt: timestampSchema,
  /**
   * 로그인 직후 앱이 **한 번 더 묻지 않고** 바로 다음 화면을 고르게 하는 두 값
   * (2026-09-08). 예전에는 세션을 받고 나서 /v1/me/signup을 다시 물어야 해서
   * 로그인 화면에 머물렀다 온보딩으로 넘어갔다.
   */
  /** 가입(만 14세 확인·필수 동의)이 끝났는가. false면 온보딩(/setup)부터다. */
  activated: z.boolean(),
  /** 초기 설정(지역)까지 끝났는가. true면 홈으로 바로 간다. */
  setupComplete: z.boolean(),
});

/**
 * 쓸 수 있는 로그인 방법. 서버가 실제로 무엇을 켜뒀는지 앱이 짐작하지 않게 한다.
 *
 * `email`은 여기 없다 — OAuth 앱 등록 여부에 좌우되는 소셜 제공자와 달리 이메일은
 * 우리 서버가 직접 처리해서 항상 켜져 있다. 화면의 "이메일로 시작하기"는 이 목록이
 * 아니라 고정 버튼이다(`/login`).
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
export type EmailLookupResponse = z.infer<typeof emailLookupResponseSchema>;
