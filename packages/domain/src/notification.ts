/**
 * 알림함. 디자인 핸드오프 20번.
 *
 * **푸시와 다른 것이다.** 푸시는 지나가고 알림함은 남는다. 푸시를 끈 사람도,
 * 알림 권한을 주지 않은 사람도 결과는 볼 수 있어야 한다 — 그래서 알림함이
 * 원본이고 푸시는 사본이다.
 */

export const NOTIFICATION_KINDS = [
  'verification',
  'inquiry',
  'rebuttal',
  'partner',
  'notice',
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_KIND_LABEL: Record<NotificationKind, string> = {
  verification: '자료 확인',
  inquiry: '문의 답변',
  rebuttal: '반론 심사',
  partner: '배우자 연결',
  notice: '안내',
};

export type NotificationSummary = {
  unread: number;
  total: number;
};

/**
 * 홈 벨에 빨간 점을 찍을 것인가.
 *
 * 함수 하나로 두는 이유는 홈과 알림함이 같은 답을 내야 해서다. 두 곳에서 각자
 * `unread > 0`을 적으면 언제든 갈라질 수 있고, 그러면 점은 떠 있는데 알림함은
 * 비어 있는 상태가 된다.
 */
export function hasUnread(summary: NotificationSummary): boolean {
  return summary.unread > 0;
}

/** 알림함이 비었을 때. 빈 화면에도 할 말은 있다. */
export const NOTIFICATIONS_EMPTY = '아직 받은 알림이 없어요';
