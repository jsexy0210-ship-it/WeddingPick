import {
  DEFAULT_HOME_LAYOUT,
  HOME_SECTIONS,
  moveSection,
  normalizeHomeLayout,
  visibleHomeSections,
  type HomeSectionKey,
} from './layout';

describe('홈 구성 정리', () => {
  it('저장된 것이 없으면 기본 순서다', () => {
    expect(normalizeHomeLayout(null)).toEqual(DEFAULT_HOME_LAYOUT);
  });

  it('저장된 순서를 지킨다', () => {
    const stored = { order: ['content', 'next', 'recommendation', 'board'] as HomeSectionKey[] };

    expect(normalizeHomeLayout(stored).order).toEqual([
      'content',
      'next',
      'recommendation',
      'board',
    ]);
  });

  /*
   * 앱이 올라가면서 섹션이 늘어난다. 저장된 순서를 그대로 믿으면 **새 섹션이 영영
   * 안 보인다** — 사람이 숨긴 적도 없는데 사라지는 것이라 가장 나쁜 종류의 버그다.
   */
  it('저장에 없는 새 섹션은 뒤에 붙고 켜진 채로 나온다', () => {
    const stored = { order: ['recommendation', 'board'] as HomeSectionKey[] };
    const layout = normalizeHomeLayout(stored);

    expect(layout.order).toEqual(['recommendation', 'board', 'next', 'content']);
    expect(layout.order).toHaveLength(HOME_SECTIONS.length);
    expect(visibleHomeSections(layout)).toHaveLength(HOME_SECTIONS.length);
  });

  it('없어진 섹션 키는 순서에서도 숨김에서도 빠진다', () => {
    const stored = {
      order: ['board', 'benefit', 'content'] as HomeSectionKey[],
      hidden: ['benefit', 'content'] as HomeSectionKey[],
    };
    const layout = normalizeHomeLayout(stored);

    expect(layout.order).not.toContain('benefit');
    expect(layout.hidden).toEqual(['content']);
  });

  it('같은 키가 두 번 저장돼 있어도 한 번만 그린다', () => {
    const stored = { order: ['board', 'board', 'next'] as HomeSectionKey[] };

    expect(normalizeHomeLayout(stored).order.filter((key) => key === 'board')).toHaveLength(1);
  });
});

describe('숨김', () => {
  it('숨긴 섹션은 그리지 않지만 순서에는 남는다', () => {
    const layout = normalizeHomeLayout({ hidden: ['recommendation'] });

    expect(visibleHomeSections(layout)).toEqual(['board', 'next', 'content']);
    // 다시 켰을 때 있던 자리로 돌아와야 한다.
    expect(layout.order).toEqual(['board', 'recommendation', 'next', 'content']);
  });
});

describe('자리 옮기기', () => {
  const order: readonly HomeSectionKey[] = ['board', 'recommendation', 'next', 'content'];

  it('아래로 한 칸', () => {
    expect(moveSection(order, 0, 1)).toEqual(['recommendation', 'board', 'next', 'content']);
  });

  it('맨 아래에서 맨 위로', () => {
    expect(moveSection(order, 3, 0)).toEqual(['content', 'board', 'recommendation', 'next']);
  });

  it('제자리거나 목록 밖이면 그대로다', () => {
    expect(moveSection(order, 2, 2)).toBe(order);
    expect(moveSection(order, 0, -1)).toBe(order);
    expect(moveSection(order, 0, 4)).toBe(order);
  });
});
