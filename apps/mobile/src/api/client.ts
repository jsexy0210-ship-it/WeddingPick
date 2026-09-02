import {
  analysisSchema,
  candidateListResponseSchema,
  expenseSummaryResponseSchema,
  visitNoteListResponseSchema,
  weddingTaskListResponseSchema,
  authProvidersResponseSchema,
  comparisonResponseSchema,
  completeUploadResponseSchema,
  createSessionResponseSchema,
  createUploadResponseSchema,
  currentUserSchema,
  displayNameResponseSchema,
  top3ResponseSchema,
  errorResponseSchema,
  createVerificationResponseSchema,
  quoteSchema,
  createInquiryResponseSchema,
  inquiryListResponseSchema,
  registerDeviceResponseSchema,
  settingsSchema,
  signupStateSchema,
  myReportListResponseSchema,
  notificationListResponseSchema,
  notificationSummaryResponseSchema,
  rebuttalListResponseSchema,
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
  conditionStatsSchema,
  myRewardsResponseSchema,
  vendorClaimListResponseSchema,
  weddingInviteListResponseSchema,
  verificationRequestSchema,
  weddingDetailSchema,
  type CandidateListResponse,
  type ConditionStats,
  type DecideCategoryRequest,
  type MyRewardsResponse,
  type CreateRebuttalRequest,
  type CreateVendorClaimRequest,
  type VendorClaimListResponse,
  type MyReportListResponse,
  type NotificationListResponse,
  type NotificationSummaryResponse,
  type RebuttalListResponse,
  type UpdateReviewRequest,
  type Settings,
  type UpdateSettingsRequest,
  type VendorSort,
  type UpdateRebuttalRequest,
  type CreateExpenseRequest,
  type CreateVisitNoteRequest,
  type ExpenseSummaryResponse,
  type UpdateWeddingTaskRequest,
  type VisitNoteListResponse,
  type WeddingTaskListResponse,
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
  createPriceReportRequestSchema,
  createPriceReportResponseSchema,
  quoteListResponseSchema,
  type CreatePriceReportRequest,
  type CreatePriceReportResponse,
  type QuoteListResponse,
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

export async function signIn(provider: 'apple' | 'kakao' | 'google' | 'naver', idToken: string): Promise<void> {
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
 * 최소 온보딩. 예식일과 지역을 한 번에 보낸다(v3.10 §3).
 *
 * 이름은 보내지 않는다 — 닉네임은 최초 필수입력에서 빠졌고 MY에서 정한다.
 *
 * `budgetAmount`를 넘기지 않으면 서버가 예산을 건드리지 않는다. `아직 모르겠어요`는
 * 명시적인 null이다 — 안 고른 것과 모르겠다고 고른 것은 다른 상태다.
 */
export async function completeSetup(input: {
  weddingDate: string;
  region: string;
  budgetAmount?: number | null;
}) {
  return request('/v1/me/setup', currentUserSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** 부를 이름. MY에서 정한다. null이면 안 부른다. */
export async function setDisplayName(displayName: string | null) {
  return request('/v1/me/display-name', displayNameResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  });
}

export async function getCurrentUser() {
  return request('/v1/me', currentUserSchema);
}

/**
 * 가입 상태. 통합정책 v3.13 §N.
 *
 * 로그인 직후 이걸 먼저 본다. 소셜 로그인 성공만으로는 가입이 끝나지 않아서,
 * `activated`가 false면 다른 경로는 전부 막혀 있다.
 */
export async function getSignupState() {
  return request('/v1/me/signup', signupStateSchema);
}

/**
 * 연령 확인과 필수 동의.
 *
 * `birthDate`는 서버가 나이를 세는 데만 쓰고 저장하지 않는다.
 */
export async function completeSignup(input: { birthDate: string; consents: string[] }) {
  return request('/v1/me/signup', signupStateSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
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

export async function createPriceReport(
  body: CreatePriceReportRequest
): Promise<CreatePriceReportResponse> {
  return request('/v1/price-reports', createPriceReportResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listQuotes(
  weddingId: string,
  cursor?: string
): Promise<QuoteListResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  const qs = params.toString();
  return request(
    `/v1/weddings/${weddingId}/quotes${qs ? `?${qs}` : ''}`,
    quoteListResponseSchema
  );
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
  sort?: VendorSort;
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

/**
 * TOP3 추천. v3.10 §2.
 *
 * 지역은 넘길 수 있다 — 지연 로그인이라 로그인 전에도 홈이 뜨고, 그때 지역은
 * 기기에만 있다. 안 넘기면 서버가 로그인한 사람의 웨딩에서 읽는다.
 */
export async function getTop3(input: { region?: string; category?: VendorCategory } = {}) {
  const query = new URLSearchParams();

  if (input.region) query.set('region', input.region);
  if (input.category) query.set('category', input.category);

  const suffix = query.size > 0 ? `?${query.toString()}` : '';

  return request(`/v1/recommendations/top3${suffix}`, top3ResponseSchema);
}

export async function listVendorRegions(): Promise<VendorRegionsResponse> {
  return request('/v1/vendors/regions', vendorRegionsResponseSchema);
}

export async function getVendor(vendorId: string): Promise<VendorDetail> {
  return request(`/v1/vendors/${vendorId}`, vendorDetailSchema);
}

/**
 * 조건이 비슷한 결제 사례. v2.0 D-1.
 *
 * 실제 결제 구간(`getVendor`)과 다른 자리다 — 그건 누구나 보고, 이것은 결제인증이
 * 여는 깊이다.
 */
export async function getVendorConditions(vendorId: string): Promise<ConditionStats> {
  return request(`/v1/vendors/${vendorId}/conditions`, conditionStatsSchema);
}

/** A-17 업체 비교. 단서는 결과와 한 응답으로 온다. */
export async function compareVendors(ids: string[]): Promise<VendorComparisonResponse> {
  return request(
    `/v1/vendors/compare?ids=${ids.map(encodeURIComponent).join(',')}`,
    vendorComparisonResponseSchema
  );
}

/* -------------------------------------------------------------------------- */
/* 우리웨딩 — 웨딩 스케줄 · 지출내역 · 방문노트                                */
/* -------------------------------------------------------------------------- */

/** 처음 부르면 서버가 기본 열넷을 깔아준다. */
export async function listWeddingTasks(weddingId: string): Promise<WeddingTaskListResponse> {
  return request(`/v1/weddings/${weddingId}/tasks`, weddingTaskListResponseSchema);
}

export async function addWeddingTask(
  weddingId: string,
  body: { label: string; dueDate?: string; vendorLabel?: string }
): Promise<{ taskId: string }> {
  return request(`/v1/weddings/${weddingId}/tasks`, z.object({ taskId: z.string() }), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 보낸 칸만 고친다. `state: null`은 자동 판정으로 되돌린다는 뜻이다. */
export async function updateWeddingTask(
  weddingId: string,
  taskId: string,
  body: UpdateWeddingTaskRequest
): Promise<void> {
  await request(`/v1/weddings/${weddingId}/tasks/${taskId}`, z.object({ ok: z.boolean() }), {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function removeWeddingTask(weddingId: string, taskId: string): Promise<void> {
  await request(`/v1/weddings/${weddingId}/tasks/${taskId}`, z.null(), { method: 'DELETE' });
}

export async function getExpenses(weddingId: string): Promise<ExpenseSummaryResponse> {
  return request(`/v1/weddings/${weddingId}/expenses`, expenseSummaryResponseSchema);
}

export async function addExpense(
  weddingId: string,
  body: CreateExpenseRequest
): Promise<{ expenseId: string }> {
  return request(`/v1/weddings/${weddingId}/expenses`, z.object({ expenseId: z.string() }), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 직접 입력한 항목만 지워진다. 결제인증에서 온 줄은 404다. */
export async function removeExpense(weddingId: string, expenseId: string): Promise<void> {
  await request(`/v1/weddings/${weddingId}/expenses/${expenseId}`, z.null(), { method: 'DELETE' });
}

export async function setBudget(weddingId: string, budget: number | null): Promise<void> {
  await request(`/v1/weddings/${weddingId}/budget`, z.object({ budget: z.number().nullable() }), {
    method: 'PUT',
    body: JSON.stringify({ budget }),
  });
}

export async function listVisitNotes(weddingId: string): Promise<VisitNoteListResponse> {
  return request(`/v1/weddings/${weddingId}/visit-notes`, visitNoteListResponseSchema);
}

export async function addVisitNote(
  weddingId: string,
  body: CreateVisitNoteRequest
): Promise<{ noteId: string }> {
  return request(`/v1/weddings/${weddingId}/visit-notes`, z.object({ noteId: z.string() }), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function removeVisitNote(weddingId: string, noteId: string): Promise<void> {
  await request(`/v1/weddings/${weddingId}/visit-notes/${noteId}`, z.null(), { method: 'DELETE' });
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

/**
 * 내가 낸 결제인증과, 그것으로 열린 것.
 *
 * **가격을 여는 값이 아니다.** v2.0 K-6이 그 잠금을 폐기했다 — 실제 결제 구간은
 * 누구나 본다. 여기서 열리는 것은 조건이 비슷한 사례다.
 */
export async function getDataUnlock() {
  return request(
    '/v1/me/data-unlock',
    z.object({
      deepData: z.boolean(),
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
/**
 * 후기 고치기. 자기 글만.
 *
 * 규칙이 위험정보를 찾아 가린 글은 고치면 되살아난다 — 그래야 "지우고 다시
 * 올려주세요"가 지킬 수 있는 말이 된다.
 */
export async function updateReview(
  reviewId: string,
  body: UpdateReviewRequest
): Promise<void> {
  await request(`/v1/reviews/${reviewId}`, z.null(), {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

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

/*
 * ---------------------------------------------------------------------------
 * 알림 · 내 제보 내역 · 업체 반론 (디자인 핸드오프 20번)
 * ---------------------------------------------------------------------------
 */

export async function listNotifications(): Promise<NotificationListResponse> {
  return request('/v1/me/notifications', notificationListResponseSchema);
}

/** 홈의 벨. 목록 전체를 받지 않고 개수만 묻는다. */
export async function getNotificationSummary(): Promise<NotificationSummaryResponse> {
  return request('/v1/me/notifications/summary', notificationSummaryResponseSchema);
}

export async function readNotification(
  notificationId: string
): Promise<NotificationSummaryResponse> {
  return request(
    `/v1/me/notifications/${notificationId}/read`,
    notificationSummaryResponseSchema,
    { method: 'POST' }
  );
}

export async function readAllNotifications(): Promise<NotificationSummaryResponse> {
  return request('/v1/me/notifications/read-all', notificationSummaryResponseSchema, {
    method: 'POST',
  });
}

/** 내가 낸 자료. 결제인증·가격제보·후기가 종류를 달고 한 목록에 선다. */
export async function listMyReports(): Promise<MyReportListResponse> {
  return request('/v1/me/reports', myReportListResponseSchema);
}

/**
 * 업체 반론 등록.
 *
 * **여기서 게시되지 않는다.** 사람이 확인한 뒤에 후기 옆에 붙는다 — 요청 타입에
 * 상태를 정할 자리가 없는 것이 그 사실을 말해준다.
 */
export async function createRebuttal(body: CreateRebuttalRequest): Promise<{ rebuttalId: string }> {
  return request('/v1/rebuttals', z.object({ rebuttalId: z.string() }), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listMyRebuttals(): Promise<RebuttalListResponse> {
  return request('/v1/me/rebuttals', rebuttalListResponseSchema);
}

export async function updateRebuttal(
  rebuttalId: string,
  body: UpdateRebuttalRequest
): Promise<void> {
  await request(`/v1/rebuttals/${rebuttalId}`, z.null(), {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function removeRebuttal(rebuttalId: string): Promise<void> {
  await request(`/v1/rebuttals/${rebuttalId}`, z.null(), { method: 'DELETE' });
}

/*
 * ---------------------------------------------------------------------------
 * 업체 관계자 인증 (최종통합정책 v2.0 26·27번)
 * ---------------------------------------------------------------------------
 */

/**
 * 업체 관계자 인증 신청.
 *
 * **여기서 확인되지 않는다.** 이메일 도메인이 맞아떨어져도 담당자가 그 주소로
 * 연락해 확인한 뒤에야 관계자가 된다 — 요청 타입에 상태를 정할 자리가 없는 것이
 * 그 사실을 말해준다.
 */
export async function createVendorClaim(
  body: CreateVendorClaimRequest
): Promise<{ claimId: string }> {
  return request('/v1/vendor-claims', z.object({ claimId: z.string() }), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listMyVendorClaims(): Promise<VendorClaimListResponse> {
  return request('/v1/me/vendor-claims', vendorClaimListResponseSchema);
}

/*
 * ---------------------------------------------------------------------------
 * 이벤트 보상 (최종통합정책 v2.0 I장)
 * ---------------------------------------------------------------------------
 */

/**
 * 최종 결정. v3.2 §6.
 *
 * Pick한 곳 중에서만 정할 수 있다. 다시 부르면 그 업종의 결정이 바뀐다 —
 * 마음이 바뀌는 일이라 되돌릴 수 없게 두지 않는다.
 */
export async function decideCategory(
  weddingId: string,
  body: DecideCategoryRequest
): Promise<void> {
  await request(`/v1/weddings/${weddingId}/decisions`, z.null(), {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * 비교했다는 사실을 남긴다. 미션 ③이 이 기록을 본다.
 *
 * 실패해도 부르는 쪽을 막지 않는다 — 미션 체크 하나 때문에 비교 화면이 오류로
 * 바뀌면 잃는 것이 더 크다.
 */
export async function recordComparison(weddingId: string, category: string): Promise<void> {
  await request(`/v1/weddings/${weddingId}/comparisons`, z.null(), {
    method: 'POST',
    body: JSON.stringify({ category }),
  });
}

export async function removeDecision(weddingId: string, category: string): Promise<void> {
  await request(`/v1/weddings/${weddingId}/decisions/${category}`, z.null(), { method: 'DELETE' });
}

export async function getMyRewards(): Promise<MyRewardsResponse> {
  return request('/v1/me/rewards', myRewardsResponseSchema);
}

/**
 * 초대 코드 넣기.
 *
 * **여기서 보상이 생기지 않는다.** 결제내역을 처음 등록할 때 초대한 분의 조건이
 * 찬다 — 가입만으로 돈을 주면 가입만 하는 계정이 모인다(v2.0 K-7).
 */
export async function redeemReferral(code: string): Promise<void> {
  await request('/v1/referrals/redeem', z.null(), {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function submitPromotion(url: string): Promise<{ promotionId: string }> {
  return request('/v1/promotions', z.object({ promotionId: z.string() }), {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

/*
 * ---------------------------------------------------------------------------
 * 설정 (디자인 핸드오프 19번)
 * ---------------------------------------------------------------------------
 */

export async function getSettings(): Promise<Settings> {
  return request('/v1/me/settings', settingsSchema);
}

export async function updateSettings(body: UpdateSettingsRequest): Promise<Settings> {
  return request('/v1/me/settings', settingsSchema, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/** 결제인증 동의. 최초 1회만 — 두 번 눌러도 한 번만 남는다. */
export async function grantPaymentConsent(): Promise<Settings> {
  return request('/v1/me/payment-consent', settingsSchema, { method: 'POST' });
}

export async function revokePaymentConsent(): Promise<Settings> {
  return request('/v1/me/payment-consent', settingsSchema, { method: 'DELETE' });
}
