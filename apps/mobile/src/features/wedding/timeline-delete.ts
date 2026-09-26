import { removeWeddingEvent, removeWeddingTask } from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';

import { ourWedding as copy } from '../../../../../spec/strings.ko.json';

/**
 * 웨딩일정 타임라인에서 지울 수 있는 것 둘 — 일정(`wedding_events` · 직접 넣은 일정과 상담 일정)과
 * 할 일(`wedding_tasks` · 날짜를 넣은 할 일과 예식일 기준 임시 날짜 줄).
 */
export type TimelineTarget = { kind: 'event' | 'task'; id: string; title: string };

/** 수정 시트 주소 — 일정 추가 시트(WP-NOTE-002 `events/new`)를 값이 채워진 채 연다. */
export function timelineEditHref(weddingId: string, target: TimelineTarget, date?: string): string {
  const query =
    target.kind === 'event'
      ? `eventId=${encodeURIComponent(target.id)}`
      : `taskId=${encodeURIComponent(target.id)}${date ? `&date=${date}` : ''}`;
  return `/wedding/${weddingId}/events/new?${query}`;
}

/**
 * 타임라인 한 줄 삭제 — 무엇이 지워지는지 OS 확인창으로 한 번 더 묻고 DELETE(2026-09-26 대표 지시).
 * 지출 줄(`confirmDeleteExpense`)과 같은 꼴 · 같은 확인창 도우미(`confirmAlert`)다.
 * 수정 시트 안 «삭제»와 타임라인 줄의 휴지통 아이콘이 같이 쓴다.
 */
export function confirmDeleteTimelineItem({
  weddingId,
  target,
  onStart,
  onDeleted,
  onError,
  onSettled,
}: {
  weddingId: string;
  target: TimelineTarget;
  onStart?: () => void;
  onDeleted: () => void;
  onError: (message: string) => void;
  onSettled?: () => void;
}): void {
  confirmAlert(copy['event.deleteTitle'], copy['event.deleteBody'].replace('{title}', target.title), [
    { text: '취소', style: 'cancel' },
    {
      text: copy['expense.delete'],
      style: 'destructive',
      onPress: () => {
        onStart?.();
        const remove = target.kind === 'event' ? removeWeddingEvent : removeWeddingTask;
        remove(weddingId, target.id)
          .then(onDeleted)
          .catch((caught: Error) => onError(caught.message))
          .finally(() => onSettled?.());
      },
    },
  ]);
}
