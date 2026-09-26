import { MAX_CANDIDATE_NOTE_LENGTH, PREPARATION_STATES } from '@weddingpick/domain';
import { z } from 'zod';

import { amountSchema, idSchema, timestampSchema, vendorCategorySchema } from './common';
import { expenseBucketSchema } from './wedding-plan';

/**
 * 담아둔 업체 한 줄.
 *
 * 가격은 없다. 목록에 가격을 실으면 Level 3 잠금을 우회하는 길이 생기고, 무엇보다
 * 후보 목록은 "무엇을 견주는 중인가"를 보는 자리지 값을 보는 자리가 아니다.
 *
 * **별점은 다르다**(v3.28 2026-09-23 「후기 별점 UI를 되살린다」). 가격과 달리 별점은
 * 검색 결과·업체상세에서 이미 공개된 값이라 여기 싣는다고 잠금을 우회하는 길이 생기지
 * 않는다. 화면 대조표(`docs/design/screen-inventory.md` 「평가 지표」)가 정본으로
 * 못 박았다 — 「5점 별점 + 실 제보 12건, 별점은 3축 답변과 함께 병행」. 값의 근거는
 * `search`/`vendors`와 같은 관문(`structured.scored_reviews`, `summaryRating`)이다 —
 * 목록마다 문턱이 다르면 같은 업체가 한 화면엔 뜨고 한 화면엔 안 뜨는 일이 생긴다.
 */
export const vendorCandidateSchema = z.object({
  id: idSchema,
  vendorId: idSchema,
  vendorName: z.string().min(1),
  category: vendorCategorySchema,
  region: z.string().min(1),
  /** 승인된 대표 이미지. 없으면 null — 카테고리 기본으로 대체한다. */
  imageUrl: z.string().nullable(),
  note: z.string().nullable(),
  addedAt: timestampSchema,
  /** 배우자가 담았는지. 상대가 마음에 들어 한 곳인지 알아야 이야기가 된다. */
  addedByPartner: z.boolean(),
  /** 확인된 후기가 모자라거나 체크리스트 업종(결정사)이면 null — 그때 카드는 별점 줄을 안 그린다. */
  rating: z.object({ average: z.number().min(0).max(5), count: z.int().positive() }).nullable(),
});

export const createCandidateRequestSchema = z.object({
  vendorId: idSchema,
  note: z.string().trim().max(MAX_CANDIDATE_NOTE_LENGTH).optional(),
});

/**
 * 후보 목록.
 *
 * 업종별로 나눠 내려간다. 서른 곳을 한 줄로 늘어놓으면 무엇을 견주는 중인지
 * 보이지 않는다. `comparable`은 그 업종에 두 곳 이상이 있어 비교를 시작할 수
 * 있다는 뜻이다 — 업종이 섞이면 그 표는 아무것도 말하지 않는다.
 */
export const candidateListResponseSchema = z.object({
  groups: z.array(
    z.object({
      category: vendorCategorySchema,
      categoryLabel: z.string().min(1),
      candidates: z.array(vendorCandidateSchema),
      comparable: z.boolean(),
      /** 준비 전 / 후보 Pick 중 / 결정 완료. v3.2 §7. */
      state: z.enum(PREPARATION_STATES),
      stateLabel: z.string().min(1),
      /** 최종 결정한 곳. 안 정했으면 null. */
      decidedVendorId: idSchema.nullable(),
    })
  ),
  total: z.int().nonnegative(),
  /** 몇 곳까지 담을 수 있는지. 화면이 남은 자리를 말할 수 있어야 한다. */
  limit: z.int().positive(),
  /**
   * 업종 몇 개를 정했는지. `1/9 완료` 꼴.
   *
   * 분모는 업종 수다 — 담은 후보 수를 분모로 쓰면 많이 담을수록 진행률이
   * 떨어지고, 그건 열심히 한 사람을 벌주는 셈이다.
   */
  progress: z.object({
    decided: z.int().nonnegative(),
    total: z.int().positive(),
    label: z.string().min(1),
  }),
  /** 다음에 무엇을 준비하면 좋은지. 다 정했으면 null — 없는 다음을 지어내지 않는다. */
  nextCategory: vendorCategorySchema.nullable(),
  /**
   * 업체 없이 이름으로만 정한 곳(0440 · 2026-09-26 대표 지시 「직접입력하는 방법 고안하라」).
   * 후보가 아니라서 `groups`에 없다 — Pick은 이것을 그 묶음의 «결정» 카드로 그리되 업체
   * 상세 · 상담 예약으로 잇지 않는다(이을 업체가 없다). 옛 서버는 이 칸을 안 보낸다 — 빈 배열로 읽는다.
   */
  manualDecisions: z
    .array(
      z.object({
        category: vendorCategorySchema,
        categoryLabel: z.string().min(1),
        name: z.string().min(1),
        decidedAt: timestampSchema,
        /** 배우자가 정했는지. */
        decidedByPartner: z.boolean(),
      })
    )
    .default([]),
});

/** 최종 결정. 어느 업종을 어느 곳으로 정하는지. */
export const decideCategoryRequestSchema = z.object({
  category: vendorCategorySchema,
  vendorId: idSchema,
});

export type DecideCategoryRequest = z.infer<typeof decideCategoryRequestSchema>;

/** 비교했다는 사실. 업종별로 남긴다. */
export const recordComparisonRequestSchema = z.object({
  category: vendorCategorySchema,
});

export type RecordComparisonRequest = z.infer<typeof recordComparisonRequestSchema>;

/**
 * 결정한 업체. WP-OUR-003.
 *
 * 결정정보 · 관련 일정 · 관련 지출을 한 덩어리로 내려준다 — 화면이 세 번 부르지
 * 않는다. 관련 일정은 그 업체(vendor_id)로 잡힌 일정만이다. 관련 지출은 업체가
 * 아니라 **업종**으로 묶는다 — 지출 표에는 vendor_id가 없어서(bucketFor) 업체
 * 단위로는 셀 수 없다.
 */
export const decisionEventSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  startsAt: timestampSchema,
  location: z.string().nullable(),
});

export const decisionExpenseSummarySchema = z.object({
  bucket: expenseBucketSchema,
  bucketLabel: z.string().min(1),
  paidTotal: amountSchema,
  paidCount: z.int().nonnegative(),
  scheduledTotal: amountSchema,
  scheduledCount: z.int().nonnegative(),
});

export const decisionDetailSchema = z.object({
  category: vendorCategorySchema,
  categoryLabel: z.string().min(1),
  vendor: z.object({
    id: idSchema,
    name: z.string().min(1),
    region: z.string().min(1),
  }),
  decidedAt: timestampSchema,
  /** 배우자가 정했는지. */
  decidedByPartner: z.boolean(),
  events: z.array(decisionEventSchema),
  expenses: decisionExpenseSummarySchema,
});

export const decisionListResponseSchema = z.object({
  decisions: z.array(decisionDetailSchema),
});

export type VendorCandidate = z.infer<typeof vendorCandidateSchema>;
export type CreateCandidateRequest = z.infer<typeof createCandidateRequestSchema>;
export type CandidateListResponse = z.infer<typeof candidateListResponseSchema>;
export type ManualDecision = CandidateListResponse['manualDecisions'][number];
export type DecisionEvent = z.infer<typeof decisionEventSchema>;
export type DecisionExpenseSummary = z.infer<typeof decisionExpenseSummarySchema>;
export type DecisionDetail = z.infer<typeof decisionDetailSchema>;
export type DecisionListResponse = z.infer<typeof decisionListResponseSchema>;
