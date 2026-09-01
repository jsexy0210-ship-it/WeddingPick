/**
 * 내 제보 내역. 디자인 핸드오프 20번.
 *
 * 세 가지가 한 목록에 선다. **합치는 것이 아니라 나란히 놓는 것이다** — 종류가
 * 행마다 적히고, 종류마다 쓰임이 다르다는 것도 함께 적힌다. 내가 낸 자료가
 * 무엇에 쓰이는지 모르는 채로 쌓이면, 그건 제보가 아니라 수집이다.
 */

export const REPORT_KINDS = ['payment_proof', 'price_report', 'review'] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];

/**
 * 제보 종류. 사용자 화면(내 제보내역)에 그대로 나간다.
 *
 * 내부 이름(`결제인증`)을 쓰지 않는다. 사용자가 낸 것은 결제내역이고, 인증은
 * 그 뒤에 우리가 하는 일이다. 배지로 나가므로 띄어쓰지 않는다.
 */
export const REPORT_KIND_LABEL: Record<ReportKind, string> = {
  payment_proof: '결제내역',
  price_report: '가격제보',
  review: '후기',
};

/** 이 자료가 어디에 쓰이는지. 화면이 행마다 적는다. */
export const REPORT_KIND_USE: Record<ReportKind, string> = {
  payment_proof: '실제 결제 구간에 들어가고, 원본은 24시간 뒤에 지워져요',
  price_report: '가격 참고 자료로 함께 보여요',
  review: '업체 화면에 후기로 보여요',
};

export const MY_REPORTS_EMPTY = '아직 등록한 내역이 없어요';
export const MY_REPORTS_EMPTY_CTA = '제보하기';
