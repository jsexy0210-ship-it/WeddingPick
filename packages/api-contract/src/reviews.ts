import {
  CHECKLIST_ANSWERS,
  MAX_RATING,
  MINIMUM_BODY_LENGTH,
  MIN_RATING,
  REPORT_REASONS,
  REVIEWER_ROLES,
  REVIEW_VERIFICATION,
} from '@weddingpick/domain';
import { z } from 'zod';

import { idSchema, timestampSchema } from './common';

export const reviewerRoleSchema = z.enum(REVIEWER_ROLES);
export const checklistAnswerSchema = z.enum(CHECKLIST_ANSWERS);
/** 업체평가를 무엇으로 받는가. 업종이 정한다. */
export const evaluationModeSchema = z.enum(['checklist', 'rating']);
export const reviewVerificationSchema = z.enum(REVIEW_VERIFICATION);
export const reportReasonSchema = z.enum(REPORT_REASONS);

const ratingSchema = z.int().min(MIN_RATING).max(MAX_RATING);

/**
 * 항목 하나의 평가.
 *
 * `key`는 화면에 나가지 않는다 — 앱은 `label`을 그린다. 서버가 이름을 쥐고 있어야
 * 항목이 늘거나 문구가 바뀔 때 앱을 새로 내지 않아도 된다.
 */
export const reviewAspectSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  rating: ratingSchema,
});

/**
 * 결정사 체크리스트 문항 하나.
 *
 * `question`이 실제로 묻는 문장이고 `label`은 결과 화면의 막대 이름이다. 둘을
 * 나눈 이유는 "과도하게 권유받았나요?"를 결과에서 그대로 쓸 수 없기 때문이다.
 */
export const checklistItemSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  question: z.string().min(1),
});

/**
 * 후기 쓰기 화면에 필요한 것.
 *
 * 항목 목록을 앱에 박아두지 않는다. 업종마다 다르고(사업계획서 19번) 작성자
 * 역할마다 다르다 — 하객은 계약 조건이나 추가비용을 모른다. 그 규칙이 도메인에
 * 있으므로 목록도 서버가 만들어 내려준다.
 */
export const reviewFormSchema = z.object({
  vendorId: idSchema,
  vendorName: z.string().min(1),
  /**
   * 업체평가를 무엇으로 받는가. **업종이 정한다.**
   *
   * 결정사는 체크리스트(예/아니오/모름), 나머지는 별점이다. 체크리스트 항목은
   * 결정사 계약에만 있는 것이라 웨딩홀 음식에는 쓸 수 없다.
   */
  evaluationMode: evaluationModeSchema,
  /** `evaluationMode`가 checklist일 때만 채워진다. 역할과 무관하게 같은 문항이다. */
  checklist: z.array(checklistItemSchema),
  /** 고를 수 있는 역할과, 그 역할에게 물을 별점 항목. */
  roles: z.array(
    z.object({
      value: reviewerRoleSchema,
      label: z.string().min(1),
      aspects: z.array(z.object({ key: z.string().min(1), label: z.string().min(1) })),
    })
  ),
  /**
   * 이 사람이 지금 쓰면 어디까지 확인되는지.
   *
   * 쓰기 전에 알려준다. 다 쓰고 나서 "미인증입니다"라고 하면 그건 통보다.
   */
  verification: z.object({
    value: reviewVerificationSchema,
    label: z.string().min(1),
    /** 왜 그 단계인지. 올리는 방법이 있으면 그것도 여기 적는다. */
    note: z.string().min(1),
  }),
  /** 이미 이 업체에 후기를 썼는지. 한 사람이 한 업체에 하나다. */
  alreadyWritten: z.boolean(),
  minimumBodyLength: z.literal(MINIMUM_BODY_LENGTH),
});

/**
 * 후기 쓰기.
 *
 * `verification`을 받지 않는다. 작성자가 자기 후기를 "계약 확인"이라고 말할 수 있으면
 * 그 표시는 아무 뜻이 없다 — 서버가 이 사람의 인증된 문서를 보고 정한다.
 */
export const createReviewRequestSchema = z.object({
  role: reviewerRoleSchema,
  overall: ratingSchema,
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(MINIMUM_BODY_LENGTH).max(4000),
  pros: z.string().trim().max(1000).optional(),
  cons: z.string().trim().max(1000).optional(),
  /** 답한 항목만 보낸다. 답하지 않은 것을 0으로 채우지 않는다. */
  aspects: z
    .array(z.object({ key: z.string().min(1), rating: ratingSchema }))
    .max(20)
    .default([]),
  /**
   * 결정사 체크리스트 응답.
   *
   * `aspects`와 **함께 보낼 수 없다.** 업종이 방식을 정하므로 둘 중 하나만
   * 채워지고, 서버가 그걸 확인한다 — 섞이면 업체평가에 별점 막대와 비율 막대가
   * 나란히 서고, 읽는 사람은 두 숫자가 같은 것을 재는 줄 안다.
   *
   * '모름'도 보낸다. 답하지 않은 것과 모른다고 답한 것은 다르다.
   */
  checklist: z
    .array(z.object({ key: z.string().min(1), answer: checklistAnswerSchema }))
    .max(20)
    .default([]),
});

export const createReviewResponseSchema = z.object({
  reviewId: idSchema,
  verification: reviewVerificationSchema,
  verificationLabel: z.string().min(1),
  /** 무엇이 확인된 것인지 화면이 그대로 보여줄 문구. */
  caveat: z.string().min(1),
});

export const reviewSchema = z.object({
  id: idSchema,
  role: reviewerRoleSchema,
  roleLabel: z.string().min(1),
  overall: ratingSchema,
  title: z.string().min(1),
  body: z.string().min(1),
  pros: z.string().nullable(),
  cons: z.string().nullable(),
  verification: reviewVerificationSchema,
  verificationLabel: z.string().min(1),
  aspects: z.array(reviewAspectSchema),
  createdAt: timestampSchema,
  /** 내가 쓴 글인지. 작성자를 밝히지 않으므로 이것 말고는 알 방법이 없다. */
  mine: z.boolean(),

  /**
   * 업체가 단 반론. **사람이 게시를 결정한 것만 온다**
   * (`structured.published_rebuttals`).
   *
   * 후기를 가리는 대신 옆에 말을 더한다 — 읽는 사람이 양쪽을 다 본다.
   */
  rebuttal: z
    .object({
      claimedRole: z.string().min(1),
      body: z.string().min(1),
      publishedAt: timestampSchema,
    })
    .nullable(),
});

/**
 * 이용점수.
 *
 * 가격 중앙값과 같은 모양이다 — 표본이 모자라면 숫자를 만들지 않고 이유를 준다.
 * **확인된 후기만 센다**(서비스정책서 5번).
 */
export const usageScoreSchema = z.discriminatedUnion('available', [
  z.object({
    available: z.literal(true),
    average: z.number().min(MIN_RATING).max(MAX_RATING),
    count: z.int().positive(),
    /** 별점 업종의 항목별 평균. 1~5. */
    aspects: z.array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        average: z.number().min(MIN_RATING).max(MAX_RATING),
      })
    ),
    /**
     * 체크리스트 업종의 항목별 환산값. 0~100.
     *
     * `aspects`와 **다른 배열이다.** 4.2점과 78%는 다른 것을 재는 숫자이고, 한
     * 배열에 넣으면 화면이 같은 막대로 그린다.
     *
     * `collecting`이면 숫자를 보여주지 않는다 — 표본이 모자란 100%는 정보가 아니다.
     */
    checklist: z.array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        percent: z.number().min(0).max(100),
        answered: z.int().nonnegative(),
        unknown: z.int().nonnegative(),
        collecting: z.boolean(),
        /** 기준 아래라 주의색으로 그릴 항목. */
        needsAttention: z.boolean(),
      })
    ),
    /** 체크리스트 업종에서 화면이 그대로 보여줄 말. 아니면 null. */
    caption: z.string().nullable(),
  }),
  z.object({
    available: z.literal(false),
    reason: z.string().min(1),
    count: z.int().nonnegative(),
  }),
]);

/**
 * 업체의 후기 목록.
 *
 * 단서(caveat)를 목록과 한 응답에 담는다. 따로 받아오게 두면 화면이 글만 그리고
 * "이건 한 사람의 경험"이라는 말을 빠뜨릴 수 있다 — 가격 비교와 같은 이유다.
 */
export const reviewListResponseSchema = z.object({
  reviews: z.array(reviewSchema),
  nextCursor: z.string().nullable(),
  usageScore: usageScoreSchema,
  caveat: z.string().min(1),
});

/** 신고 사유. 목록은 서버가 준다 — 앱에 박아두면 늘릴 때마다 앱을 새로 내야 한다. */
export const reportReasonListResponseSchema = z.object({
  reasons: z.array(z.object({ value: reportReasonSchema, label: z.string().min(1) })),
});

export const createReviewReportRequestSchema = z.object({
  reason: reportReasonSchema,
  note: z.string().trim().max(2000).optional(),
});

/**
 * 신고 접수 응답.
 *
 * `status`가 `'received'` 하나뿐이다. 문의·인증 신청과 같은 이유다 — 신고만으로
 * 글이 내려가는 길을 계약에서 없앤다. 내릴지는 사람이 정한다.
 */
export const createReviewReportResponseSchema = z.object({
  reportId: idSchema,
  status: z.literal('received'),
  receivedAt: timestampSchema,
  acknowledgement: z.string().min(1),
});

export type ChecklistItemView = z.infer<typeof checklistItemSchema>;
export type ReviewForm = z.infer<typeof reviewFormSchema>;
export type CreateReviewRequest = z.infer<typeof createReviewRequestSchema>;
export type CreateReviewResponse = z.infer<typeof createReviewResponseSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type UsageScore = z.infer<typeof usageScoreSchema>;
export type ReviewListResponse = z.infer<typeof reviewListResponseSchema>;
export type ReportReasonListResponse = z.infer<typeof reportReasonListResponseSchema>;
export type CreateReviewReportRequest = z.infer<typeof createReviewReportRequestSchema>;
export type CreateReviewReportResponse = z.infer<typeof createReviewReportResponseSchema>;
