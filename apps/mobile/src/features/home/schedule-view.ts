import type { WeddingTask } from '@weddingpick/api-contract';
import { daysUntil, formatCount, tentativeDueDate } from '@weddingpick/domain';

import strings from '../../../../../spec/strings.ko.json';

const S = strings.home;

/**
 * 홈 「웨딩일정」 섹션.
 *
 * 정본: `docs/design/React_Native/home.jsx` WP-HOME-001 §11 `schedule`
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
/**
 * 할 일이 하나도 없을 때 보여 주는 기본 순서 — 정본 문구 그대로다
 * (`docs/design/React_Native/home.js` WP-HOME-002 · 003 `defaultSchedule`). 서버가 새 웨딩에
 * 심는 `TASK_PRESETS`(웨딩노트 체크리스트)와는 다른 목록이다 — 홈은 «무엇부터 하나»를 짧게
 * 안내하고, 체크리스트는 전부를 담는다.
 */
const HOME_DEFAULT_ORDER = ['상견례 날짜 정하기', '웨딩홀 계약금 입금', '스드메 예약', '청첩장 인쇄', '신혼여행 예약'] as const;

export function presetScheduleRows(tasks: readonly WeddingTask[]): ScheduleRow[] {
  const labels =
    tasks.length > 0 ? tasks.map((task) => task.label) : [...HOME_DEFAULT_ORDER];

  return labels.slice(0, DEFAULT_ROWS_MAX).map((label, index) => ({
    kind: 'preset' as const,
    id: `schedule-preset-${index}`,
    num: index + 1,
    title: label,
    meta: NO_DATE_META,
  }));
}

const TENTATIVE_META = S['schedule.tentative'];

/**
 * 날짜를 넣은 일정이 하나도 없을 때 — 기본 줄에 예식일에서 역산한 **임시 날짜**를 붙인다
 * (2026-09-25 대표 지시 「기본 날짜는 결혼식 예정일을 역산해서 임시로 넣어놓는다」).
 * 저장하지 않고 보여 줄 때만 계산한다(`tentativeDueDate`). 이미 지난 날짜는 빼고, 남은 것을
 * 가까운 순으로 최대 다섯 줄. 예식일을 모르거나 남는 줄이 없으면 빈 배열 — 번호 줄로 대신한다.
 */
export function tentativeScheduleRows(
  tasks: readonly WeddingTask[],
  weddingDate: string | null,
  now: Date = new Date()
): ScheduleRow[] {
  if (weddingDate === null) return [];
  const labels = tasks.length > 0
    ? tasks.filter((task) => task.state !== 'done').map((task) => ({ id: task.id, label: task.label }))
    : HOME_DEFAULT_ORDER.map((label, index) => ({ id: `schedule-preset-${index}`, label }));

  return labels
    .map((item) => ({ item, due: tentativeDueDate(weddingDate, item.label) }))
    .filter((row): row is { item: { id: string; label: string }; due: string } => row.due !== null)
    .map((row) => ({ ...row, daysLeft: daysUntil(row.due, now) }))
    .filter((row) => row.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, DEFAULT_ROWS_MAX)
    .map(({ item, due, daysLeft }, index) => {
      const { month, day } = monthDay(due);
      return {
        kind: 'dated' as const,
        id: item.id,
        month,
        day,
        title: item.label,
        meta: TENTATIVE_META,
        dday: ddayLabel(daysLeft),
        near: index === 0,
      };
    });
}

export function scheduleRows(
  tasks: readonly WeddingTask[],
  now: Date = new Date(),
  weddingDate: string | null = null
): ScheduleRow[] {
  const dated = datedScheduleRows(tasks, now);
  if (dated.length > 0) return dated;
  const tentative = tentativeScheduleRows(tasks, weddingDate, now);
  return tentative.length > 0 ? tentative : presetScheduleRows(tasks);
}
