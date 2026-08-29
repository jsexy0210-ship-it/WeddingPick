import { daysUntil } from './profile';

/**
 * 일정 알림. 최종통합정책 v2.0 36번.
 *
 * > 일정 알림 기본 예: D-7, D-1, 당일
 * > 사용자가 알림을 끄면 발송하지 않는다.
 *
 * **미리 알려주는 것이 요점이지 재촉하는 것이 아니다.** 그래서 지난 일정에는
 * 보내지 않는다 — 이미 지난 것을 알려주는 알림은 알림이 아니라 잔소리다.
 */

/** 며칠 전에 알리는가. 0은 당일이다. */
export const NUDGE_OFFSETS = [7, 1, 0] as const;

export type NudgeOffset = (typeof NUDGE_OFFSETS)[number];

export type Nudge = {
  offset: NudgeOffset;
  title: string;
  body: string;
  /** 같은 알림을 두 번 보내지 않기 위한 열쇠. */
  dedupeKey: string;
};

function say(offset: NudgeOffset): string {
  if (offset === 0) return '오늘이에요';
  if (offset === 1) return '내일이에요';

  return `${offset}일 남았어요`;
}

/**
 * 이 일정에 지금 보낼 알림이 있는가.
 *
 * **딱 그날에만 보낸다.** "7일 이하"로 두면 7·6·5·4·3·2·1일에 매일 가고, 그건
 * 세 번 알리기로 한 것과 다르다.
 *
 * 이미 끝난 일(`done`)에는 보내지 않는다. 사용자가 다 했다고 표시한 것을 두고
 * 알리면, 그 표시를 우리가 안 본다는 뜻이 된다.
 */
export function nudgeFor(
  task: { id: string; label: string; dueDate: string | null; state: string },
  now: Date = new Date()
): Nudge | null {
  if (task.dueDate === null || task.state === 'done') return null;

  const days = daysUntil(task.dueDate, now);
  const offset = NUDGE_OFFSETS.find((candidate) => candidate === days);

  if (offset === undefined) return null;

  return {
    offset,
    title: `${task.label} ${say(offset)}`,
    body:
      offset === 0
        ? '오늘 챙기실 일이에요'
        : '웨딩 스케줄에서 날짜와 업체를 확인하실 수 있어요',
    dedupeKey: `task_due:${task.id}:${offset}`,
  };
}

/**
 * 가격 변동 알림. v2.0 37번.
 *
 * > 관심업체의 실제 공개 가격구간이 의미 있게 변경된 경우 발송한다.
 * > 신규 인증 1건이 들어올 때마다 알림을 보내지 않는다.
 */

/** 구간의 허리가 이만큼 움직이면 알린다. **잠정값이다** — 자료가 쌓이면 다시 본다. */
export const MEANINGFUL_SHIFT = 0.05;

export type PriceMark = { stage: string; low: number | null; high: number | null };

/**
 * 알릴 만한 변화인가.
 *
 * 두 가지만 알린다:
 * 1. **수집 중이던 업체에 구간이 생겼다.** 못 보던 것을 보게 된 것이라 그 자체가 소식이다
 * 2. 구간의 허리가 5% 넘게 움직였다
 *
 * 반대로 구간이 사라지는 일(12개월 창 밖으로 밀려남)은 알리지 않는다 — 사용자가
 * 할 수 있는 일이 없고, "가격을 볼 수 없게 됐어요"는 나쁜 소식이기만 하다.
 */
export function isMeaningfulPriceChange(before: PriceMark, after: PriceMark): boolean {
  const hadRange = before.low !== null && before.high !== null;
  const hasRange = after.low !== null && after.high !== null;

  if (!hasRange) return false;
  if (!hadRange) return true;

  const middle = (mark: PriceMark) => (mark.low! + mark.high!) / 2;
  const from = middle(before);

  if (from === 0) return true;

  return Math.abs(middle(after) - from) / from >= MEANINGFUL_SHIFT;
}

export function priceChangeNudge(input: {
  vendorId: string;
  vendorName: string;
  caption: string;
  /** YYYY-MM-DD. 하루 최대 1회를 이 값이 지킨다. */
  today: string;
  appeared: boolean;
}): { title: string; body: string; dedupeKey: string } {
  return {
    title: input.appeared
      ? `${input.vendorName}의 실제 결제를 볼 수 있어요`
      : `${input.vendorName}의 결제 구간이 바뀌었어요`,
    body: input.caption,
    // v2.0 37번: 동일 업체 하루 최대 1회.
    dedupeKey: `price:${input.vendorId}:${input.today}`,
  };
}
