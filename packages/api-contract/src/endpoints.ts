import type { ZodType } from 'zod';

import { analysisSchema } from './analyses';
import {
  authProvidersResponseSchema,
  createSessionRequestSchema,
  createSessionResponseSchema,
} from './auth';
import { comparisonResponseSchema } from './comparison';
import {
  completeUploadResponseSchema,
  createUploadRequestSchema,
  createUploadResponseSchema,
} from './documents';
import { confirmFieldsRequestSchema, quoteListResponseSchema, quoteSchema } from './quotes';
import {
  vendorDetailSchema,
  vendorRegionsResponseSchema,
  vendorSearchResponseSchema,
} from './vendors';
import {
  createVerificationRequestSchema,
  createVerificationResponseSchema,
  verificationRequestSchema,
} from './verification';
import {
  createWeddingRequestSchema,
  currentUserSchema,
  weddingDetailSchema,
} from './weddings';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type EndpointDefinition = {
  method: HttpMethod;
  /** `{}`로 감싼 부분이 경로 파라미터다. */
  path: string;
  body?: ZodType;
  response: ZodType;
};

/**
 * API 계약. 서버는 이대로 구현하고 앱은 이대로 부른다.
 *
 * 인증: `listAuthProviders`와 `createSession`만 토큰 없이 부른다. 나머지 모든 경로는
 * `Authorization: Bearer <token>`을 요구한다.
 *
 * 오류: 어떤 경로든 실패하면 `errorResponseSchema` 모양으로 답한다.
 */
export const ENDPOINTS = {
  /** 쓸 수 있는 로그인 방법. 토큰 없이 부른다. */
  listAuthProviders: {
    method: 'GET',
    path: '/v1/auth/providers',
    response: authProvidersResponseSchema,
  },
  /** 로그인. 토큰 없이 부른다. */
  createSession: {
    method: 'POST',
    path: '/v1/auth/sessions',
    body: createSessionRequestSchema,
    response: createSessionResponseSchema,
  },

  /** 내 계정과 현재 웨딩. 앱 첫 진입에 한 번. */
  getCurrentUser: {
    method: 'GET',
    path: '/v1/me',
    response: currentUserSchema,
  },

  createWedding: {
    method: 'POST',
    path: '/v1/weddings',
    body: createWeddingRequestSchema,
    response: weddingDetailSchema,
  },

  getWedding: {
    method: 'GET',
    path: '/v1/weddings/{weddingId}',
    response: weddingDetailSchema,
  },

  /** A-04 촬영. 서명된 URL을 받아 파일은 스토리지로 바로 올린다. */
  createUpload: {
    method: 'POST',
    path: '/v1/documents/uploads',
    body: createUploadRequestSchema,
    response: createUploadResponseSchema,
  },

  /** 업로드 완료를 알리면 분석이 시작된다. */
  completeUpload: {
    method: 'POST',
    path: '/v1/documents/{rawDocumentId}/complete',
    response: completeUploadResponseSchema,
  },

  /** A-06 분석 중. 끝나면 quoteId가 나온다. */
  getAnalysis: {
    method: 'GET',
    path: '/v1/analyses/{analysisId}',
    response: analysisSchema,
  },

  /** A-08 분석 결과. */
  getQuote: {
    method: 'GET',
    path: '/v1/quotes/{quoteId}',
    response: quoteSchema,
  },

  /** A-11 내 웨딩. */
  listQuotes: {
    method: 'GET',
    path: '/v1/weddings/{weddingId}/quotes',
    response: quoteListResponseSchema,
  },

  /**
   * A-07 확인 단계. 핵심 필드가 모두 확인되면 서버가 confirmedAt을 채운다.
   * 남아 있으면 `confirmation_required` 오류로 답한다.
   */
  confirmFields: {
    method: 'POST',
    path: '/v1/quotes/{quoteId}/confirmations',
    body: confirmFieldsRequestSchema,
    response: quoteSchema,
  },

  /** A-09 가격 비교. 표본이 부족하면 available:false와 이유가 온다. */
  getComparison: {
    method: 'GET',
    path: '/v1/quotes/{quoteId}/comparison',
    response: comparisonResponseSchema,
  },

  /** A-13 인증 신청. 접수만 된다 — 승인은 심사를 거친다. */
  createVerificationRequest: {
    method: 'POST',
    path: '/v1/quotes/{quoteId}/verification-requests',
    body: createVerificationRequestSchema,
    response: createVerificationResponseSchema,
  },

  getVerificationRequest: {
    method: 'GET',
    path: '/v1/verification-requests/{requestId}',
    response: verificationRequestSchema,
  },

  /** A-16 업체 검색. 질의는 q·category·region·cursor 쿼리 파라미터로 준다. */
  searchVendors: {
    method: 'GET',
    path: '/v1/vendors',
    response: vendorSearchResponseSchema,
  },

  /** 지역 필터 목록. 자료에 실제로 있는 시도만 내려온다. */
  listVendorRegions: {
    method: 'GET',
    path: '/v1/vendors/regions',
    response: vendorRegionsResponseSchema,
  },

  /** A-17 업체 상세. */
  getVendor: {
    method: 'GET',
    path: '/v1/vendors/{vendorId}',
    response: vendorDetailSchema,
  },
} as const satisfies Record<string, EndpointDefinition>;

export type EndpointName = keyof typeof ENDPOINTS;

/** 경로 파라미터를 채워 실제 경로를 만든다. */
export function buildPath(name: EndpointName, params: Record<string, string> = {}): string {
  return ENDPOINTS[name].path.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];

    if (!value) {
      throw new Error(`경로 파라미터 ${key}가 없다 (${name})`);
    }

    return encodeURIComponent(value);
  });
}
