import type { WeddingEvent } from '@weddingpick/api-contract';
import { daysUntil } from '@weddingpick/domain';

/**
 * 웨딩노트 캘린더의 주 단위 흐름 — `docs/design/React_Native/note.jsx` frame-001 WP-NOTE-001.
 *
 * 「월 격자를 폐기하고 예식일까지 주 단위 흐름으로 바꿨다」는 정본 문구를 그대로
 * 옮긴다. 지난 일정은 이 모듈이 아니라 화면이 따로 접어 보여준다 — 여기는 **오늘
 * 이후** 일정만 묶는다.
 */

export type TimelineItem = { event: WeddingEvent; kind: 'event' } | { event: null; kind: 'wedding'; date: string };

export type TimelineGroup = {
  title: string;
  range: string;
  items: TimelineItem[];
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

/**
 * 월요일 시작 — 정본 `note.js` `tlGroups`의 「다음 주 9.28~10.4」 · 「10.5~10.11」이 월~일이다.
 */
function weekStart(date: Date): Date {
  return addDays(startOfDay(date), -((date.getDay() + 6) % 7));
}

function monthDay(date: Date): string {
  return `${date.getMonth() + 1}.${date.getDate()}`;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * 오늘 이후 일정을 이번 주 · 다음 주 · 그 뒤는 달 단위로 묶고, 예식일을 항상
 * 마지막 한 줄로 덧붙인다. 예식일이 이미 지났거나(`weddingOver`) 없으면 그 줄은
 * 만들지 않는다 — 그 경우는 화면이 애초에 이 컴포넌트를 쓰지 않는다.
 */
export function buildUpcomingTimelineGroups(
  events: readonly WeddingEvent[],
  weddingDate: string | null,
  now: Date = new Date()
): TimelineGroup[] {
  const today = startOfDay(now);
  const future = events
    .filter((event) => new Date(event.startsAt) >= today)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const thisWeekStart = weekStart(today);
  const thisWeekEnd = addDays(thisWeekStart, 6);
  const nextWeekStart = addDays(thisWeekStart, 7);
  const nextWeekEnd = addDays(thisWeekStart, 13);

  const thisWeek: WeddingEvent[] = [];
  const nextWeek: WeddingEvent[] = [];
  const laterByMonth = new Map<string, { anchor: Date; items: WeddingEvent[] }>();

  for (const event of future) {
    const startsAt = new Date(event.startsAt);
    // 끝날(일요일) 0시가 아니라 다음 주 시작과 비교한다 — 일요일 낮 일정이 다음 주로 넘어가지 않게.
    if (startsAt < nextWeekStart) {
      thisWeek.push(event);
    } else if (startsAt < addDays(thisWeekStart, 14)) {
      nextWeek.push(event);
    } else {
      const anchor = startOfDay(startsAt);
      const key = `${anchor.getFullYear()}-${anchor.getMonth()}`;
      const bucket = laterByMonth.get(key);
      if (bucket) bucket.items.push(event);
      else laterByMonth.set(key, { anchor, items: [event] });
    }
  }

  const groups: TimelineGroup[] = [];
  const ddayAt = (date: Date) => (weddingDate !== null ? ` · D-${daysUntil(weddingDate, date)}` : '');

  if (thisWeek.length > 0) {
    groups.push({
      title: '이번 주',
      // 이번 주는 오늘부터 센다 — 정본 「9.22~9.27 · D-236」(9.22가 오늘, D-236은 오늘 기준).
      range: `${monthDay(today)}~${monthDay(thisWeekEnd)}${ddayAt(today)}`,
      items: thisWeek.map((event) => ({ event, kind: 'event' })),
    });
  }

  if (nextWeek.length > 0) {
    groups.push({
      title: '다음 주',
      range: `${monthDay(nextWeekStart)}~${monthDay(nextWeekEnd)}${ddayAt(nextWeekStart)}`,
      items: nextWeek.map((event) => ({ event, kind: 'event' })),
    });
  }

  const laterKeys = [...laterByMonth.entries()].sort((a, b) => a[1].anchor.getTime() - b[1].anchor.getTime());
  for (const [, { anchor, items }] of laterKeys) {
    const sameYear = anchor.getFullYear() === today.getFullYear();
    const dday = weddingDate !== null ? `D-${daysUntil(weddingDate, anchor)} 구간` : '';
    groups.push({
      title: sameYear ? `${anchor.getMonth() + 1}월` : `${anchor.getFullYear()}년 ${anchor.getMonth() + 1}월`,
      range: dday,
      items: items.map((event) => ({ event, kind: 'event' })),
    });
  }

  if (weddingDate !== null) {
    const alreadyListed = [...thisWeek, ...nextWeek, ...laterKeys.flatMap(([, bucket]) => bucket.items)].some(
      (event) => dateKey(new Date(event.startsAt)) === dateKey(new Date(`${weddingDate}T00:00:00`))
    );
    if (!alreadyListed) {
      groups.push({ title: '예식', range: '', items: [{ event: null, kind: 'wedding', date: weddingDate }] });
    }
  }

  return groups;
}
