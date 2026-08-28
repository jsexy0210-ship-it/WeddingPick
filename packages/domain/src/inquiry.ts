/**
 * 문의 창구.
 *
 * 여러 화면이 "알려주세요", "확인해보세요"라고 말해왔다. 정작 받을 곳이 없으면 그 말은
 * 지키지 않을 약속이다. 여기서 무엇을 받고, 받은 뒤에 무엇을 약속하는지 정한다.
 */

export const INQUIRY_CATEGORIES = [
  'vendor_objection',
  'planner_delisting',
  'data_correction',
  'analysis_error',
  'privacy',
  'other',
] as const;

export type InquiryCategory = (typeof INQUIRY_CATEGORIES)[number];

export type InquiryCategoryRule = {
  label: string;
  /** 이 항목을 고를 때 화면에 붙는 설명 */
  description: string;
  /** 무엇에 대한 문의인지 반드시 가리켜야 하는지 */
  requiresSubject: boolean;
};

export const INQUIRY_CATEGORY_RULES: Record<InquiryCategory, InquiryCategoryRule> = {
  vendor_objection: {
    label: '업체 이의 제기',
    description: '업체로서 견적·계약 자료나 정리된 내용에 이의가 있습니다.',
    requiresSubject: false,
  },
  planner_delisting: {
    label: '플래너 노출 중단',
    description: '검색에 나오는 것을 원하지 않습니다. 내려드리고 다시 올리지 않습니다.',
    requiresSubject: true,
  },
  data_correction: {
    label: '업체 정보 정정',
    description: '업체 이름·지역 같은 정보가 실제와 다릅니다.',
    requiresSubject: false,
  },
  analysis_error: {
    label: '분석 결과가 다릅니다',
    description: '정리된 내용이 원본 문서와 다릅니다.',
    requiresSubject: false,
  },
  privacy: {
    label: '개인정보',
    description: '내 정보 열람·정정·삭제를 요청합니다.',
    requiresSubject: false,
  },
  other: {
    label: '그 밖의 문의',
    description: '위에 해당하지 않는 이야기입니다.',
    requiresSubject: false,
  },
};

export const INQUIRY_STATUSES = ['received', 'in_review', 'answered', 'closed'] as const;

export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  received: '접수됨',
  in_review: '확인 중',
  answered: '답변 완료',
  closed: '종료',
};

/**
 * 접수 후 며칠 안에 답하는지.
 *
 * **아직 정해지지 않았다** (서비스정책서 미확정 항목 "반론 접수 후 처리 영업일 기준").
 * 정해지기 전에는 날짜를 약속하지 않는다 — 지키지 못할 기한을 적어두는 것보다
 * 아직 정하지 못했다고 말하는 편이 낫다.
 */
export const INQUIRY_RESPONSE_BUSINESS_DAYS: number | null = null;

/** 접수 확인 문구. 기한이 정해지면 그 기한을 함께 말한다. */
export function inquiryAcknowledgement(
  responseBusinessDays: number | null = INQUIRY_RESPONSE_BUSINESS_DAYS
): string {
  if (responseBusinessDays === null) {
    return '접수했습니다. 사람이 직접 확인하고 알려드립니다. 며칠 안에 답한다는 기준은 아직 정하지 못했습니다.';
  }

  return `접수했습니다. 사람이 직접 확인하고 영업일 기준 ${responseBusinessDays}일 안에 알려드립니다.`;
}

/** 문의를 접수해도 되는지. 서버와 앱이 같은 규칙을 본다. */
export function canSubmitInquiry(input: {
  category: InquiryCategory;
  body: string;
  hasSubject: boolean;
  /** 로그인했거나 회신처를 적었거나 */
  hasReplyRoute: boolean;
}): boolean {
  if (input.body.trim().length === 0 || !input.hasReplyRoute) {
    return false;
  }

  return !INQUIRY_CATEGORY_RULES[input.category].requiresSubject || input.hasSubject;
}
