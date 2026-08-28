import type { ErrorCode, ErrorResponse } from '@weddingpick/api-contract';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_request: 400,
  conflict: 409,
  confirmation_required: 409,
  analysis_pending: 409,
  rate_limited: 429,
  internal: 500,
};

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, string>
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get status(): number {
    return STATUS_BY_CODE[this.code];
  }

  toResponse(): ErrorResponse {
    return { error: { code: this.code, message: this.message, ...(this.details && { details: this.details }) } };
  }
}

export const notFound = (what: string) => new ApiError('not_found', `${what}을(를) 찾을 수 없습니다.`);
export const forbidden = () => new ApiError('forbidden', '접근 권한이 없습니다.');
export const unauthenticated = () => new ApiError('unauthenticated', '로그인이 필요합니다.');
