import type { WeddingTask } from '@weddingpick/api-contract';
import { TASK_PRESETS, daysUntil, formatCount } from '@weddingpick/domain';

import strings from '../../../../../spec/strings.ko.json';

const S = strings.home;

/**
 * 홈 「웨딩일정」 섹션.
 *
 * 정본: `docs/design/html/대메뉴_홈(로그인, 온보딩).dc.html` WP-HOME-001 §11 `schedule`
 * (날짜가 있는 일정 최대 3건) · WP-HOME-002/003 `defaultSchedule`(아직 날짜가 없을 때
 * 번호 매긴 다섯 줄).
 *
 * 옛 구현은 이 섹션 자체가 없었다(정본 대조표 `hdiffs` — 「다가오는 일정 · 홈에
 * 일정이 없었다」). 데이터는 웨딩노트가 이미 쓰는 `GET /v1/weddings/:id/tasks`를
 * 그대로 부른다 — 새 API를 만들지 않는다. 서버가 첫 조회에서 기본 열넷을 깔아 주므로
 * (`seedPresets`) 갓 시작한 사람도 빈 목록이 아니라 기본 줄이 뜬다.
 */
const SCHEDULE_ROWS_MAX = 3;
const DEFAULT_ROWS_MAX = 5;

export type ScheduleRow =
  | { kind: 'dated'; id: string; month: string; day: string; title: string; meta: string; dday: string; near: boolean }
  | { kind: 'preset'; id: string; num: number; title: string; meta: string };

const DATED_META_FALLBACK = '';

function monthDay(dateIso: string): { month: string; day: string } {
  const [, month, day] = dateIso.split('-').map(Number);
  return { month: `${month}월`, day: String(day).padStart(2, '0') };
}

/** Hero의 D-day 표기와 같은 규칙 — 0이면 D-DAY, 지났으면 +. */
function ddayLabel(daysLeft: number): string {
  if (daysLeft === 0) return 'D-DAY';
  return `D${daysLeft > 0 ? '-' : '+'}${formatCount(Math.abs(daysLeft))}`;
}

function taskMeta(task: WeddingTask): string {
  return task.vendorLabel ?? task.stateLabel ?? DATED_META_FALLBACK;
}

/**
 * 날짜가 있는(마감이 아직 안 지난) 일정 최대 3건 — 가까운 순. 없으면 빈 배열이라
 * 화면이 `defaultSchedule` 방식(번호 매긴 기본 줄)으로 대신한다.
 */
export function datedScheduleRows(tasks: readonly WeddingTask[], now: Date = new Date()): ScheduleRow[] {
  return tasks
    .filter((task) => task.dueDate !== null && task.state !== 'done')
    .map((task) => ({ task, daysLeft: daysUntil(task.dueDate!, now) }))
    .filter((row) => row.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, SCHEDULE_ROWS_MAX)
    .map(({ task, daysLeft }, index) => {
      const { month, day } = monthDay(task.dueDate!);
      return {
        kind: 'dated' as const,
        id: task.id,
        month,
        day,
        title: task.label,
        meta: taskMeta(task),
        dday: ddayLabel(daysLeft),
        near: index === 0,
      };
    });
}

const NO_DATE_META = S['schedule.noDate'];

/** 날짜 있는 일정이 하나도 없을 때 — 서버 순서(TASK_PRESETS 순) 그대로 다섯 줄. */
export function presetScheduleRows(tasks: readonly WeddingTask[]): ScheduleRow[] {
  const labels =
    tasks.length > 0 ? tasks.map((task) => task.label) : TASK_PRESETS.map((preset) => preset.label);

  return labels.slice(0, DEFAULT_ROWS_MAX).map((label, index) => ({
    kind: 'preset' as const,
    id: `schedule-preset-${index}`,
    num: index + 1,
    title: label,
    meta: NO_DATE_META,
  }));
}

export function scheduleRows(tasks: readonly WeddingTask[], now: Date = new Date()): ScheduleRow[] {
  const dated = datedScheduleRows(tasks, now);
  return dated.length > 0 ? dated : presetScheduleRows(tasks);
}
