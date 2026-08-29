import { MASKED_IDENTIFIER_KINDS, PAYMENT_METHODS } from '@weddingpick/domain';
import { z } from 'zod';

import { amountSchema, idSchema, timestampSchema } from './common';

export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export const maskedIdentifierKindSchema = z.enum(MASKED_IDENTIFIER_KINDS);

/**
 * 결제인증 등록.
 *
 * 이름이 "등록"인 것이 요점이다. 인증 심사(`createVerificationRequest`)와 다른
 * 경로다 — 사람이 보지 않고, 문서 등급을 올리지 않는다.
 *
 * **식별정보는 종류만 받는다.** 카드번호를 받을 필드가 계약에 없다. 앱이 보내려
 * 해도 보낼 곳이 없고, 서버가 실수로 저장할 수도 없다.
 */
export const registerPaymentProofRequestSchema = z.object({
  /** 영수증에 찍힌 가맹점 이름. 업체명과 다를 수 있어 읽은 그대로 보낸다. */
  merchantName: z.string().trim().min(1).max(120),
  paidAmount: amountSchema,
  paidAt: timestampSchema,
  method: paymentMethodSchema.default('unknown'),
  /** 이미지에 있었던 식별정보의 **종류**. 값이 아니다. */
  maskedIdentifiers: z.array(maskedIdentifierKindSchema).max(10).default([]),
  /** 어느 업체인지 이미 알고 있으면. 없으면 서버가 가맹점 이름으로 찾는다. */
  vendorId: idSchema.optional(),
  /** 촬영한 원본. 분석이 끝나면 24시간 안에 지워진다. */
  rawDocumentId: idSchema.optional(),
  /**
   * 읽어준 값을 받았다면 그 열쇠와, 사람이 고쳤는지.
   *
   * 앱이 알려주는 값이다 — 읽어준 값을 서버가 붙들고 있다가 비교하면 정확하겠지만,
   * 그러려면 사용자가 확인하기도 전의 값을 저장해 둬야 한다. 품질 지표 하나를
   * 정확하게 만들자고 확인 전 값을 보관하지는 않는다.
   */
  readingId: idSchema.optional(),
  readingCorrected: z.boolean().optional(),
});

export const registerPaymentProofResponseSchema = z.object({
  paymentProofId: idSchema,
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
  z.object({ stage: z.literal('early'), ...disclosedRange }),
  z.object({ stage: z.literal('general'), ...disclosedRange }),
  z.object({ stage: z.literal('detailed'), ...disclosedRange, median: amountSchema }),
]);

/**
 * 결제문자 읽기.
 *
 * 화면데이터구조 스펙 7.3: AI를 부르기 전에 규칙으로 먼저 읽는다. 결제문자는
 * 카드사가 기계로 찍어 보내는 글이라 형태가 거의 고정돼 있다.
 *
 * **글만 보낸다.** 이미지가 아니라 사용자가 붙여넣은 글이다 — 붙여넣기는 서버에
 * 이미지를 올리지 않으므로 파기할 원본도 생기지 않는다. 가장 싸고 가장 안전한 길이다.
 */
export const parsePaymentTextRequestSchema = z.object({
  /** 붙여넣은 결제문자. 규칙이 먼저 읽는다. */
  text: z.string().max(2000).optional(),
  /**
   * 촬영한 원본. **규칙이 못 읽었을 때만** 쓰인다.
   *
   * 글로 되는 것을 굳이 사진으로 받지 않는다 — 사진은 올리는 순간 파기할 원본이
   * 생기고, 읽는 값도 더 비싸다.
   */
  rawDocumentId: idSchema.optional(),
});

const parsedFieldSchema = <T extends z.ZodType>(value: T) =>
  z.object({ value, confidence: z.number().min(0).max(1) }).nullable();

export const parsePaymentTextResponseSchema = z.object({
  /** 결제 기록이 아니어서 등록으로 넘기지 않는 이유. 없으면 null. */
  rejection: z.string().nullable(),
  merchantName: parsedFieldSchema(z.string()),
  paidAmount: parsedFieldSchema(amountSchema),
  paidAt: parsedFieldSchema(timestampSchema),
  method: parsedFieldSchema(paymentMethodSchema),
  /** 글에 있었던 식별정보의 **종류**. 값은 담기지 않는다. */
  maskedIdentifiers: z.array(maskedIdentifierKindSchema),
  /** 규칙으로 못 읽은 항목. 화면이 이것만 물어본다. */
  missing: z.array(z.enum(['merchantName', 'paidAmount', 'paidAt', 'method'])),
  /** 확신이 낮아 사람이 봐야 하는 항목. */
  needsConfirmation: z.array(z.enum(['merchantName', 'paidAmount', 'paidAt', 'method'])),
  /**
   * 읽어준 값이 얼마나 맞았는지 나중에 세기 위한 열쇠. 규칙만으로 읽었으면 null.
   *
   * 등록할 때 이 값을 함께 보내면 읽기 정확도가 쌓인다(스펙 7.3의 user_correction_rate).
   */
  readingId: idSchema.nullable(),
  /**
   * 사진에서 읽어드리지 못하는 상태의 안내. 예산이 바닥났을 때 온다.
   *
   * 서비스가 멈추지는 않는다 — 직접 적으면 그대로 등록된다.
   */
  notice: z.string().nullable(),
});

export type ParsePaymentTextRequest = z.infer<typeof parsePaymentTextRequestSchema>;
export type ParsePaymentTextResponse = z.infer<typeof parsePaymentTextResponseSchema>;
export type RegisterPaymentProofRequest = z.infer<typeof registerPaymentProofRequestSchema>;
export type RegisterPaymentProofResponse = z.infer<typeof registerPaymentProofResponseSchema>;
export type PaidPrice = z.infer<typeof paidPriceSchema>;
