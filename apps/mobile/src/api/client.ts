import {
  analysisSchema,
  authProvidersResponseSchema,
  comparisonResponseSchema,
  completeUploadResponseSchema,
  createSessionResponseSchema,
  createUploadResponseSchema,
  currentUserSchema,
  errorResponseSchema,
  createVerificationResponseSchema,
  quoteSchema,
  verificationRequestSchema,
  weddingDetailSchema,
  type Analysis,
  type ComparisonResponse,
  type AuthProvidersResponse,
  type CreateVerificationRequest,
  type CreateVerificationResponse,
  type ErrorCode,
  type Quote,
  type VerificationRequest,
} from '@weddingpick/api-contract';
import { z, type ZodType } from 'zod';

import { API_URL } from '@/api/config';
import { clearToken, loadToken, saveToken } from '@/api/session';

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function requireBaseUrl(): string {
  if (!API_URL) {
    throw new ApiError('internal', '서버 주소가 설정되지 않았습니다.');
  }

  return API_URL.replace(/\/$/, '');
}

/**
 * 서버 응답을 계약 스키마로 검사한 뒤에 쓴다.
 *
 * 서버가 계약을 어기면 화면이 이상한 값을 그리기 전에 여기서 걸린다. 특히 가격은
 * 표본 수·기준 기간과 한 덩어리로만 오게 돼 있어(사업계획서 9번), 중앙값만 담긴 응답은
 * 통과하지 못한다.
 */
async function request<T>(
  path: string,
  schema: ZodType<T>,
  init: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = true, headers, ...rest } = init;
  const token = auth ? await loadToken() : null;

  const response = await fetch(`${requireBaseUrl()}${path}`, {
    ...rest,
    headers: {
      // 본문이 없는데 JSON이라고 말하면 서버가 빈 본문을 파싱하려다 막힌다.
      ...(rest.body !== undefined && { 'content-type': 'application/json' }),
      ...(token && { authorization: `Bearer ${token}` }),
      ...headers,
    },
  });

  if (!response.ok) {
    const body = errorResponseSchema.safeParse(await response.json().catch(() => null));

    if (body.success) {
      if (body.data.error.code === 'unauthenticated') {
        await clearToken();
      }

      throw new ApiError(body.data.error.code, body.data.error.message);
    }

    throw new ApiError('internal', '서버와 통신하지 못했습니다.');
  }

  // 204는 본문이 없다. json()을 부르면 거기서 터진다.
  const parsed = schema.safeParse(response.status === 204 ? null : await response.json());

  if (!parsed.success) {
    throw new ApiError('internal', '서버 응답을 이해하지 못했습니다.');
  }

  return parsed.data;
}

/** 서버가 켜둔 로그인 방법. 앱이 짐작하지 않는다. */
export async function listAuthProviders(): Promise<AuthProvidersResponse> {
  return request('/v1/auth/providers', authProvidersResponseSchema, { auth: false });
}

export async function signIn(provider: 'apple' | 'kakao', idToken: string): Promise<void> {
  const session = await request(
    '/v1/auth/sessions',
    createSessionResponseSchema,
    { method: 'POST', body: JSON.stringify({ provider, idToken }), auth: false }
  );

  await saveToken(session.token);
}

/** 로그아웃. 서버 세션을 지우고 기기의 토큰도 버린다. */
export async function signOut(): Promise<void> {
  try {
    await request('/v1/auth/sessions', z.null(), { method: 'DELETE' });
  } finally {
    // 서버를 못 불러도 기기의 토큰은 버린다. 남겨두면 로그아웃한 척만 한 것이 된다.
    await clearToken();
  }
}

export async function getCurrentUser() {
  return request('/v1/me', currentUserSchema);
}

export async function createWedding() {
  return request('/v1/weddings', weddingDetailSchema, { method: 'POST', body: '{}' });
}

/** 웨딩이 없으면 하나 만든다. 사용자에게 물어보지 않는다 — 제품 원칙 1. */
export async function ensureWedding(): Promise<string> {
  const me = await getCurrentUser();

  return me.weddingId ?? (await createWedding()).id;
}

export async function createUpload(input: {
  weddingId: string;
  pages: { mimeType: string; sizeBytes: number }[];
}) {
  return request('/v1/documents/uploads', createUploadResponseSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** 업로드가 끝났음을 알린다. 분석 작업이 만들어진다. */
export async function completeUpload(rawDocumentId: string, weddingId: string) {
  return request(`/v1/documents/${rawDocumentId}/complete`, completeUploadResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ weddingId }),
  });
}

export async function getAnalysis(analysisId: string): Promise<Analysis> {
  return request(`/v1/analyses/${analysisId}`, analysisSchema);
}

export async function getQuote(quoteId: string): Promise<Quote> {
  return request(`/v1/quotes/${quoteId}`, quoteSchema);
}

export async function confirmFields(
  quoteId: string,
  fields: { path: string; correctedValue?: string }[]
): Promise<Quote> {
  return request(`/v1/quotes/${quoteId}/confirmations`, quoteSchema, {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });
}

export async function getComparison(quoteId: string): Promise<ComparisonResponse> {
  return request(`/v1/quotes/${quoteId}/comparison`, comparisonResponseSchema);
}

/**
 * A-13 인증 신청 접수.
 *
 * 응답에 'received' 말고는 들어올 수 없다 — 계약이 그렇게 되어 있다. 등급은 사람이
 * 증빙을 확인한 뒤에야 오른다 (서비스정책서 7번).
 */
export async function createVerificationRequest(
  quoteId: string,
  body: CreateVerificationRequest
): Promise<CreateVerificationResponse> {
  return request(`/v1/quotes/${quoteId}/verification-requests`, createVerificationResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getVerificationRequest(requestId: string): Promise<VerificationRequest> {
  return request(`/v1/verification-requests/${requestId}`, verificationRequestSchema);
}
