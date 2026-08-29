import {
  IN_PROGRESS_WITHIN_DAYS,
  TASK_PRESETS,
  TASK_STATE_LABEL,
  formatTaskDate,
  nextTask,
  resolveTaskState,
  taskProgress,
} from './wedding-plan';

const NOW = new Date('2026-09-15T09:00:00+09:00');

/** 오늘로부터 며칠 뒤. */
const at = (days: number) => {
  const date = new Date(2026, 8, 15 + days);

  return date.toISOString().slice(0, 10);
};

describe('상태 자동 판정', () => {
  it('멀면 예정이다', () => {
    expect(resolveTaskState({ dueDate: at(10), override: null, now: NOW })).toEqual({
      state: 'upcoming',
      manual: false,
    });
  });

  it('사흘 이내면 진행중이다', () => {
    // 핸드오프 15번이 정한 값이다.
    expect(resolveTaskState({ dueDate: at(IN_PROGRESS_WITHIN_DAYS), override: null, now: NOW }).state).toBe(
      'in_progress'
    );
    expect(resolveTaskState({ dueDate: at(0), override: null, now: NOW }).state).toBe('in_progress');
  });

  it('나흘 남으면 아직 예정이다', () => {
    // 경계에서 한 칸 어긋나면 사흘 규칙이 나흘 규칙이 된다.
    expect(
      resolveTaskState({ dueDate: at(IN_PROGRESS_WITHIN_DAYS + 1), override: null, now: NOW }).state
    ).toBe('upcoming');
  });

  it('지나면 완료로 본다', () => {
    expect(resolveTaskState({ dueDate: at(-1), override: null, now: NOW }).state).toBe('done');
  });

  it('사용자가 정한 값이 이긴다', () => {
    /*
     * 자동 판정은 날짜만 보고 짐작하는 것이라, 사람이 아니라고 말했으면 그쪽이 맞다.
     * 지난 날인데도 '진행중'이라고 정할 수 있어야 한다.
     */
    const resolved = resolveTaskState({ dueDate: at(-5), override: 'in_progress', now: NOW });

    expect(resolved).toEqual({ state: 'in_progress', manual: true });
  });

  it('날짜가 없으면 예정으로 둔다', () => {
    // 자동으로 정할 근거가 없다. 지어내지 않는다.
    expect(resolveTaskState({ dueDate: null, override: null, now: NOW })).toEqual({
      state: 'upcoming',
      manual: false,
    });
  });
});

describe('기본 열넷', () => {
  it('열네 개다', () => {
    expect(TASK_PRESETS).toHaveLength(14);
  });

  it('키가 겹치지 않는다', () => {
    // 겹치면 유니크 제약이 조용히 하나를 버린다.
    const keys = TASK_PRESETS.map((preset) => preset.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('배지는 띄어쓰기 없이 쓴다', () => {
    expect(Object.values(TASK_STATE_LABEL)).toEqual(['예정', '진행중', '완료']);
  });
});

describe('진행률과 다음 일정', () => {
  it('완료한 것을 센다', () => {
    const tasks = [
      { dueDate: at(-1), override: null },
      { dueDate: at(-2), override: null },
      { dueDate: at(10), override: null },
    ];

    expect(taskProgress(tasks, NOW)).toEqual({ done: 2, total: 3 });
  });

  it('아직 오지 않은 것 중 가장 가까운 것이 다음이다', () => {
    // 지난 것을 다음이라고 부르지 않는다.
    const tasks = [
      { label: '지난 것', dueDate: at(-3) },
      { label: '먼 것', dueDate: at(30) },
      { label: '가까운 것', dueDate: at(2) },
      { label: '날짜 없음', dueDate: null },
    ];

    expect(nextTask(tasks, NOW)?.label).toBe('가까운 것');
  });

  it('오늘도 다음 일정이 될 수 있다', () => {
    expect(nextTask([{ label: '오늘', dueDate: at(0) }], NOW)?.label).toBe('오늘');
  });

  it('앞으로의 일정이 없으면 없다고 한다', () => {
    expect(nextTask([{ label: '지난 것', dueDate: at(-1) }], NOW)).toBeNull();
  });

  it('핸드오프가 쓴 날짜 표기를 쓴다', () => {
    expect(formatTaskDate('2026-09-02')).toBe('9월 2일');
  });
});
