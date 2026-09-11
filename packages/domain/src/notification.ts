/**
 * 알림함. 디자인 핸드오프 20번.
 *
 * **푸시와 다른 것이다.** 푸시는 지나가고 알림함은 남는다. 푸시를 끈 사람도,
 * 알림 권한을 주지 않은 사람도 결과는 볼 수 있어야 한다 — 그래서 알림함이
 * 원본이고 푸시는 사본이다.
 */

import type { PreparationState } from './pick';

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

/**
 * 알림의 주제. 핸드오프 v3.22 SPEC 13.12 «알림 범위».
 *
 * `kind`가 알림함에서 **어떻게 보이는지**라면 `topic`은 **왜 보내는지**다. 일정
 * 알림과 가격 변동 알림은 둘 다 `notice`로 보이지만, 하나는 항상 가고 하나는
 * 진행 중 업종에서만 간다 — 그 차이를 kind에 실으면 알림함 이름이 정책에
 * 끌려다닌다.
 *
 * ```
 * 일정            항상
 * Pick 후보 변화   진행 중 업종만
 * 금액 변경        내가 Pick한 업체만(진행 중 업종)
 * 혜택            진행 중 업종 + 마감 3일 이내만
 * 제보 결과        항상
 * 배우자          항상
 * ```
 */
export const NOTIFICATION_TOPICS = [
  'schedule',
  'pick_candidates',
  'price_change',
  'benefit',
  'verification',
  'partner',
  'other',
] as const;

export type NotificationTopic = (typeof NOTIFICATION_TOPICS)[number];

/** 업종 상태와 무관하게 가는 주제. 하루 한도도 세지 않는다. */
export const NOTIFICATION_TOPICS_ALWAYS = [
  'schedule',
  'verification',
  'partner',
] as const satisfies readonly NotificationTopic[];

/**
 * 진행 중 업종에서만 가는 주제.
 *
 * 결정 완료 업종과 시작 전 업종은 알리지 않는다 — 12업종 전부에서 오면 하루에
 * 여러 번 울린다.
 */
export const NOTIFICATION_TOPICS_IN_PROGRESS_ONLY = [
  'pick_candidates',
  'price_change',
  'benefit',
] as const satisfies readonly NotificationTopic[];

/**
 * 하루 최대 몇 건까지 보내는가. SPEC 13.12 «하루 최대 2건. 일정 알림은 예외입니다».
 *
 * 하루는 사용자가 사는 곳(Asia/Seoul) 기준이다.
 */
export const NOTIFICATION_DAILY_CAP = 2;

export const NOTIFICATION_TIMEZONE = 'Asia/Seoul';

/**
 * 한도를 세지 않는 종류.
 *
 * 제보 결과(`verification`)와 배우자(`partner`)는 항상 간다. 문의 답변·반론
 * 심사도 사용자가 먼저 한 일에 대한 답이라 같은 자리다 — 내가 물어본 것의 답이
 * «오늘은 두 건 다 썼어요»로 막히면 답을 못 받는 것과 같다.
 */
export const NOTIFICATION_CAP_EXEMPT_KINDS = [
  'verification',
  'partner',
  'inquiry',
  'rebuttal',
] as const satisfies readonly NotificationKind[];

/** 이 업종 상태에서 진행 중 업종 전용 알림을 보내는가. 후보를 담고 아직 정하지 않은 동안만이다. */
export function notifiesInState(state: PreparationState): boolean {
  return state === 'picking';
}

/**
 * 이 알림이 업종 상태를 따르는가.
 *
 * 따르면 보내는 쪽이 업종이 진행 중인지 확인해야 하고, 아니면 그냥 보낸다.
 */
export function dependsOnCategoryProgress(topic: NotificationTopic): boolean {
  return (NOTIFICATION_TOPICS_IN_PROGRESS_ONLY as readonly NotificationTopic[]).includes(topic);
}

/**
 * 하루 한도에 세는 알림인가.
 *
 * 종류가 예외거나 주제가 «항상»이면 세지 않는다. 주제를 모르는 알림(`other`)은
 * 센다 — 모르는 것을 예외로 두면 예외가 기본이 된다.
 */
export function isCappedNotification(input: {
  kind: NotificationKind;
  topic: NotificationTopic;
}): boolean {
  if ((NOTIFICATION_CAP_EXEMPT_KINDS as readonly NotificationKind[]).includes(input.kind)) {
    return false;
  }

  return !(NOTIFICATION_TOPICS_ALWAYS as readonly NotificationTopic[]).includes(input.topic);
}

/** 오늘 이미 이만큼 보냈으면 더 보내지 않는다. */
export function reachedDailyCap(sentToday: number): boolean {
  return sentToday >= NOTIFICATION_DAILY_CAP;
}

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

/**
 * 야간 수신을 끈 사람에게 푸시를 생략하는 시간대. AGENTS.md «WP-NOTI-003 야간
 * 수신 끔»(사용자 승인 2026-09-06) — 한국시간 21:00 이상 ~ 다음 날 08:00 미만.
 *
 * 시작은 이상이고 끝은 미만이다. 21:00:00은 조용한 시간이고 08:00:00은 아니다.
 */
export const NOTIFICATION_QUIET_FROM_HOUR = 21;
export const NOTIFICATION_QUIET_UNTIL_HOUR = 8;

/**
 * 이 순간이 한국에서 몇 시인가.
 *
 * **비교는 UTC 순간으로 하되 경계는 KST로 읽는다.** `Date`는 시간대가 없는
 * 순간이고, 21시·8시라는 경계만 한국 시계로 읽으면 된다 — 저장값을 KST로 바꿔
 * 담으면 그때부터 아홉 시간이 어긋난다.
 *
 * 오프셋을 손으로 더하지 않고 시간대 이름으로 읽는다. +9를 코드에 적으면 그
 * 숫자가 맞는지를 읽는 사람이 매번 다시 확인해야 한다.
 */
export function seoulHour(at: Date): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: NOTIFICATION_TIMEZONE,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(at);

  return Number(hour);
}

/**
 * 지금이 야간인가. 야간 수신을 끈 사람에게는 이 동안 푸시를 보내지 않는다.
 *
 * **알림함은 그대로 남는다.** 야간은 «밀어서 알려줄지»를 정하는 값이지 결과를
 * 감추는 값이 아니다 — 그리고 아침이 되어도 밤에 생략한 푸시를 모아 다시
 * 보내지 않는다(AGENTS.md). 아침에 몰아서 울리면 껐다는 말이 무색해진다.
 */
export function isQuietHours(at: Date): boolean {
  const hour = seoulHour(at);

  return hour >= NOTIFICATION_QUIET_FROM_HOUR || hour < NOTIFICATION_QUIET_UNTIL_HOUR;
}
