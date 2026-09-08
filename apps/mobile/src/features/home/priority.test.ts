import type {
  CandidateListResponse,
  ExpenseSummaryResponse,
  WeddingTaskListResponse,
} from '@weddingpick/api-contract';
import { topPriority } from '@weddingpick/domain';

import { homePriorityItems, type HomeFacts } from '@/features/home/priority';

const NOW = new Date('2026-09-01T09:00:00+09:00');

/** 오늘로부터 며칠 뒤. */
function day(offset: number): string {
  const date = new Date(NOW);

  date.setDate(date.getDate() + offset);

  return date.toISOString().slice(0, 10);
}

function tasks(
  rows: { label: string; dueDate: string | null; state?: 'todo' | 'done' }[]
): WeddingTaskListResponse {
  return {
    tasks: rows.map((row, index) => ({
      id: `t${index}`,
      label: row.label,
      dueDate: row.dueDate,
      vendorId: null,
      vendorLabel: null,
      state: row.state ?? 'todo',
      stateLabel: row.state === 'done' ? '완료' : '준비 중',
      manualState: false,
    })),
    progress: { done: 0, total: rows.length },
  } as WeddingTaskListResponse;
}

const NO_FACTS: HomeFacts = { tasks: null, expenses: null, candidates: null };

describe('홈 후보 만들기', () => {
  it('아무 자료도 없으면 후보가 없다', () => {
    // 빈 자리를 지어내지 않는다. 화면이 "일정을 등록해보세요"를 그린다.
    expect(homePriorityItems(NO_FACTS, NOW)).toEqual([]);
  });

  it('이레 안에 든 일정은 급한 일로 올린다', () => {
    const items = homePriorityItems({ ...NO_FACTS, tasks: tasks([
      { label: '드레스 투어', dueDate: day(3) },
    ]) }, NOW);

    expect(items[0]?.kind).toBe('urgent_task');
  });

  it('지난 일정이 곧 올 일정보다 먼저다', () => {
    // 도메인은 종류만 견준다. 종류 안의 순서는 값을 아는 이 쪽이 정한다.
    const items = homePriorityItems({ ...NO_FACTS, tasks: tasks([
      { label: '곧', dueDate: day(2) },
      { label: '지남', dueDate: day(-5) },
    ]) }, NOW);

    expect(topPriority(items)?.title).toBe('지남');
  });

  it('끝낸 일정은 올리지 않는다', () => {
    const items = homePriorityItems({ ...NO_FACTS, tasks: tasks([
      { label: '끝냄', dueDate: day(1), state: 'done' },
    ]) }, NOW);

    expect(items).toEqual([]);
  });

  it('먼 일정은 다음 할 일이 된다', () => {
    const items = homePriorityItems({ ...NO_FACTS, tasks: tasks([
      { label: '본식 스냅', dueDate: day(60) },
    ]) }, NOW);

    expect(items[0]?.kind).toBe('next_task');
  });

  it('날짜 없는 일정은 어느 쪽도 아니다', () => {
    // 미정인 일정을 급하다고도 다음이라고도 말할 수 없다.
    const items = homePriorityItems({ ...NO_FACTS, tasks: tasks([
      { label: '미정', dueDate: null },
    ]) }, NOW);

    expect(items).toEqual([]);
  });

  it('두 곳 이상 Pick한 업종은 비교를 권한다', () => {
    const candidates = {
      groups: [
        {
          category: 'hall',
          categoryLabel: '웨딩홀',
          candidates: [{}, {}],
          comparable: true,
          state: 'picking',
          stateLabel: '후보 Pick 중',
          decidedVendorId: null,
        },
      ],
    } as unknown as CandidateListResponse;

    const items = homePriorityItems({ ...NO_FACTS, candidates }, NOW);

    expect(items[0]?.kind).toBe('pick_candidate');
    expect(items[0]?.title).toBe('웨딩홀 2곳 비교');
  });

  it('이미 정한 업종은 권하지 않는다', () => {
    const candidates = {
      groups: [
        {
          category: 'hall',
          categoryLabel: '웨딩홀',
          candidates: [{}, {}],
          comparable: true,
          state: 'decided',
          stateLabel: '결정 완료',
          decidedVendorId: 'v1',
        },
      ],
    } as unknown as CandidateListResponse;

    expect(homePriorityItems({ ...NO_FACTS, candidates }, NOW)).toEqual([]);
  });

  it('예산을 안 정했으면 정하라고 한다', () => {
    const expenses = {
      budget: { set: false, note: '아직 정하지 않았어요' },
    } as unknown as ExpenseSummaryResponse;

    expect(homePriorityItems({ ...NO_FACTS, expenses }, NOW)[0]?.kind).toBe('budget');
  });

  it('온보딩에서 구간을 답했으면 숫자 예산이 없어도 붙잡지 않는다', () => {
    // «3,000만원 이상»은 상한이 없어 budget.set은 false지만 이미 답한 것이다.
    const expenses = {
      budget: { set: false, note: '아직 정하지 않았어요' },
      budgetBracket: 'over_30m',
    } as unknown as ExpenseSummaryResponse;

    expect(homePriorityItems({ ...NO_FACTS, expenses }, NOW)).toEqual([]);
  });

  it('예산 안에 있으면 붙잡지 않는다', () => {
    // 잘 쓰고 있는 사람에게 할 말이 없다.
    const expenses = {
      budget: { set: true, budget: 50_000_000, spent: 10_000_000, remaining: 40_000_000, over: false },
    } as unknown as ExpenseSummaryResponse;

    expect(homePriorityItems({ ...NO_FACTS, expenses }, NOW)).toEqual([]);
  });

  it('예산을 넘었으면 말한다', () => {
    const expenses = {
      budget: { set: true, budget: 50_000_000, spent: 60_000_000, remaining: -10_000_000, over: true },
    } as unknown as ExpenseSummaryResponse;

    const items = homePriorityItems({ ...NO_FACTS, expenses }, NOW);

    expect(items[0]?.kind).toBe('budget');
    expect(items[0]?.title).toBe('예산을 넘었어요');
  });

  it('아직 재지 않는 종류는 만들지 않는다', () => {
    /*
     * 커플 공통취향·혜택 변경·일반 큐레이션은 우리가 가진 자료가 아니다.
     * 자료가 생기기 전에 문장부터 만들면 그 문장이 참인지 확인할 길이 없다.
     */
    const facts: HomeFacts = {
      tasks: tasks([{ label: '드레스 투어', dueDate: day(1) }]),
      expenses: { budget: { set: false, note: '…' } } as unknown as ExpenseSummaryResponse,
      candidates: null,
    };

    const kinds = homePriorityItems(facts, NOW).map((item) => item.kind);

    expect(kinds).not.toContain('couple_taste');
    expect(kinds).not.toContain('benefit_change');
    expect(kinds).not.toContain('curation');
  });
});
