import { PRIORITY_KINDS, isUrgent, topPriority, type PriorityItem } from './priority';

function item(kind: PriorityItem['kind'], title: string = kind): PriorityItem {
  return { kind, title, detail: null, action: '/', actionLabel: '가기' };
}

describe('홈 대표 자리', () => {
  it('정책 순서대로 첫 번째를 고른다', () => {
    // 긴급 일정 → 다음 할 일 → Pick 후보 → … → 일반 추천
    const picked = topPriority([item('curation'), item('benefit_change'), item('urgent_task')]);

    expect(picked?.kind).toBe('urgent_task');
  });

  it('넘어온 순서와 상관없다', () => {
    expect(topPriority([item('budget'), item('pick_candidate')])?.kind).toBe('pick_candidate');
    expect(topPriority([item('pick_candidate'), item('budget')])?.kind).toBe('pick_candidate');
  });

  it('같은 종류가 여럿이면 먼저 넘어온 것을 쓴다', () => {
    // 종류 안에서 무엇이 더 급한지는 값을 아는 쪽이 정할 일이다.
    const picked = topPriority([item('urgent_task', '먼저'), item('urgent_task', '나중')]);

    expect(picked?.title).toBe('먼저');
  });

  it('추천이 하나도 없으면 다음 할 일이 남는다', () => {
    /*
     * 정책의 "유효 추천이 없으면 다음 일정으로 fallback"이다. 따로 갈래를 두지
     * 않고 순서로 지킨다 — 다음 할 일이 추천들보다 앞이다.
     */
    expect(topPriority([item('next_task')])?.kind).toBe('next_task');
  });

  it('후보가 없으면 아무것도 고르지 않는다', () => {
    // 빈 자리를 지어내지 않는다. 화면이 그 상태를 그린다.
    expect(topPriority([])).toBeNull();
  });

  it('가격 TOP3 분기는 없다', () => {
    /*
     * 홈 C-1: 오늘의 Pick과 경쟁하는 가격 TOP3 섹션을 홈에 두지 않는다.
     * 대표 자리도 같은 규칙을 따른다 — 종류 자체를 두지 않아야 다시 안 들어온다.
     */
    expect(PRIORITY_KINDS).not.toContain('top3');
  });

  it('커플 공통취향은 순서에 남아 있다', () => {
    /*
     * 아직 취향을 재지 않아 이 종류는 만들어지지 않는다. 그래도 순서에서 빼지
     * 않는다 — 신호가 생기는 날 자리를 다시 찾을 필요가 없어야 한다.
     */
    expect(PRIORITY_KINDS).toContain('couple_taste');
    expect(PRIORITY_KINDS.indexOf('couple_taste')).toBeLessThan(PRIORITY_KINDS.indexOf('budget'));
  });
});

describe('급한 일정', () => {
  it('지났거나 이레 안이면 급하다', () => {
    expect(isUrgent(-3)).toBe(true);
    expect(isUrgent(0)).toBe(true);
    expect(isUrgent(7)).toBe(true);
  });

  it('멀면 급하지 않다', () => {
    expect(isUrgent(8)).toBe(false);
    expect(isUrgent(90)).toBe(false);
  });

  it('날짜가 없으면 급하지 않다', () => {
    // 미정인 일정을 급하다고 말하면 급하다는 말이 뜻을 잃는다.
    expect(isUrgent(null)).toBe(false);
  });
});
