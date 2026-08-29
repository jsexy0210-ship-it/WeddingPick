import {
  analysisSchema,
  candidateListResponseSchema,
  authProvidersResponseSchema,
  comparisonResponseSchema,
  completeUploadResponseSchema,
  createSessionResponseSchema,
  createUploadResponseSchema,
  currentUserSchema,
  errorResponseSchema,
  createVerificationResponseSchema,
  quoteSchema,
  createInquiryResponseSchema,
  inquiryListResponseSchema,
  registerDeviceResponseSchema,
  parsePaymentTextResponseSchema,
  registerPaymentProofResponseSchema,
  createReviewReportResponseSchema,
  createReviewResponseSchema,
  reportReasonListResponseSchema,
  reviewFormSchema,
  reviewListResponseSchema,
  plannerDetailSchema,
  plannerRegionsResponseSchema,
  plannerSearchResponseSchema,
  vendorComparisonResponseSchema,
  vendorDetailSchema,
  vendorRegionsResponseSchema,
  createInviteResponseSchema,
  invitePreviewResponseSchema,
  vendorSearchResponseSchema,
  weddingInviteListResponseSchema,
  verificationRequestSchema,
  weddingDetailSchema,
  type CandidateListResponse,
  type Analysis,
  type ComparisonResponse,
  type AuthProvidersResponse,
  type CreateVerificationRequest,
  type CreateVerificationResponse,
  type ErrorCode,
  type CreateInquiryRequest,
  type RegisterDeviceRequest,
  type RegisterDeviceResponse,
  type ParsePaymentTextResponse,
  type RegisterPaymentProofRequest,
  type RegisterPaymentProofResponse,
  type OriginalKind,
  type CreateReviewReportRequest,
  type CreateReviewReportResponse,
  type CreateReviewRequest,
  type CreateReviewResponse,
  type ReportReasonListResponse,
  type ReviewForm,
  type ReviewListResponse,
  type CreateInquiryResponse,
  type InquiryListResponse,
  type PlannerDetail,
  type PlannerRegionsResponse,
  type PlannerSearchResponse,
  type Quote,
  type VendorComparisonResponse,
  type VendorDetail,
  type VendorRegionsResponse,
  type CreateInviteResponse,
  type InvitePreviewResponse,
  type VendorSearchResponse,
  type WeddingInviteListResponse,
  type VerificationRequest,
} from '@weddingpick/api-contract';
import { z, type ZodType } from 'zod';

import type { VendorCategory } from '@weddingpick/domain';

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

/**
 * 이름·예식일 등록. 둘을 한 번에 보낸다.
 *
 * 따로 보내면 이름만 넣고 나간 사람이 생기고, 그 사람의 홈은 이름은 부르는데
 * D-Day가 없는 반쪽이 된다.
 */
export async function completeSetup(displayName: string, weddingDate: string) {
  return request('/v1/me/setup', currentUserSchema, {
    method: 'POST',
    body: JSON.stringify({ displayName, weddingDate }),
  });
}

export async function getCurrentUser() {
  return request('/v1/me', currentUserSchema);
}

export async function createWedding() {
  return request('/v1/weddings', weddingDetailSchema, { method: 'POST', body: '{}' });
}

export async function getWedding(weddingId: string) {
  return request(`/v1/weddings/${weddingId}`, weddingDetailSchema);
}

/** 웨딩이 없으면 하나 만든다. 사용자에게 물어보지 않는다 — 제품 원칙 1. */
export async function ensureWedding(): Promise<string> {
  const me = await getCurrentUser();

  return me.weddingId ?? (await createWedding()).id;
}

export async function createUpload(input: {
  weddingId: string;
  /** 무엇을 찍은 것인가. 보관 기간이 이 값으로 갈린다 — 결제내역 24시간, 그 밖 30일. */
  kind?: OriginalKind;
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

/**
 * A-16 업체 검색.
 *
 * 빈 검색어는 보내지 않는다 — 서버가 조건 없이 전부 훑는다.
 */
export async function searchVendors(input: {
  q?: string;
  category?: VendorCategory;
  region?: string;
  cursor?: string;
}): Promise<VendorSearchResponse> {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value) {
      query.set(key, value);
    }
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : '';

  return request(`/v1/vendors${suffix}`, vendorSearchResponseSchema);
}

export async function listVendorRegions(): Promise<VendorRegionsResponse> {
  return request('/v1/vendors/regions', vendorRegionsResponseSchema);
}

export async function getVendor(vendorId: string): Promise<VendorDetail> {
  return request(`/v1/vendors/${vendorId}`, vendorDetailSchema);
}

/** A-17 업체 비교. 단서는 결과와 한 응답으로 온다. */
export async function compareVendors(ids: string[]): Promise<VendorComparisonResponse> {
  return request(
    `/v1/vendors/compare?ids=${ids.map(encodeURIComponent).join(',')}`,
    vendorComparisonResponseSchema
  );
}

/**
 * 담아둔 업체.
 *
 * 사람이 아니라 웨딩에 매달려 있다 — 배우자가 담은 곳이 함께 온다.
 */
export async function listCandidates(weddingId: string): Promise<CandidateListResponse> {
  return request(`/v1/weddings/${weddingId}/candidates`, candidateListResponseSchema);
}

export async function addCandidate(
  weddingId: string,
  vendorId: string,
  note?: string
): Promise<{ candidateId: string }> {
  return request(`/v1/weddings/${weddingId}/candidates`, z.object({ candidateId: z.string() }), {
    method: 'POST',
    body: JSON.stringify({ vendorId, ...(note ? { note } : {}) }),
  });
}

/** 빼기. 배우자가 담은 것도 뺄 수 있다 — 함께 고르는 것이라서. */
export async function removeCandidate(weddingId: string, candidateId: string): Promise<void> {
  await request(`/v1/weddings/${weddingId}/candidates/${candidateId}`, z.null(), {
    method: 'DELETE',
  });
}

/**
 * 결제문자에서 값을 읽는다./**
 * 결제문자에서 값을 읽는다. AI를 부르지 않는다 — 서버의 규칙 엔진이 읽는다.
 *
 * 읽기만 하고 저장하지 않는다. 사람이 확인한 뒤에 등록이 따로 간다.
 */
export async function parsePaymentText(input: {
  text?: string;
  rawDocumentId?: string;
}): Promise<ParsePaymentTextResponse> {
  return request('/v1/payment-proofs/parse', parsePaymentTextResponseSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * 결제인증 등록.
 *
 * 심사가 아니라 등록이다 — 사람이 보지 않고 문서 등급도 오르지 않는다. 하는 일은
 * 결제인증 표시와 실제가격 열기 둘이다.
 *
 * 카드번호를 보낼 자리가 요청 타입에 없다. 앱이 실수로도 보낼 수 없다.
 */
export async function registerPaymentProof(
  body: RegisterPaymentProofRequest
): Promise<RegisterPaymentProofResponse> {
  return request('/v1/payment-proofs', registerPaymentProofResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 내 실제가격 열람 자격. 몇 건 더 내면 열리는지 화면이 말할 수 있어야 한다. */
export async function getDataUnlock() {
  return request(
    '/v1/me/data-unlock',
    z.object({
      unlocked: z.boolean(),
      paymentProofCount: z.number(),
      retentionHours: z.number(),
    })
  );
}

/**
 * 후기 쓰기 화면에 필요한 것.
 *
 * 물어볼 항목을 앱이 정하지 않는다. 업종마다 다르고 역할마다 다르며, 그 규칙은
 * 서버에 있다 — 앱에 박아두면 항목이 늘 때마다 앱을 새로 내야 한다.
 */
export async function getReviewForm(vendorId: string): Promise<ReviewForm> {
  return request(`/v1/vendors/${vendorId}/review-form`, reviewFormSchema);
}

/** 후기 쓰기. 확인 단계는 보내지 않는다 — 서버가 정한다. */
export async function createReview(
  vendorId: string,
  body: CreateReviewRequest
): Promise<CreateReviewResponse> {
  return request(`/v1/vendors/${vendorId}/reviews`, createReviewResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 업체의 후기와 이용점수. 단서는 목록과 한 응답으로 온다. */
export async function listVendorReviews(
  vendorId: string,
  cursor?: string
): Promise<ReviewListResponse> {
  const suffix = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';

  return request(`/v1/vendors/${vendorId}/reviews${suffix}`, reviewListResponseSchema);
}

export async function listReportReasons(): Promise<ReportReasonListResponse> {
  return request('/v1/review-report-reasons', reportReasonListResponseSchema);
}

/** 후기 신고. 접수만 된다 — 내릴지는 사람이 정한다. */
export async function reportReview(
  reviewId: string,
  body: CreateReviewReportRequest
): Promise<CreateReviewReportResponse> {
  return request(`/v1/reviews/${reviewId}/reports`, createReviewReportResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * A-16 플래너 검색.
 *
 * 공개 근거가 있는 플래너만 내려온다. 조건은 서버의 뷰 안에 있어 앱이 걸러줄 것이 없다.
 */
export async function searchPlanners(input: {
  q?: string;
  region?: string;
  cursor?: string;
}): Promise<PlannerSearchResponse> {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value) {
      query.set(key, value);
    }
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : '';

  return request(`/v1/planners${suffix}`, plannerSearchResponseSchema);
}

export async function listPlannerRegions(): Promise<PlannerRegionsResponse> {
  return request('/v1/planners/regions', plannerRegionsResponseSchema);
}

export async function getPlanner(plannerId: string): Promise<PlannerDetail> {
  return request(`/v1/planners/${plannerId}`, plannerDetailSchema);
}

/**
 * 문의 접수.
 *
 * 응답에 'received' 말고는 들어올 수 없다 — 계약이 그렇게 되어 있다. 결론은 사람이
 * 낸다 (서비스정책서 6번).
 */
export async function createInquiry(
  body: CreateInquiryRequest
): Promise<CreateInquiryResponse> {
  return request('/v1/inquiries', createInquiryResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listMyInquiries(): Promise<InquiryListResponse> {
  return request('/v1/inquiries', inquiryListResponseSchema);
}

/** A-18 배우자 초대. 코드는 이 응답에서 한 번만 내려온다 — 서버가 다시 보여줄 수 없다. */
export async function createWeddingInvite(weddingId: string): Promise<CreateInviteResponse> {
  return request(`/v1/weddings/${weddingId}/invites`, createInviteResponseSchema, {
    method: 'POST',
  });
}

export async function getWeddingInvite(weddingId: string): Promise<WeddingInviteListResponse> {
  return request(`/v1/weddings/${weddingId}/invites`, weddingInviteListResponseSchema);
}

export async function revokeWeddingInvite(weddingId: string, inviteId: string): Promise<void> {
  await request(`/v1/weddings/${weddingId}/invites/${inviteId}`, z.null(), { method: 'DELETE' });
}

/** 받아들이기 전에 무엇에 동의하는지 본다. */
export async function previewWeddingInvite(code: string): Promise<InvitePreviewResponse> {
  return request('/v1/wedding-invites/preview', invitePreviewResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function acceptWeddingInvite(code: string): Promise<{ weddingId: string }> {
  return request('/v1/wedding-invites/accept', z.object({ weddingId: z.string() }), {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/** 연결 끊기. 어느 쪽이든 할 수 있다. */
export async function unlinkPartner(weddingId: string): Promise<void> {
  await request(`/v1/weddings/${weddingId}/partner`, z.null(), { method: 'DELETE' });
}

/**
 * 푸시 받을 기기를 등록한다.
 *
 * 등록한다고 알림을 받게 되는 것은 아니다 — 파기 알림은 운영자에게만 가고,
 * 운영자인지는 서버가 판단한다. 앱은 자기가 운영자인지 알 필요가 없고,
 * 알려고 하지도 않는다.
 */
export async function registerDevice(
  body: RegisterDeviceRequest
): Promise<RegisterDeviceResponse> {
  return request('/v1/devices', registerDeviceResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
