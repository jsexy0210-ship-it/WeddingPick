import type {
  CandidateListResponse,
  ExpenseSummaryResponse,
  WeddingTaskListResponse,
} from '@weddingpick/api-contract';
import {
  MIN_COMPARABLE,
  formatTaskDate,
  isUrgent,
  type PriorityItem,
} from '@weddingpick/domain';

/**
 * 홈 대표 자리에 올릴 후보를 만든다. 통합정책 v3.10 §3.
 *
 * 고르는 일은 도메인의 `topPriority`가 한다. 여기서는 **잴 수 있는 것만** 후보로
 * 만든다 — 못 재는 종류는 아예 만들어지지 않는다.
 *
 * 지금 만들지 않는 종류 셋과 그 이유:
 *
 *   - `couple_taste` 취향을 아직 수집하지 않는다(v3.10 §8의 이미지 Pick 미구현).
 *   - `benefit_change` 혜택·이벤트 표가 없다. 없는 혜택을 말할 수 없다.
 *   - `curation` 개인화 피드가 아직 없다.
 *
 * 셋 다 지어내면 만들 수는 있다. 만들지 않는 이유는 그 문장이 참인지 우리가
 * 확인할 수 없기 때문이다.

 */
export type HomeFacts = {
  tasks: WeddingTaskListResponse | null;
  expenses: ExpenseSummaryResponse | null;
  candidates: CandidateListResponse | null;
};

/** 오늘부터 이 날짜까지 며칠. 지났으면 음수. */
function daysUntil(date: string, now = new Date()): number {
  const due = new Date(`${date}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function homePriorityItems(facts: HomeFacts, now = new Date()): PriorityItem[] {
  const items: PriorityItem[] = [];
  const pending = (facts.tasks?.tasks ?? []).filter((task) => task.state !== 'done');

  /*
   * 급한 일정. 지난 것이 먼저다 — 이미 지난 일이 곧 올 일보다 급하다.
   * 같은 종류 안의 순서는 여기서 정한다(도메인은 종류만 견준다).
   */
  const urgent = pending
    .filter((task) => task.dueDate !== null && isUrgent(daysUntil(task.dueDate, now)))
    .sort((a, b) => daysUntil(a.dueDate!, now) - daysUntil(b.dueDate!, now));

  for (const task of urgent) {
    items.push({
      kind: 'urgent_task',
      title: task.label,
      detail: `${formatTaskDate(task.dueDate!)}${task.vendorLabel ? ` · ${task.vendorLabel}` : ''}`,
      action: '/wedding/tasks',
      actionLabel: '일정 보기',
    });
  }

  /* 다음 할 일. 급하지 않은 것 중 가장 가까운 날. */
  const next = pending
    .filter((task) => task.dueDate !== null && !isUrgent(daysUntil(task.dueDate, now)))
    .sort((a, b) => daysUntil(a.dueDate!, now) - daysUntil(b.dueDate!, now))[0];

  if (next) {
    items.push({
      kind: 'next_task',
      title: next.label,
      detail: `${formatTaskDate(next.dueDate!)}${next.vendorLabel ? ` · ${next.vendorLabel}` : ''}`,
      action: '/wedding/tasks',
      actionLabel: '일정 보기',
    });
  }

  /* 두 곳 이상 Pick해두고 아직 안 정한 업종. 견줘볼 수 있는 상태다. */
  const comparable = (facts.candidates?.groups ?? []).find(
    (group) => group.candidates.length >= MIN_COMPARABLE && group.decidedVendorId === null
  );

  if (comparable) {
    items.push({
      kind: 'pick_candidate',
      title: `${comparable.categoryLabel} ${comparable.candidates.length}곳 비교`,
      detail: 'Pick해둔 곳을 나란히 놓고 봐요',
      action: '/pick',
      actionLabel: 'Pick 보기',
    });
  }

  /* 예산. 안 정했거나 넘었을 때만 말한다 — 잘 쓰고 있는 사람을 붙잡지 않는다. */
  const budget = facts.expenses?.budget;

  if (budget?.set === false) {
    items.push({
      kind: 'budget',
      title: '총예산을 정해요',
      detail: '예산을 적어두면 지출이 어디쯤인지 보여드려요',
      action: '/wedding/expenses',
      actionLabel: '지출내역',
    });
  } else if (budget?.set === true && budget.over) {
    items.push({
      kind: 'budget',
      title: '예산을 넘었어요',
      /* 얼마나 넘었는지는 지출 화면이 말한다. 여기서 숫자를 다시 만들지 않는다. */
      detail: '지출내역에서 어디에 얼마를 썼는지 볼 수 있어요',
      action: '/wedding/expenses',
      actionLabel: '지출내역',
    });
  }

  /*
   * 가격 TOP3는 후보에 없다. 홈 C-1이 그 섹션을 홈에서 뺐고, 대표 자리도 같은
   * 규칙을 따른다 — 섹션은 없는데 카드만 남으면 홈이 다시 그 자리를 만든다.
   */

  return items;
}
