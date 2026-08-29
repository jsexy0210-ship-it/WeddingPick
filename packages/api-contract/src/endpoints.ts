import { z, type ZodType } from 'zod';

import { analysisSchema } from './analyses';
import {
  candidateListResponseSchema,
  createCandidateRequestSchema,
} from './candidates';
import {
  createExpenseRequestSchema,
  createVisitNoteRequestSchema,
  createWeddingTaskRequestSchema,
  expenseSummaryResponseSchema,
  setBudgetRequestSchema,
  updateWeddingTaskRequestSchema,
  visitNoteListResponseSchema,
  weddingTaskListResponseSchema,
} from './wedding-plan';
import { amountSchema, idSchema } from './common';
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
import {
  createInquiryRequestSchema,
  createInquiryResponseSchema,
  inquiryListResponseSchema,
  inquirySchema,
} from './inquiries';
import { registerDeviceRequestSchema, registerDeviceResponseSchema } from './devices';
import {
  parsePaymentTextRequestSchema,
  parsePaymentTextResponseSchema,
  registerPaymentProofRequestSchema,
  registerPaymentProofResponseSchema,
} from './payment-proofs';
import { createPriceReportRequestSchema, createPriceReportResponseSchema } from './price-reports';
import {
  plannerDetailSchema,
  plannerRegionsResponseSchema,
  plannerSearchResponseSchema,
} from './planners';
import { confirmFieldsRequestSchema, quoteListResponseSchema, quoteSchema } from './quotes';
import {
  createReviewReportRequestSchema,
  createReviewReportResponseSchema,
  createReviewRequestSchema,
  createReviewResponseSchema,
  reportReasonListResponseSchema,
  reviewFormSchema,
  reviewListResponseSchema,
} from './reviews';
import {
  vendorComparisonResponseSchema,
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
  acceptInviteRequestSchema,
  completeSetupRequestSchema,
  createInviteResponseSchema,
  createWeddingRequestSchema,
  currentUserSchema,
  invitePreviewResponseSchema,
  weddingDetailSchema,
  weddingInviteListResponseSchema,
} from './weddings';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

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

  /**
   * 이름·예식일 등록. 핸드오프 2번 — 스킵할 수 없는 화면이다.
   *
   * 둘을 한 번에 받는다. 따로 받으면 이름만 넣고 나간 사람의 홈이 이름은 부르는데
   * D-Day가 없는 반쪽이 된다.
   */
  completeSetup: {
    method: 'POST',
    path: '/v1/me/setup',
    body: completeSetupRequestSchema,
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

  /** A-17 업체 비교. ids 쿼리 파라미터에 쉼표로 잇는다. 최대 세 곳. */
  compareVendors: {
    method: 'GET',
    path: '/v1/vendors/compare',
    response: vendorComparisonResponseSchema,
  },

  /** A-17 업체 상세. */
  getVendor: {
    method: 'GET',
    path: '/v1/vendors/{vendorId}',
    response: vendorDetailSchema,
  },

  /**
   * 우리웨딩 — 웨딩 스케줄. 핸드오프 15번.
   *
   * 처음 부르면 서버가 기본 열넷을 깔아준다. 처음 결혼을 준비하는 사람은 무엇을
   * 해야 하는지부터 모른다.
   */
  listWeddingTasks: {
    method: 'GET',
    path: '/v1/weddings/{weddingId}/tasks',
    response: weddingTaskListResponseSchema,
  },

  addWeddingTask: {
    method: 'POST',
    path: '/v1/weddings/{weddingId}/tasks',
    body: createWeddingTaskRequestSchema,
    response: z.object({ taskId: idSchema }),
  },

  /** 보낸 칸만 고친다. `state: null`은 자동 판정으로 되돌린다는 뜻이다. */
  updateWeddingTask: {
    method: 'PATCH',
    path: '/v1/weddings/{weddingId}/tasks/{taskId}',
    body: updateWeddingTaskRequestSchema,
    response: z.object({ ok: z.boolean() }),
  },

  removeWeddingTask: {
    method: 'DELETE',
    path: '/v1/weddings/{weddingId}/tasks/{taskId}',
    response: z.null(),
  },

  /**
   * 우리웨딩 — 지출내역. 핸드오프 14번.
   *
   * `paidTotal`과 `scheduledTotal`이 다른 필드다. 합쳐 보내면 화면이 더할 여지가
   * 남고, 더하면 "지금까지 결제한 금액"이 거짓말이 된다.
   */
  getExpenses: {
    method: 'GET',
    path: '/v1/weddings/{weddingId}/expenses',
    response: expenseSummaryResponseSchema,
  },

  addExpense: {
    method: 'POST',
    path: '/v1/weddings/{weddingId}/expenses',
    body: createExpenseRequestSchema,
    response: z.object({ expenseId: idSchema }),
  },

  /** 직접 입력한 항목만 지워진다. 결제인증에서 온 줄은 404다 — 그건 제보다. */
  removeExpense: {
    method: 'DELETE',
    path: '/v1/weddings/{weddingId}/expenses/{expenseId}',
    response: z.null(),
  },

  setBudget: {
    method: 'PUT',
    path: '/v1/weddings/{weddingId}/budget',
    body: setBudgetRequestSchema,
    response: z.object({ budget: amountSchema.nullable() }),
  },

  /** 우리웨딩 — 방문노트. 제안금액은 가격 통계 어디에도 들어가지 않는다. */
  listVisitNotes: {
    method: 'GET',
    path: '/v1/weddings/{weddingId}/visit-notes',
    response: visitNoteListResponseSchema,
  },

  addVisitNote: {
    method: 'POST',
    path: '/v1/weddings/{weddingId}/visit-notes',
    body: createVisitNoteRequestSchema,
    response: z.object({ noteId: idSchema }),
  },

  removeVisitNote: {
    method: 'DELETE',
    path: '/v1/weddings/{weddingId}/visit-notes/{noteId}',
    response: z.null(),
  },

  /**
   * 담아둔 업체. 사업계획서 v3 8번의 COMPARE.
   *
   * 사람이 아니라 **웨딩**에 매달려 있다 — 배우자가 담은 곳을 내가 보고, 내가
   * 담은 곳을 배우자가 본다.
   */
  listCandidates: {
    method: 'GET',
    path: '/v1/weddings/{weddingId}/candidates',
    response: candidateListResponseSchema,
  },

  addCandidate: {
    method: 'POST',
    path: '/v1/weddings/{weddingId}/candidates',
    body: createCandidateRequestSchema,
    response: z.object({ candidateId: idSchema }),
  },

  /** 빼기. 배우자가 담은 것도 뺄 수 있다 — 함께 고르는 것이라서. */
  removeCandidate: {
    method: 'DELETE',
    path: '/v1/weddings/{weddingId}/candidates/{candidateId}',
    response: z.null(),
  },

  /**
   * A-16 플래너 검색. 공개 근거가 있는 플래너만 나온다 — 견적서에서 읽어낸 이름은
   * 검색에 오르지 않는다.
   */
  searchPlanners: {
    method: 'GET',
    path: '/v1/planners',
    response: plannerSearchResponseSchema,
  },

  /** 플래너 지역 필터 목록. 업체 지역과 다르다 — 플래너가 없는 지역은 뜨지 않는다. */
  listPlannerRegions: {
    method: 'GET',
    path: '/v1/planners/regions',
    response: plannerRegionsResponseSchema,
  },

  getPlanner: {
    method: 'GET',
    path: '/v1/planners/{plannerId}',
    response: plannerDetailSchema,
  },

  /** 문의 접수. 접수만 된다 — 결론은 사람이 낸다 (서비스정책서 6번). */
  createInquiry: {
    method: 'POST',
    path: '/v1/inquiries',
    body: createInquiryRequestSchema,
    response: createInquiryResponseSchema,
  },

  listMyInquiries: {
    method: 'GET',
    path: '/v1/inquiries',
    response: inquiryListResponseSchema,
  },

  getInquiry: {
    method: 'GET',
    path: '/v1/inquiries/{inquiryId}',
    response: inquirySchema,
  },

  /** A-18 배우자 초대. 코드는 이 응답에서 한 번만 내려온다. */
  createWeddingInvite: {
    method: 'POST',
    path: '/v1/weddings/{weddingId}/invites',
    response: createInviteResponseSchema,
  },

  getWeddingInvite: {
    method: 'GET',
    path: '/v1/weddings/{weddingId}/invites',
    response: weddingInviteListResponseSchema,
  },

  /** 받아들이기 전에 무엇에 동의하는지 본다. */
  previewWeddingInvite: {
    method: 'POST',
    path: '/v1/wedding-invites/preview',
    body: acceptInviteRequestSchema,
    response: invitePreviewResponseSchema,
  },

  acceptWeddingInvite: {
    method: 'POST',
    path: '/v1/wedding-invites/accept',
    body: acceptInviteRequestSchema,
    response: z.object({ weddingId: idSchema }),
  },

  /**
   * 후기 쓰기 화면에 필요한 것.
   *
   * 물어볼 항목과 이 사람이 받게 될 확인 단계를 **쓰기 전에** 내려준다. 다 쓰고
   * 나서 "미인증입니다"라고 하면 그건 통보다.
   */
  getReviewForm: {
    method: 'GET',
    path: '/v1/vendors/{vendorId}/review-form',
    response: reviewFormSchema,
  },

  /**
   * 후기 쓰기. 한 사람이 한 업체에 하나.
   *
   * 확인 단계는 보내지 않는다 — 서버가 이 사람의 인증된 문서를 보고 정한다.
   */
  createReview: {
    method: 'POST',
    path: '/v1/vendors/{vendorId}/reviews',
    body: createReviewRequestSchema,
    response: createReviewResponseSchema,
  },

  /** 업체의 후기와 이용점수. cursor·limit 쿼리 파라미터로 쪽을 넘긴다. */
  listVendorReviews: {
    method: 'GET',
    path: '/v1/vendors/{vendorId}/reviews',
    response: reviewListResponseSchema,
  },

  /** 신고 사유 목록. */
  listReportReasons: {
    method: 'GET',
    path: '/v1/review-report-reasons',
    response: reportReasonListResponseSchema,
  },

  /** 후기 신고. 접수만 된다 — 내릴지는 사람이 정한다. */
  createReviewReport: {
    method: 'POST',
    path: '/v1/reviews/{reviewId}/reports',
    body: createReviewReportRequestSchema,
    response: createReviewReportResponseSchema,
  },

  /**
   * 결제문자에서 값을 읽는다. **AI를 부르지 않는다.**
   *
   * 스펙 7.3의 처리 순서 — 규칙 엔진이 먼저다. 결제문자는 카드사가 기계로 찍어
   * 보내는 글이라 형태가 고정돼 있어, 여기서 대부분 읽힌다.
   *
   * 읽기만 하고 저장하지 않는다. 등록은 `registerPaymentProof`가 따로 받는다 —
   * 읽은 값을 사람이 확인한 뒤에 저장돼야 하기 때문이다.
   */
  parsePaymentText: {
    method: 'POST',
    path: '/v1/payment-proofs/parse',
    body: parsePaymentTextRequestSchema,
    response: parsePaymentTextResponseSchema,
  },

  /**
   * 결제인증 등록. 사업계획서 v3 6번.
   *
   * **심사가 아니라 등록이다.** `createVerificationRequest`와 다른 경로다 — 사람이
   * 보지 않고, 문서 등급을 올리지 않으며, 시장 대표가격에도 들어가지 않는다.
   *
   * 카드번호를 받을 필드가 없다. 요청 본문에 그럴 자리를 만들지 않았다.
   */
  registerPaymentProof: {
    method: 'POST',
    path: '/v1/payment-proofs',
    body: registerPaymentProofRequestSchema,
    response: registerPaymentProofResponseSchema,
  },

  /** 내 실제가격 열람 자격. 몇 건 더 내면 열리는지 화면이 말할 수 있어야 한다. */
  getDataUnlock: {
    method: 'GET',
    path: '/v1/me/data-unlock',
    response: z.object({
      unlocked: z.boolean(),
      paymentProofCount: z.int().nonnegative(),
      retentionHours: z.int().positive(),
    }),
  },

  /**
   * 가격 제보. 문서 없이 받는다.
   *
   * 이 값은 시장 대표가격에 들어가지 않는다 — 다른 표에 저장되고 화면에서도
   * 따로 표시된다(서비스정책서 2번).
   */
  createPriceReport: {
    method: 'POST',
    path: '/v1/price-reports',
    body: createPriceReportRequestSchema,
    response: createPriceReportResponseSchema,
  },

  /**
   * 푸시 받을 기기 등록.
   *
   * 등록한다고 알림을 받게 되는 것은 아니다 — 파기 알림은 운영자에게만 가고,
   * 운영자 표시는 사람이 DB에서 직접 켠다. 이 경로로는 어떤 권한도 오르지 않는다.
   */
  registerDevice: {
    method: 'POST',
    path: '/v1/devices',
    body: registerDeviceRequestSchema,
    response: registerDeviceResponseSchema,
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
