import {
  MASKED_IDENTIFIER_KINDS,
  PAYMENT_METHODS,
  PAYMENT_PROOF_CLAIM_SOURCES,
  PAYMENT_PROOF_FIELDS,
  PAYMENT_PROOF_REVIEW_STATES,
} from '@weddingpick/domain';
import { z } from 'zod';

import { amountSchema, idSchema, timestampSchema } from './common';

export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export const maskedIdentifierKindSchema = z.enum(MASKED_IDENTIFIER_KINDS);
export const paymentProofFieldSchema = z.enum(PAYMENT_PROOF_FIELDS);
export const paymentProofReviewStateSchema = z.enum(PAYMENT_PROOF_REVIEW_STATES);
export const paymentProofClaimSourceSchema = z.enum(PAYMENT_PROOF_CLAIM_SOURCES);

/**
 * 결제인증 등록 — **사진 한 장.**
 *
 * 디자인 핸드오프 v3.24가 제보를 «사진 찍기 또는 업로드»로 압축했다. 확인 화면
 * (WP-RPT-004)·업체 확인(WP-RPT-005)·분할 묶기(WP-RPT-006)·증빙 없는 가격 입력
 * (WP-RPT-010)이 전부 폐기됐고, 모든 금액은 사진 한 장에서만 나온다.
 *
 * 그래서 **금액·업체·날짜를 받지 않는다.** 받을 자리가 없으니 앱이 지어낸 값을
 * 보낼 수도, 서버가 그것을 믿을 수도 없다. 읽는 것은 서버가 하고, 못 읽으면
 * 「못 읽었다」가 그대로 남는다(`pending_review`).
 *
 * 이름이 "등록"인 것은 그대로다. 인증 심사(`createVerificationRequest`)와 다른
 * 경로다 — 사람이 보지 않고, 문서 등급을 올리지 않는다.
 *
 * **식별정보를 받을 필드가 없다.** 카드번호를 보낼 곳이 없고, 이미지에 무엇이
 * 찍혀 있었는지는 서버가 읽어 종류만 남긴다.
 */
export const registerPaymentProofRequestSchema = z.object({
  /** 올린 원본. 이것 하나가 사용자의 행동 전부다. */
  rawDocumentId: idSchema,
  /** 어느 업체인지 이미 알고 들어왔으면(업체 상세에서 시작한 경우). */
  vendorId: idSchema.optional(),
});

export const registerPaymentProofResponseSchema = z.object({
  paymentProofId: idSchema,
  /**
   * 접수 상태. **「접수 안 됨」이 없다** — 사진을 올렸으면 접수는 된 것이다.
   *
   *   accepted        읽기가 끝나 금액 구간·지출·Unlock에 들어갔다
   *   pending_review  접수는 됐고 검수를 기다린다. 아직 어디에도 들어가지 않는다
   */
  status: paymentProofReviewStateSchema,
  /** 검수를 기다리는 칸. accepted면 빈 배열이다. */
  pendingFields: z.array(paymentProofFieldSchema),
  /** 왜 기다리는지. 화면이 그대로 보여준다. accepted면 null. */
  reviewNote: z.string().nullable(),
  /** 읽어낸 값. 못 읽었으면 null이다 — 지어내지 않는다. */
  merchantName: z.string().nullable(),
  paidAmount: amountSchema.nullable(),
  paidAt: timestampSchema.nullable(),
  method: paymentMethodSchema,
  /** 이미지에 있었던 식별정보의 **종류**. 값이 아니다. */
  maskedIdentifiers: z.array(maskedIdentifierKindSchema),
  /** 업체를 찾았는지. 못 찾으면 통계에도 Unlock에도 쓰이지 않는다. */
  matchedVendorId: idSchema.nullable(),
  /** 못 찾았을 때 무엇을 해야 하는지. 찾았으면 null. */
  unmatchedNote: z.string().nullable(),
  /**
   * 이 등록으로 조건이 비슷한 사례를 볼 수 있게 됐는지.
   *
   * 실제 결제 구간이 열린 것이 아니다 — 그건 등록 전에도 보였다(v2.0 K-6).
   */
  deepData: z.boolean(),
  /** 원본을 언제까지 들고 있는지. 화면이 그대로 보여준다. */
  originalDeletedBy: timestampSchema.nullable(),
});

/**
 * 검수를 기다리는 내 제보에서 **못 읽은 칸만** 직접 적는다. WP-RPT-004 「직접 입력」.
 *
 * 등록(`registerPaymentProofRequestSchema`)은 그대로 **사진 한 장**이다. 이 계약은
 * 그 뒤에 오는 자리다 — 사진은 이미 냈고, 기계가 못 읽은 줄에만 열린다. 폐기된
 * WP-RPT-010(증빙 없는 가격 입력)과 갈리는 자리가 여기다: **증빙 없이는 이 요청을
 * 보낼 대상 자체가 없다.**
 *
 * **모든 칸이 optional인 것이 요점이다.** 무엇을 물을지는 서버가 정한다
 * (`pendingFields`). 앱이 읽어낸 칸까지 보내오면 서버가 거절한다 — 기계가 읽은 값을
 * 사람이 덮어쓰는 길을 열면 「기계가 읽은 값」이라는 말이 그때부터 거짓이 된다.
 *
 * **지불 수단을 받을 자리가 없다.** `pending_fields`에 오지 않는 칸이라(0150) 물을
 * 일이 없고, 받을 곳을 만들어두면 언젠가 채워 보내는 화면이 생긴다.
 *
 * **적었다고 반영되지 않는다.** 이 요청이 성공해도 줄은 `pending_review`에 그대로
 * 머무르고, 운영자가 확인해야 쓰인다. 기준금액은 실 제보의 중앙값이라, 확인 안 된
 * 값이 그 계산에 들어가면 「실 제보」라는 말 자체가 거짓이 된다.
 */
export const claimPaymentProofFieldsRequestSchema = z.object({
  merchantName: z.string().trim().min(1).max(120).optional(),
  paidAmount: amountSchema.optional(),
  paidAt: timestampSchema.optional(),
});

export const claimPaymentProofFieldsResponseSchema = z.object({
  paymentProofId: idSchema,
  /**
   * 여전히 `pending_review`다. **여기에 `accepted`가 올 수 없다** — 사람이 적은 값은
   * 운영자 확인을 거쳐야 하고, 그 확인은 이 요청 안에서 일어나지 않는다.
   */
  status: z.literal('pending_review'),
  /** 이번에 사람이 적은 칸. 나머지는 자료에서 읽은 값 그대로다. */
  claimedFields: z.array(paymentProofFieldSchema),
  /** 누가 적었는가. 이 경로에서는 늘 제보한 본인이다. */
  claimedSource: paymentProofClaimSourceSchema,
  /** 다음에 무엇이 일어나는지. 화면이 그대로 보여준다. */
  reviewNote: z.string(),
});

/**
 * 업체의 결제인증 분포. **최종통합정책 v2.0 C장·D-1의 4단계 사다리.**
 *
 * 잠금은 없다. v2.0 K-6이 "결제인증 회원만 실제 결제 데이터 접근"을 폐기했고,
 * 실제 결제 구간은 비회원도 본다 — 결제인증이 여는 것은 접근이 아니라 깊이다.
 *
 * 계약 중앙값(`products`)·수기 제보(`reportedPrice`)와 **세 번째 자리**다. 셋을
 * 한 배열에 넣지 않는 이유는 근거가 셋 다 다르기 때문이다 — 사람이 심사한 계약,
 * 기계가 읽은 결제내역, 그냥 적어준 숫자.
 *
 * **단계가 곧 타입이다.** `median`은 `detailed`에만 있고 구간은 `collecting`에
 * 없다 — 필드를 비워 보내면 화면이 0원이나 빈칸을 그릴 여지가 남고, 언젠가 어느
 * 화면이 그렇게 그린다.
 */
const disclosedRange = {
  count: z.int().positive(),
  /** 데이터 수와 기준 기간. 금액 옆에 반드시 함께 적는다(원문 16번). */
  caption: z.string().min(1),
  low: amountSchema,
  high: amountSchema,
};

export const paidPriceSchema = z.discriminatedUnion('stage', [
  z.object({
    stage: z.literal('collecting'),
    count: z.int().nonnegative(),
    caption: z.string().min(1),
  }),
  z.object({ stage: z.literal('limited'), ...disclosedRange }),
  z.object({ stage: z.literal('normal'), ...disclosedRange }),
  z.object({ stage: z.literal('detailed'), ...disclosedRange, median: amountSchema }),
]);

export type RegisterPaymentProofRequest = z.infer<typeof registerPaymentProofRequestSchema>;
export type RegisterPaymentProofResponse = z.infer<typeof registerPaymentProofResponseSchema>;
export type PaidPrice = z.infer<typeof paidPriceSchema>;
export type PaymentProofReviewState = z.infer<typeof paymentProofReviewStateSchema>;
export type ClaimPaymentProofFieldsRequest = z.infer<typeof claimPaymentProofFieldsRequestSchema>;
export type ClaimPaymentProofFieldsResponse = z.infer<typeof claimPaymentProofFieldsResponseSchema>;
