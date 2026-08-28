import { withSubject } from './korean';
import type { VendorCategory } from './vendor';
import type { VerificationLevel } from './verification';
import { isAtLeast } from './verification';

/**
 * 이용 후기.
 *
 * 후기는 이 서비스에서 가격 다음으로 조작 압력이 센 자리다. 광고비로 노출은 살 수
 * 있어도 평가는 살 수 없다(서비스정책서 5번). 그래서 규칙을 코드 관례가 아니라
 * 타입과 스키마에 둔다.
 */

/**
 * 누가 쓴 후기인가. 사업계획서 17번.
 *
 * 같은 예식장을 두고도 보는 것이 다르다. 계약자는 가격과 응대를 알고, 하객은
 * 주차·교통·식사를 안다. 합쳐 버리면 둘 다 흐려진다.
 */
export const REVIEWER_ROLES = ['contractor', 'couple', 'guest'] as const;

export type ReviewerRole = (typeof REVIEWER_ROLES)[number];

export const REVIEWER_ROLE_LABEL: Record<ReviewerRole, string> = {
  contractor: '계약자',
  couple: '신랑·신부',
  guest: '하객',
};

/**
 * 업종마다 평가 항목이 다르다. 사업계획서 17·19번.
 *
 * "별점 다섯 개"만 받으면 무엇이 좋았는지 나쁘았는지가 사라진다. 웨딩홀에서
 * 중요한 것과 스튜디오에서 중요한 것은 겹치지 않는다.
 */
export type ReviewAspect = { key: string; label: string };

export const REVIEW_ASPECTS: Partial<Record<VendorCategory, readonly ReviewAspect[]>> = {
  hall: [
    { key: 'food_taste', label: '음식 맛' },
    { key: 'food_menu', label: '메뉴 구성' },
    { key: 'food_temperature', label: '음식 온도' },
    { key: 'crowding', label: '연회장 혼잡' },
    { key: 'staff', label: '직원 응대' },
    { key: 'parking', label: '주차' },
    { key: 'transport', label: '교통' },
    /*
     * 계약자만 답한다.
     *
     * 사업계획서 1번이 꼽은 문제가 이것이다 — 견적서의 금액과 실제로 낸 금액이
     * 다르다. 그런데 그걸 아는 사람은 계약한 사람뿐이고, 하객은 짐작밖에 할 수
     * 없다. 아래 GUEST_ANSWERABLE이 이 항목을 빼는 이유다.
     */
    { key: 'extra_cost', label: '추가비용 사전안내' },
  ],
  sdm: [
    { key: 'result', label: '결과물' },
    { key: 'shooting', label: '촬영' },
    { key: 'retouch', label: '보정' },
    { key: 'fitting', label: '피팅' },
    { key: 'condition', label: '상태' },
    { key: 'response', label: '요청 반영' },
    { key: 'extra_cost', label: '추가비용' },
  ],
  planner_agency: [
    { key: 'response', label: '응대' },
    { key: 'extra_cost', label: '추가비용 사전안내' },
    { key: 'schedule', label: '일정 관리' },
  ],
};

export function aspectsFor(category: VendorCategory): readonly ReviewAspect[] {
  return REVIEW_ASPECTS[category] ?? [];
}

/**
 * 하객이 답할 수 있는 항목.
 *
 * 하객은 계약 조건이나 추가비용을 모른다. 모르는 것을 물으면 짐작으로 채우고,
 * 그 짐작이 점수가 된다. 사업계획서 17번이 하객을 "주차+교통+식사 데이터의 중요
 * 생산자"라고 한 것은 그 셋을 안다는 뜻이지 전부를 안다는 뜻이 아니다.
 */
const GUEST_ANSWERABLE = new Set([
  'food_taste',
  'food_menu',
  'food_temperature',
  'crowding',
  'staff',
  'parking',
  'transport',
]);

export function aspectsForRole(
  category: VendorCategory,
  role: ReviewerRole
): readonly ReviewAspect[] {
  const all = aspectsFor(category);

  return role === 'guest' ? all.filter((aspect) => GUEST_ANSWERABLE.has(aspect.key)) : all;
}

/** 별점 범위. 0은 "답하지 않음"이 아니라 값이 없는 것이고, 아예 넣지 않는다. */
export const MIN_RATING = 1;
export const MAX_RATING = 5;

export function isValidRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= MIN_RATING && rating <= MAX_RATING;
}

/**
 * 후기의 확인 단계.
 *
 * 견적·계약 문서와 같은 생각이다 — 확인되지 않은 것을 지우지 않고, 확인된 것과
 * 구분해서 보여준다. 혼톡이 "인증 없이 등록"을 두는 것과 같은 이유다.
 *
 * 다만 **이용점수에는 확인된 후기만 들어간다.** 누구나 쓸 수 있는 글이 업체
 * 점수를 움직이면 그 점수는 사고팔 수 있는 것이 된다(서비스정책서 5번).
 */
export const REVIEW_VERIFICATION = ['unverified', 'receipt', 'contract'] as const;

export type ReviewVerification = (typeof REVIEW_VERIFICATION)[number];

export const REVIEW_VERIFICATION_LABEL: Record<ReviewVerification, string> = {
  unverified: '미인증',
  receipt: '영수증 확인',
  contract: '계약 확인',
};

/** 이용점수에 들어가는 후기인지. */
export function countsTowardScore(verification: ReviewVerification): boolean {
  return verification !== 'unverified';
}

/**
 * 이 사용자의 문서로 후기를 계약 확인까지 올릴 수 있는가.
 *
 * 별도의 증빙을 다시 받지 않는다. 이미 인증 심사를 통과한 문서가 있으면 그것이
 * 곧 "이 업체와 실제로 계약했다"는 증거다 — 같은 것을 두 번 확인하게 하면
 * 사람들은 두 번째에서 그만둔다.
 */
export function reviewVerificationFromQuote(
  level: VerificationLevel
): ReviewVerification | null {
  if (isAtLeast(level, 'L3')) return 'contract';
  if (isAtLeast(level, 'L2')) return 'contract';
  if (isAtLeast(level, 'L1')) return 'receipt';

  return null;
}

/**
 * 이용점수를 만들기 위한 최소 표본. **화면데이터구조 스펙 5.5가 정한 값이다.**
 *
 * 표본이 모자라면 만들지 않는다. 가격 중앙값과 같은 규칙이다(사업계획서 9번) —
 * 몇 건으로 만든 점수는 정보가 아니라 소음이고, 업체 하나를 망칠 수도 살릴 수도 있다.
 */
export const MINIMUM_REVIEW_COUNT = 5;

/**
 * 점수가 없을 때 화면이 쓰는 말.
 *
 * 화면데이터구조 스펙 5.5 — 기준에 못 미치면 "데이터 수집 중"으로 적고 **확정 비율을
 * 내보내지 않는다.** 4건에서 계산한 4.5점을 회색으로 흐려 보여주는 것도 안 된다.
 * 흐린 숫자도 숫자고, 사람들은 숫자를 읽는다.
 */
export const COLLECTING_LABEL = '데이터 수집 중';

export type UsageScore =
  | { available: true; average: number; count: number; byAspect: Record<string, number> }
  | { available: false; reason: string; count: number };

export function computeUsageScore(
  reviews: readonly {
    verification: ReviewVerification;
    overall: number;
    aspects: Record<string, number>;
  }[]
): UsageScore {
  // 확인된 것만 센다. 미인증 후기는 화면에 보이되 점수를 움직이지 않는다.
  const counted = reviews.filter((review) => countsTowardScore(review.verification));

  if (counted.length < MINIMUM_REVIEW_COUNT) {
    return {
      available: false,
      reason: `${COLLECTING_LABEL} — 확인된 후기가 ${withSubject(`${MINIMUM_REVIEW_COUNT}건`)} 모여야 점수를 만듭니다.`,
      count: counted.length,
    };
  }

  const mean = (values: number[]) =>
    Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;

  const byAspect: Record<string, number> = {};
  const collected: Record<string, number[]> = {};

  for (const review of counted) {
    for (const [key, value] of Object.entries(review.aspects)) {
      (collected[key] ??= []).push(value);
    }
  }

  for (const [key, values] of Object.entries(collected)) {
    byAspect[key] = mean(values);
  }

  return {
    available: true,
    average: mean(counted.map((review) => review.overall)),
    count: counted.length,
    byAspect,
  };
}

/**
 * 스드메 세 업체의 점수를 하나로 합치지 않는다. 사업계획서 19번.
 *
 * 스튜디오는 좋았고 드레스는 나빴던 경험을 3.5점 하나로 만들면, 다음 사람은 그
 * 둘 중 무엇이 문제였는지 알 수 없다. 패키지로 계약했더라도 업체는 셋이다.
 */
export function canMergeScores(vendorIds: readonly string[]): boolean {
  return vendorIds.length <= 1;
}

/** 후기를 쓸 수 있는 최소 길이. 한 줄짜리는 다음 사람에게 아무것도 주지 않는다. */
export const MINIMUM_BODY_LENGTH = 50;

export type ReviewDraft = {
  overall: number;
  body: string;
  role: ReviewerRole;
};

export type ReviewCheck = { ok: true } | { ok: false; reason: string };

export function canSubmitReview(draft: ReviewDraft): ReviewCheck {
  if (!isValidRating(draft.overall)) {
    return { ok: false, reason: '별점을 선택해 주세요.' };
  }

  if (draft.body.trim().length < MINIMUM_BODY_LENGTH) {
    return {
      ok: false,
      reason: `${MINIMUM_BODY_LENGTH}자 이상 적어주세요. 짧은 글은 다음 분에게 도움이 되지 않습니다.`,
    };
  }

  return { ok: true };
}

/**
 * 신고 사유. 읽는 사람이 고르는 것이라 목록이 짧아야 한다.
 *
 * "기타"를 두는 것은 목록이 완전하지 않다는 것을 인정하는 것이다. 없으면
 * 사람들은 가장 비슷해 보이는 것을 고르고, 그러면 통계가 거짓이 된다.
 */
export const REPORT_REASONS = [
  'false_content',
  'abusive',
  'spam',
  'personal_info',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  false_content: '허위·거짓 내용',
  abusive: '욕설·비방',
  spam: '광고·스팸',
  personal_info: '개인정보 노출',
  other: '기타',
};

/**
 * 후기 게시 상태.
 *
 * 업체가 이의를 제기하면(서비스정책서 6번) 사람이 확인하는 동안 내려둔다.
 * 내려두는 것과 지우는 것은 다르다 — 확인 결과 문제가 없으면 다시 올라간다.
 */
export const REVIEW_STATUSES = ['published', 'under_objection', 'removed'] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  published: '게시됨',
  under_objection: '이의 확인 중',
  removed: '내려감',
};

/** 화면에 보이는 후기인지. 이의 확인 중인 글은 보이지 않는다. */
export function isVisible(status: ReviewStatus): boolean {
  return status === 'published';
}

/**
 * 임시조치 기간의 상한. **법이 정한 값이다.**
 *
 * 정보통신망법 제44조의2 — 권리침해를 주장하는 사람이 소명하여 삭제를 요청하면
 * 사업자는 지체 없이 필요한 조치를 하고, 침해 여부를 판단하기 어렵거나 다툼이
 * 예상되면 **30일 이내**로 접근을 임시 차단할 수 있다.
 *
 * 이 숫자를 우리가 정하지 않는 것이 중요하다. 길게 잡으면 업체가 이의만 제기해도
 * 불리한 후기를 오래 지울 수 있고, 그건 반론권이 아니라 검열이 된다. 짧게 잡으면
 * 확인할 시간이 모자란다. 법이 정한 상한을 그대로 쓴다.
 */
export const OBJECTION_HOLD_MAX_DAYS = 30;

export type ObjectionHold = { until: Date; maxDays: number };

/** 이의가 접수된 후기를 언제까지 내려둘 수 있는지. */
export function objectionHoldUntil(receivedAt: Date): ObjectionHold {
  return {
    until: new Date(receivedAt.getTime() + OBJECTION_HOLD_MAX_DAYS * 24 * 60 * 60 * 1000),
    maxDays: OBJECTION_HOLD_MAX_DAYS,
  };
}

/**
 * 임시조치 기간이 지났는데 결론이 없으면 다시 올린다.
 *
 * 결론을 못 냈다는 이유로 계속 내려두면, 이의 제기가 곧 삭제가 된다. 기간이
 * 지나면 원래 자리로 돌아가고, 지우려면 그때는 결론을 내야 한다.
 */
export function shouldRestore(input: { status: ReviewStatus; holdUntil: Date | null; now: Date }): boolean {
  return (
    input.status === 'under_objection' &&
    input.holdUntil !== null &&
    input.now >= input.holdUntil
  );
}

/**
 * 후기 화면에 늘 함께 나가는 말.
 *
 * 가격 비교에 "금액만으로는 비교하기 어렵다"를 붙이는 것과 같은 이유다. 후기는
 * 한 사람의 경험이고, 우리는 그것이 사실인지 판단하지 않는다.
 */
export const REVIEW_CAVEAT =
  '후기는 작성한 분의 경험이며 웨딩픽이 사실 여부를 확인하지 않습니다. 확인된 후기는 그 분이 실제로 이용했다는 것까지만 확인한 것입니다.';

/**
 * 신고 접수 문구.
 *
 * 문의와 같은 규칙이다 — 정해지지 않은 기한을 약속하지 않는다. 그리고 "내려갑니다"라고
 * 말하지 않는다. 신고만으로 글이 내려가면 그건 신고가 아니라 삭제 버튼이다.
 */
export function reviewReportAcknowledgement(): string {
  return '신고를 접수했습니다. 사람이 직접 확인하고 알려드립니다. 신고만으로 글이 내려가지는 않습니다.';
}

/**
 * 이 사람이 지금 후기를 쓰면 어디까지 확인되는지, 그 이유.
 *
 * 쓰기 **전에** 보여주려고 만든다. 다 쓰고 나서 "미인증입니다"라고 하면 그건 통보고,
 * 그 자리에서 사람들은 글을 지운다.
 */
export function verificationNote(verification: ReviewVerification): string {
  switch (verification) {
    case 'contract':
      return '인증을 마친 계약 문서가 있어 계약 확인으로 올라갑니다. 증빙을 다시 올리지 않으셔도 됩니다.';
    case 'receipt':
      return '인증을 마친 결제 내역이 있어 영수증 확인으로 올라갑니다. 계약서를 인증하시면 계약 확인이 됩니다.';
    case 'unverified':
      return '이 업체의 인증된 문서가 없어 미인증으로 올라갑니다. 후기는 그대로 보이지만 업체 점수에는 들어가지 않습니다.';
  }
}
