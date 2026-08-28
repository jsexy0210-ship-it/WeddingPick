import type { MaskedIdentifierKind, PaymentMethod } from '@weddingpick/domain';

/** 읽어달라고 넘기는 이미지 한 장. */
export type ProofImage = { mimeType: string; bytes: Buffer };

/**
 * 이미지에서 읽어낸 것.
 *
 * **파서(payment-parser.ts)와 같은 모양이다.** 규칙으로 읽든 모델로 읽든 뒤쪽
 * 코드가 같은 것을 받아야, 어느 쪽으로 읽었는지에 따라 화면이 달라지지 않는다.
 *
 * 여기에도 카드번호를 담을 자리가 없다. 모델이 읽더라도 나올 곳이 없다.
 */
export type ProofReading = {
  merchantName: string | null;
  paidAmount: number | null;
  /** ISO 8601 */
  paidAt: string | null;
  method: PaymentMethod | null;
  maskedIdentifiers: MaskedIdentifierKind[];
  /** 결제 기록이 아니라고 판단한 이유. 있으면 등록으로 넘기지 않는다. */
  rejection: string | null;
  /** 0~1. 이 값이 낮으면 상위 모델로 올린다(스펙 7.3). */
  confidence: number;
};

export type ProofReadOutcome = {
  reading: ProofReading;
  model: string;
  usage: { inputTokens: number; outputTokens: number; cachedInputTokens: number };
};

/**
 * 결제내역 이미지를 읽는다.
 *
 * 테스트에서는 가짜를 끼운다 — 실제 모델 호출은 돈이 들고 결과가 매번 다르다.
 * 문서 분석(`Analyzer`)과 같은 자리다.
 */
export type PaymentProofReader = {
  read(images: ProofImage[], model: string): Promise<ProofReadOutcome>;
};
