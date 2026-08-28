import { withSubject } from './korean';

/**
 * 파기 일정 알림.
 *
 * 원본을 지우는 것은 사람이 한다(운영 결정). 그러려면 지울 때가 됐다는 것을
 * 사람이 알아야 하고, 알리는 일은 기계가 한다 — 사람이 달력을 보고 있기를
 * 기대하는 것은 절차가 아니다. 서비스정책서 4번의 "알림"에 해당한다.
 */

/**
 * 푸시 본문에 개인정보를 담지 않는다.
 *
 * 푸시는 잠금화면에 뜬다. 폰을 잠깐 든 사람, 어깨너머로 본 사람에게 그대로
 * 읽힌다. 그래서 **건수만** 보낸다 — 누구의 문서인지, 어떤 문서인지, 어떤
 * 개인정보가 담겼는지는 앱을 열고 확인해야 알 수 있다.
 *
 * 이 규칙은 취향이 아니다. 파기해야 할 개인정보를 알리려다 그 개인정보를 다시
 * 흘리면 알림이 문제 자체가 된다.
 */
export type RetentionAlertContent = {
  title: string;
  body: string;
};

export function retentionAlertContent(dueCount: number, overdueDays: number): RetentionAlertContent {
  if (dueCount <= 0) {
    throw new Error('파기할 문서가 없으면 알리지 않는다.');
  }

  const oldest =
    overdueDays <= 0
      ? '오늘이 예정일입니다.'
      : `가장 오래된 것은 예정일이 ${overdueDays}일 지났습니다.`;

  return {
    title: '파기 예정 원본이 있습니다',
    // 건수만. 어떤 문서인지도, 누구 것인지도 담지 않는다.
    body: `원본 ${dueCount}건을 지울 때가 됐습니다. ${oldest}`,
  };
}

/**
 * 지금 알려야 하는가.
 *
 * 같은 말을 반복해서 보내면 사람은 알림을 끈다. 그러면 알림이 있으나 마나가
 * 된다. 그래서 두 경우에만 보낸다.
 *
 * - 지난번에 알린 것보다 일이 늘었다 (새로 예정일이 된 문서가 있다)
 * - 아직 처리되지 않은 채 다시 알릴 때가 됐다
 *
 * 일이 줄어드는 것은 알리지 않는다 — 사람이 지우고 있다는 뜻이라 방해할 이유가 없다.
 */
export type AlertDecision =
  | { send: true; reason: 'first' | 'grew' | 'reminder' }
  | { send: false; reason: 'nothing_due' | 'already_told' };

export function shouldAlert(input: {
  dueCount: number;
  lastAlert: { dueCount: number; sentAt: Date } | null;
  reminderAfterHours: number;
  now: Date;
}): AlertDecision {
  if (input.dueCount <= 0) return { send: false, reason: 'nothing_due' };
  if (!input.lastAlert) return { send: true, reason: 'first' };

  if (input.dueCount > input.lastAlert.dueCount) return { send: true, reason: 'grew' };

  const hoursSince =
    (input.now.getTime() - input.lastAlert.sentAt.getTime()) / (60 * 60 * 1000);

  if (hoursSince >= input.reminderAfterHours) return { send: true, reason: 'reminder' };

  return { send: false, reason: 'already_told' };
}

/**
 * Expo 푸시 토큰인지.
 *
 * 아무 문자열이나 받아두면 보낼 때가 되어서야 실패하고, 그때는 왜 안 갔는지
 * 알기 어렵다. 등록하는 자리에서 거른다.
 */
export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\][\s]+\]$/.test(token.trim());
}

/** 죽은 토큰으로 판단하는 Expo 응답. 이 경우에만 끈다. */
export const DEAD_TOKEN_ERRORS = ['DeviceNotRegistered', 'InvalidCredentials'] as const;

export type DeadTokenError = (typeof DEAD_TOKEN_ERRORS)[number];

export function isDeadTokenError(error: string): error is DeadTokenError {
  return (DEAD_TOKEN_ERRORS as readonly string[]).includes(error);
}

/**
 * 알림이 조용한 것을 안전하다고 읽으면 안 된다.
 *
 * 보관 기간이 정해지지 않으면 retention_until이 비고, 파기 목록도 비고, 알림도
 * 오지 않는다. 그건 "지울 것이 없다"가 아니라 "언제 지울지 아직 정하지 않았다"는
 * 뜻이다 — 원본은 무기한 쌓이고 있다.
 */
export const RETENTION_UNSET_WARNING =
  '보관 기간이 정해지지 않아 파기 일정이 없다. 알림이 오지 않는 것은 지울 것이 없어서가 아니라, 언제 지울지 정하지 않았기 때문이다. 원본은 계속 쌓인다.';

/** 운영자에게 보여줄 요약. 앱을 열었을 때 보는 글이라 개인정보 종류까지 담는다. */
export function retentionSummary(input: {
  dueCount: number;
  attentionCount: number;
}): string {
  const due = `파기 예정 ${input.dueCount}건`;

  if (input.attentionCount === 0) return `${due}.`;

  return `${due}. 그중 ${withSubject(`${input.attentionCount}건`)} 손이 필요하다.`;
}
