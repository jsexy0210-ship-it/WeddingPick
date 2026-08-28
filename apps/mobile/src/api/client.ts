import {
  analysisSchema,
  comparisonResponseSchema,
  completeUploadResponseSchema,
  createSessionResponseSchema,
  createUploadResponseSchema,
  currentUserSchema,
  errorResponseSchema,
  quoteSchema,
  weddingDetailSchema,
  type Analysis,
  type ComparisonResponse,
  type ErrorCode,
  type Quote,
} from '@weddingpick/api-contract';
import type { ZodType } from 'zod';

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
      'content-type': 'application/json',
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

  const parsed = schema.safeParse(await response.json());

  if (!parsed.success) {
    throw new ApiError('internal', '서버 응답을 이해하지 못했습니다.');
  }

  return parsed.data;
}

export async function signIn(provider: 'apple' | 'kakao', idToken: string): Promise<void> {
  const session = await request(
    '/v1/auth/sessions',
    createSessionResponseSchema,
    { method: 'POST', body: JSON.stringify({ provider, idToken }), auth: false }
  );

  await saveToken(session.token);
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
