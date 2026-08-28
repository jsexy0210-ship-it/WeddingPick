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
  /** 계약금 또는 가계약금. 가계약 검증이 보는 값이다(사업계획서 8번). */
  depositAmount: readValueSchema(z.int().nonnegative()),
  /** 잔금. */
  balanceAmount: readValueSchema(z.int().nonnegative()),
  /** 계약을 맺은 날. YYYY-MM-DD */
  contractDate: readValueSchema(z.string()),
  /** 예식일. 취소 위약금 기준이 이 날짜까지 남은 날로 정해진다. YYYY-MM-DD */
  weddingDate: readValueSchema(z.string()),

  /** 웨딩홀 견적에만 있는 조건. 보증인원과 식대 단가가 총액을 좌우한다. */
  hallName: readValueSchema(z.string()),
  guaranteedGuests: readValueSchema(z.int().positive()),
  mealPricePerPerson: readValueSchema(z.int().nonnegative()),

  /**
   * 패키지 안의 개별 업체. 스드메는 스튜디오·드레스·메이크업이 각각 다른 회사다.
   * 하나로 뭉치면 셋을 따로 비교할 수 없다(사업계획서 19번).
   */
  subVendors: z.array(
    z.object({
      role: z.enum(['studio', 'dress', 'makeup', 'planning', 'snap', 'other']),
      name: z.string(),
      amount: z.int().nonnegative().nullable(),
    })
  ),

  lineItems: z.array(
    z.object({
      kind: z.enum(['included', 'excluded', 'additional_candidate']),
      label: z.string(),
      /** 금액이 하나로 적혀 있을 때. */
      amount: z.int().nonnegative().nullable(),
      /** "150만원 ~ 300만원"처럼 범위로 적혀 있을 때. */
      amountMin: z.int().nonnegative().nullable(),
      amountMax: z.int().nonnegative().nullable(),
      note: z.string().nullable(),
    })
  ),

  terms: z.array(
    z.object({
      category: z.enum(['cancellation', 'refund', 'penalty', 'schedule', 'other']),
      body: z.string(),
      /** 사용자가 특히 확인해야 할 조건인지 */
      flagged: z.boolean(),
      /** "예식일 30일 이내"처럼 시점이 적혀 있으면 남은 날짜. 없으면 null. */
      daysBeforeWedding: z.int().nonnegative().nullable(),
      /** "총액의 50%"처럼 비율이 적혀 있으면 0~1. 계약금만 몰수하는 조항은 null. */
      penaltyRate: z.number().min(0).max(1).nullable(),
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
2. 금액은 원 단위 정수로 옮긴다. "3,280,000원"은 3280000이고 "35만원"은 350000이다.
   "150만원 ~ 300만원"처럼 범위로 적혔으면 amount는 비우고 amountMin/amountMax에 넣는다.
   "35만원부터"는 amountMin만 채운다.
3. 값마다 confidence를 매긴다. 글자가 흐리거나 여러 해석이 가능하면 낮춘다.
4. 포함 항목, 별도 항목, 나중에 추가될 수 있는 항목을 구분한다.
   "필요 시 추가", "현장 결제" 같은 표현은 additional_candidate다.
5. 취소·환불·위약금·일정 변경 조건은 terms에 원문 그대로 옮긴다.
   사용자가 놓치면 손해를 볼 조건에는 flagged를 true로 한다.
   "예식일 30일 이내 취소 시 총액의 50%"처럼 시점과 비율이 적혀 있으면
   daysBeforeWedding에 30, penaltyRate에 0.5를 함께 넣는다. 구간마다 조항을 나눈다.
6. 계약금(가계약금)과 잔금이 적혀 있으면 depositAmount, balanceAmount에 각각 넣는다.
7. 계약일과 예식일은 다르다. 상담일이나 작성일을 계약일로 옮겨 적지 않는다.
   맺은 날이 적혀 있지 않으면 contractDate는 비운다.
8. 웨딩홀 견적이면 홀 이름, 보증인원, 1인 식대를 채운다.
9. 스튜디오·드레스·메이크업처럼 업체가 여럿인 패키지는 subVendors에 각각 넣는다.
   전체를 대표하는 업체(플래닝 회사 등)는 vendorName에 둔다.
10. 이름·연락처·주소·주민번호·서명 같은 개인정보는 값을 옮기지 말고
    personalInfoKinds에 종류만 적는다.
11. 가격이 적정한지, 비싼지 싼지는 판단하지 않는다. 그건 이 시스템의 다른 부분이 한다.
12. 견적서·계약서가 아니면 documentKind를 not_a_document로 한다.
    글씨를 읽을 수 없으면 unreadable을 true로 한다.`;
