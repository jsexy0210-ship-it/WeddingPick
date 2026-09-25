import { INQUIRY_STATUS_LABEL, type InquiryStatus } from '@weddingpick/domain';
import type { BadgeKind, useTheme } from '@weddingpick/ui';

/**
 * 지난 문의 상태 — 문의하기 목록(`my/contact.tsx`)과 문의 상세(`my/contact/[inquiryId].tsx`)가 같이 쓴다.
 * 한 문의가 두 화면에서 다른 말·다른 색으로 보이지 않게 한 곳에 둔다.
 */

/** 정본 pastInquiries state «답변 완료» — 사용자 화면 문구. 도메인 라벨(관리자 공용)은 그대로 둔다. */
export const INQUIRY_STATUS_TEXT: Record<InquiryStatus, string> = {
  received: INQUIRY_STATUS_LABEL.received,
  in_review: INQUIRY_STATUS_LABEL.in_review,
  answered: '답변 완료',
  closed: INQUIRY_STATUS_LABEL.closed,
};

/** 지난 문의 배지 색 — 시안 `p.badge`는 색을 정하지 않는다. 진행/완료/종료를 일반 규칙으로 매핑한다. */
export const INQUIRY_BADGE_KIND: Record<InquiryStatus, BadgeKind> = {
  received: 'wait',
  in_review: 'wait',
  answered: 'ok',
  closed: 'none',
};

/** 정본 badgeS 색 — ok 초록 · warn 주황 · 그 밖 회색. */
export function inquiryBadgeTone(
  theme: ReturnType<typeof useTheme>,
  status: InquiryStatus
): { background: string; text: string } {
  const kind = INQUIRY_BADGE_KIND[status];
  if (kind === 'ok') return { background: theme.positiveBackground, text: theme.positive };
  if (kind === 'wait') return { background: theme.cautionaryBackground, text: theme.cautionary };
  return { background: theme.backgroundSelected, text: theme.textAssistive };
}

/** «8월 12일» — 정본 pastInquiries date. */
export function inquiryMonthDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}
