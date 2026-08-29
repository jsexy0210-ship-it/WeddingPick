import { DEFAULT_LAYOUT, HOME_SECTIONS, isVisible, move, reconcile, toggle } from './sections';

describe('홈 순서', () => {
  it('저장된 것이 없으면 기본 순서다', () => {
    expect(reconcile(null)).toEqual(DEFAULT_LAYOUT);
  });

  it('모르는 섹션은 버린다', () => {
    // 없어진 섹션 자리가 빈칸으로 남지 않게 한다.
    const layout = reconcile({ order: ['없는것', 'tasks'] as never, hidden: {} });

    expect(layout.order).not.toContain('없는것');
  });

  it('빠진 섹션은 뒤에 붙인다', () => {
    // 섹션이 늘면 저장된 순서가 낡는다. 그대로 쓰면 새 섹션이 영영 안 보인다.
    const layout = reconcile({ order: ['tasks'], hidden: {} });

    expect(layout.order).toHaveLength(HOME_SECTIONS.length);
    expect(layout.order[0]).toBe('tasks');
  });

  it('숨김은 그대로 지킨다', () => {
    expect(reconcile({ order: [...HOME_SECTIONS], hidden: { tasks: true } }).hidden.tasks).toBe(
      true
    );
  });
});

describe('숨기고 옮기기', () => {
  it('숨기면 안 보이고 다시 누르면 보인다', () => {
    const hidden = toggle(DEFAULT_LAYOUT, 'expenses');

    expect(isVisible(hidden, 'expenses')).toBe(false);
    expect(isVisible(toggle(hidden, 'expenses'), 'expenses')).toBe(true);
  });

  it('한 칸씩 옮긴다', () => {
    const moved = move(DEFAULT_LAYOUT, 'expenses', -1);

    expect(moved.order.indexOf('expenses')).toBe(DEFAULT_LAYOUT.order.indexOf('expenses') - 1);
  });

  it('맨 위에서 더 올리면 그대로 둔다', () => {
    // 목록 밖으로 나가면 순서가 통째로 어긋난다.
    const first = DEFAULT_LAYOUT.order[0]!;

    expect(move(DEFAULT_LAYOUT, first, -1)).toEqual(DEFAULT_LAYOUT);
  });

  it('맨 아래에서 더 내려도 그대로 둔다', () => {
    const last = DEFAULT_LAYOUT.order[DEFAULT_LAYOUT.order.length - 1]!;

    expect(move(DEFAULT_LAYOUT, last, 1)).toEqual(DEFAULT_LAYOUT);
  });

  it('옮겨도 섹션 수는 그대로다', () => {
    const moved = move(move(DEFAULT_LAYOUT, 'unlock', -2), 'quickMenu', 1);

    expect(new Set(moved.order).size).toBe(HOME_SECTIONS.length);
  });
});
