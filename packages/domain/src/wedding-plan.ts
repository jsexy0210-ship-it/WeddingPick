import { formatMonthDayDot } from './profile';
import type { VendorCategory } from './vendor';

/**
 * 웨딩 스케줄. 디자인 핸드오프 15번.
 *
 * 준비할 일을 하나하나 적게 하지 않는다 — 열세 개를 미리 깔아준다. 처음 결혼을
 * 준비하는 사람은 **무엇을 해야 하는지부터 모른다.** 빈 목록을 주고 채우라고 하면
 * 그 목록은 영영 비어 있다.
 */

export const TASK_STATES = ['upcoming', 'in_progress', 'done'] as const;

export type TaskState = (typeof TASK_STATES)[number];

/** 배지는 띄어쓰기 없이. 핸드오프 카피 규칙. */
export const TASK_STATE_LABEL: Record<TaskState, string> = {
  upcoming: '예정',
  in_progress: '진행중',
  done: '완료',
};

export type TaskPreset = { key: string; label: string; category: VendorCategory | null };

/**
 * 기본 열세 개. 핸드오프가 순서까지 정했다. 「결정사 가입」은 2026-09-24 대표 지시로
 * 뺐다 — 웨딩픽은 플래너 없이 누구나 예약하는 서비스라 결정사가 준비 단계가 아니다.
 *
 * 순서는 대개 이 차례로 하기 때문이지 반드시 이래야 해서가 아니다 — 사용자가
 * 날짜를 넣으면 그 날짜순으로 다시 선다.
 */
export const TASK_PRESETS: readonly TaskPreset[] = [
  { key: 'hall_contract', label: '웨딩홀 계약', category: 'hall' },
  { key: 'studio_shoot', label: '스튜디오 촬영일', category: 'studio' },
  { key: 'dress_tour', label: '드레스 투어', category: 'dress' },
  { key: 'makeup_trial', label: '메이크업 시연', category: 'makeup' },
  { key: 'snap_video', label: '본식 스냅·영상', category: 'snap' },
  { key: 'invitation_draft', label: '청첩장 시안', category: 'invitation' },
  { key: 'suit_fitting', label: '예복 맞춤', category: 'goods' },
  { key: 'gifts', label: '예물·예단', category: 'goods' },
  { key: 'honeymoon', label: '신혼여행 예약', category: 'honeymoon' },
  { key: 'marriage_papers', label: '혼인신고 서류', category: null },
  { key: 'guest_list', label: '하객 명단 정리', category: null },
  { key: 'ceremony_order', label: '식순·사회자 확정', category: null },
  { key: 'hall_balance', label: '웨딩홀 잔금 납부', category: 'hall' },
];

/**
 * 날짜를 아직 안 넣은 할 일에 **임시로** 붙이는 날짜 — 예식일에서 며칠 앞인가
 * (2026-09-25 대표 지시 「기본 날짜는 결혼식 예정일을 역산해서 임시로 넣어놓는다」).
 *
 * 저장하지 않는다. 홈이 보여 줄 때만 예식일에서 빼서 계산하고 「예식일 기준 임시 날짜」로
 * 표시한다 — 사용자가 날짜를 넣으면 그 날짜가 이긴다. 값은 흔히 준비하는 순서에 맞춘
 * 기본값이지 규칙이 아니다. 기본 열셋(`TASK_PRESETS`)과 홈 기본 다섯 줄 이름을 함께 담는다.
 */
export const TENTATIVE_DAYS_BEFORE: Readonly<Record<string, number>> = {
  // 홈 기본 다섯 줄(home.js WP-HOME-002 · 003 `defaultSchedule`)
  '상견례 날짜 정하기': 360,
  '웨딩홀 계약금 입금': 300,
  '스드메 예약': 240,
  '청첩장 인쇄': 60,
  // 기본 열셋
  '웨딩홀 계약': 300,
  '본식 스냅·영상': 240,
  '드레스 투어': 180,
  '스튜디오 촬영일': 150,
  '예물·예단': 120,
  '신혼여행 예약': 120,
  '예복 맞춤': 90,
  '청첩장 시안': 75,
  '메이크업 시연': 60,
  '하객 명단 정리': 45,
  '식순·사회자 확정': 30,
  '혼인신고 서류': 14,
  '웨딩홀 잔금 납부': 7,
};

/** `YYYY-MM-DD` 예식일에서 할 일 이름의 임시 날짜를 계산한다. 모르는 이름이면 null. */
export function tentativeDueDate(weddingDate: string, label: string): string | null {
  const daysBefore = TENTATIVE_DAYS_BEFORE[label];
  if (daysBefore === undefined) return null;
  const [year, month, day] = weddingDate.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day - daysBefore));
  return date.toISOString().slice(0, 10);
}

/**
 * 며칠 앞이면 진행중으로 보는가. **핸드오프 15번이 정한 값이다.**
 *
 *   4일 이상 남음 → 예정
 *   3일 이내      → 진행중
 *   지남          → 완료
 */
export const IN_PROGRESS_WITHIN_DAYS = 3;

export type ResolvedState = {
  state: TaskState;
  /** 사용자가 직접 정한 값인가. 화면이 "직접 지정"이라고 적는다. */
  manual: boolean;
};

/**
 * 상태를 정한다.
 *
 * **사용자가 정한 값이 이긴다.** 자동 판정은 날짜만 보고 짐작하는 것이라, 사람이
 * 아니라고 말했으면 그쪽이 맞다. 그래서 화면에 "직접 지정"을 적어 — 이 값은
 * 날짜가 바뀌어도 안 따라간다는 것을 보이게 한다.
 *
 * 날짜가 없으면 자동으로 정할 근거가 없다. 예정으로 둔다.
 */
export function resolveTaskState(input: {
  dueDate: string | null;
  override: TaskState | null;
  now?: Date;
}): ResolvedState {
  if (input.override !== null) {
    return { state: input.override, manual: true };
  }

  if (input.dueDate === null) {
    return { state: 'upcoming', manual: false };
  }

  const now = input.now ?? new Date();
  const [year, month, day] = input.dueDate.split('-').map(Number);
  const target = new Date(year!, month! - 1, day!).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.round((target - today) / (24 * 60 * 60 * 1000));

  /*
   * 지난 날을 '완료'로 본다. 핸드오프가 정한 규칙이다.
   *
   * 짐작인 것은 맞다 — 날이 지났다고 실제로 했는지는 모른다. 다만 사용자가
   * 직접 지정하면 그 값이 이기므로, 틀렸을 때 고칠 방법이 화면에 있다.
   */
  if (days < 0) return { state: 'done', manual: false };

  return {
    state: days <= IN_PROGRESS_WITHIN_DAYS ? 'in_progress' : 'upcoming',
    manual: false,
  };
}

/** `05.16(토)` — 할 일의 날짜. 전역 날짜 표기(v3.21)의 연도 없는 꼴이다. */
export function formatTaskDate(date: string): string {
  return formatMonthDayDot(date);
}

/** `05.16(토) 14:00` — 일정(wedding_events)의 일시 표기. */
export function formatEventDateTime(isoDateTime: string): string {
  const value = new Date(isoDateTime);
  const hh = String(value.getHours()).padStart(2, '0');
  const mm = String(value.getMinutes()).padStart(2, '0');

  return `${formatMonthDayDot(value)} ${hh}:${mm}`;
}

/** 준비 진행률. 홈이 "준비 6 / 14 완료"라고 적는다. */
export function taskProgress(
  tasks: readonly { dueDate: string | null; override: TaskState | null }[],
  now?: Date
): { done: number; total: number } {
  return {
    done: tasks.filter((task) => resolveTaskState({ ...task, now }).state === 'done').length,
    total: tasks.length,
  };
}

/**
 * 다음 일정. 홈 고정 섹션이 쓴다.
 *
 * **아직 오지 않았고 아직 안 한 것 중 가장 가까운 것.**
 *
 * 지난 것을 다음이라고 부르지 않는 것은 당연하지만, **끝낸 것도 다음이 아니다** —
 * 날짜가 앞이어도 이미 했다고 표시한 일을 "다음 일정"이라고 내밀면, 홈이 할 일을
 * 알려주는 자리가 아니라 달력을 읽어주는 자리가 된다.
 */
export function nextTask<T extends { dueDate: string | null; state?: TaskState }>(
  tasks: readonly T[],
  now: Date = new Date()
): T | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const upcoming = tasks
    .filter((task): task is T & { dueDate: string } => task.dueDate !== null)
    .filter((task) => task.state !== 'done')
    .filter((task) => new Date(task.dueDate).getTime() >= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return upcoming[0] ?? null;
}
