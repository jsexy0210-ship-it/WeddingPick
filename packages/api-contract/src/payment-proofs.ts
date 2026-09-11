import {
  MASKED_IDENTIFIER_KINDS,
  PAYMENT_METHODS,
  PAYMENT_PROOF_FIELDS,
  PAYMENT_PROOF_REVIEW_STATES,
} from '@weddingpick/domain';
import { z } from 'zod';

import { amountSchema, idSchema, timestampSchema } from './common';

export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export const maskedIdentifierKindSchema = z.enum(MASKED_IDENTIFIER_KINDS);
export const paymentProofFieldSchema = z.enum(PAYMENT_PROOF_FIELDS);
export const paymentProofReviewStateSchema = z.enum(PAYMENT_PROOF_REVIEW_STATES);

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
