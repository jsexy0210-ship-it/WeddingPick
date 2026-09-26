import type { WeddingEvent, WeddingTask } from '@weddingpick/api-contract';
import { TASK_PRESETS, daysUntil } from '@weddingpick/domain';

import { TENTATIVE_META, tentativePlanItems } from '@/features/home/schedule-view';

import type { TimelinePlan } from './timeline-groups';

/** 서버가 아직 할 일을 못 돌려줬을 때 쓰는 기본 열셋 — 서버가 새 웨딩에 심는 목록과 같다. */
const PRESET_LABELS: readonly string[] = TASK_PRESETS.map((preset) => preset.label);

function sameTitle(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

/**
 * 웨딩노트 «웨딩일정» 타임라인에 일정과 함께 세울 할 일 줄 — WP-NOTE-001
 * (`docs/design/React_Native/note.js` `tlGroups`: 「드레스 투어 3곳 예약하기」 · 「웨딩홀 계약금
 * 입금」처럼 할 일이 일정 사이에 같은 모양으로 선다).
 *
 * 2026-09-26 대표 지시 — 일정 항목을 전부 예식일에서 역산한 **임시 샘플**로 보여 준다.
 * 홈과 같은 `tentativePlanItems` · `tentativeDueDate`를 쓰고, 표시만 한다(저장하지 않는다).
 * 줄에는 홈과 같은 「예식일 기준 임시 날짜」를 단다.
 *
 * 진짜 날짜가 이긴다:
 *   - 날짜를 넣은 할 일은 임시 날짜 대신 그 날짜로 선다(메타는 업체 이름, 없으면 빈 칸)
 *   - 같은 이름의 일정(직접 추가한 일정)이 있으면 그 할 일 줄은 세우지 않는다 — 일정이 이미 그 자리다
 *   - 끝낸 할 일과 이미 지난 날짜는 세우지 않는다
 *
 * `tasks`가 null이면 아직 못 읽은 것이다 — 서버가 새 웨딩에 심는 기본 열셋으로 대신 보여 준다.
 */
export function notePlanEntries(
  tasks: readonly WeddingTask[] | null,
  events: readonly WeddingEvent[],
  weddingDate: string | null,
  now: Date = new Date()
): TimelinePlan[] {
  const taken = (label: string) => events.some((event) => sameTitle(event.title, label));

  const dated: TimelinePlan[] = (tasks ?? [])
    .filter((task) => task.dueDate !== null && task.state !== 'done' && !taken(task.label))
    .filter((task) => daysUntil(task.dueDate!, now) >= 0)
    .map((task) => ({
      id: task.id,
      date: task.dueDate!,
      title: task.label,
      meta: task.vendorLabel ?? '',
      tentative: false,
      editable: true,
    }));

  /*
   * 기본 열셋으로 대신하는 것은 할 일을 **못 읽었을 때(null)**뿐이다. 읽었는데 비었으면 사용자가
   * 다 지운 것이다(2026-09-26 수정 · 삭제) — 그 자리에 기본 줄을 다시 세우면 지운 것이 되살아난다.
   * 대신 세운 기본 줄은 서버에 행이 없어 고치거나 지울 수 없다(`editable: false`).
   */
  const tentative: TimelinePlan[] = tentativePlanItems(tasks ?? [], weddingDate, now, {
    fallbackLabels: tasks === null ? PRESET_LABELS : [],
  })
    .filter((item) => !taken(item.label))
    .map((item) => ({
      id: item.id,
      date: item.due,
      title: item.label,
      meta: TENTATIVE_META,
      tentative: true,
      editable: tasks !== null,
    }));

  return [...dated, ...tentative];
}
