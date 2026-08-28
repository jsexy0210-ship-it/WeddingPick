import { z } from 'zod';

/**
 * AI가 문서에서 읽어내는 것.
 *
 * 사업계획서 27번 — AI는 읽고 서버가 센다. 그래서 이 스키마에는 시장가격·중앙값·
 * 적정성 판단이 들어갈 자리가 없다. 문서에 적혀 있지 않은 것은 나올 수 없다.
 */

const confidenceSchema = z.number().min(0).max(1);

/** 문서에서 읽은 값 하나와 얼마나 확신하는지. */
const readValueSchema = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value.nullable(),
    confidence: confidenceSchema,
  });

export const extractionSchema = z.object({
  /** 문서가 무엇인지. 견적서·계약서가 아니면 not_a_document. */
  documentKind: z.enum([
    'official_price',
    'quote',
    'pre_contract',
    'revised_quote',
    'contract',
    'additional_charge',
    'final_payment',
    'not_a_document',
  ]),
  documentKindConfidence: confidenceSchema,
  /** 글씨를 읽을 수 없으면 true. 이 경우 나머지는 비어 있어도 된다. */
  unreadable: z.boolean(),

  /** 업체 이름은 문서에 적힌 그대로. 어느 업체인지 확정하는 건 서버 몫이다. */
  vendorName: readValueSchema(z.string()),
  plannerName: readValueSchema(z.string()),
  productName: readValueSchema(z.string()),

  /** 금액은 원 단위 정수. 문서에 없으면 null. */
  totalAmount: readValueSchema(z.int().nonnegative()),
  discountAmount: readValueSchema(z.int().nonnegative()),
  /** YYYY-MM-DD */
  contractDate: readValueSchema(z.string()),

  lineItems: z.array(
    z.object({
      kind: z.enum(['included', 'excluded', 'additional_candidate']),
      label: z.string(),
      amount: z.int().nonnegative().nullable(),
      note: z.string().nullable(),
    })
  ),

  terms: z.array(
    z.object({
      category: z.enum(['cancellation', 'refund', 'penalty', 'schedule', 'other']),
      body: z.string(),
      /** 사용자가 특히 확인해야 할 조건인지 */
      flagged: z.boolean(),
    })
  ),

  /**
   * 문서에서 발견한 개인정보의 종류. 값 자체는 옮겨 적지 않는다.
   * 구조화 데이터에 개인정보가 섞이지 않게 하려는 것이다 — 사업계획서 28번.
   */
  personalInfoKinds: z.array(
    z.enum(['name', 'phone', 'address', 'resident_number', 'signature', 'email', 'account'])
  ),
});

export type Extraction = z.infer<typeof extractionSchema>;

export const EXTRACTION_SYSTEM_PROMPT = `당신은 한국 웨딩 견적서·계약서를 읽는다.

문서에 적힌 것만 옮긴다. 다음을 지켜라.

1. 적혀 있지 않은 값은 null로 둔다. 추측하거나 일반적인 시세로 채우지 않는다.
2. 금액은 원 단위 정수로 옮긴다. "3,280,000원"은 3280000이다. 만원 단위 표기는 원으로 바꾼다.
3. 값마다 confidence를 매긴다. 글자가 흐리거나 여러 해석이 가능하면 낮춘다.
4. 포함 항목, 별도 항목, 나중에 추가될 수 있는 항목을 구분한다.
   "필요 시 추가", "현장 결제" 같은 표현은 additional_candidate다.
5. 취소·환불·위약금·일정 변경 조건은 terms에 원문 그대로 옮긴다.
   사용자가 놓치면 손해를 볼 조건에는 flagged를 true로 한다.
6. 이름·연락처·주소·주민번호·서명 같은 개인정보는 값을 옮기지 말고
   personalInfoKinds에 종류만 적는다.
7. 가격이 적정한지, 비싼지 싼지는 판단하지 않는다. 그건 이 시스템의 다른 부분이 한다.
8. 견적서·계약서가 아니면 documentKind를 not_a_document로 한다.
   글씨를 읽을 수 없으면 unreadable을 true로 한다.`;
