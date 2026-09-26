import { StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { adminDocumentTitle } from '@/app/admin/_layout';
import { AdminTabShell, Bars, Card, ChoiceChips, Page } from '@/app/admin/_ui';
import { buttonA11y, headingA11y, tabA11y } from '@/features/admin/web-a11y';

/**
 * 2026-09-26 관리자 감사 4 · 5 · 8b — /admin/home.
 *
 * 역할은 react-native-web이 DOM으로 옮긴다(`role: 'button'` → `<button>`,
 * `role: 'heading'` + `aria-level` → `<h1>`/`<h2>`). 여기서는 공용 부품이 그 속성을
 * 내려보내는지를 본다. 실제 DOM · 키보드 순서는 캡처 도구로 브라우저에서 따로 쟀다.
 */
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

function render(node: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(node);
  });
  return tree;
}

/** 글자에서 위로 올라가 처음 만나는 눌리는 자리(`Pressable`) — 넘긴 속성이 그대로 있다. */
function roleAbove(tree: ReactTestRenderer, label: string): ReactTestInstance {
  let current: ReactTestInstance | null = textNode(tree, label).parent;
  while (current && typeof current.props.onPress !== 'function') current = current.parent;
  if (!current) throw new Error(`「${label}」 위에 눌리는 자리가 없다.`);
  return current;
}

/** 위로 올라가며 평탄화한 스타일이 `match`를 만족하는 첫 자리의 스타일. */
function styleAbove(node: ReactTestInstance, match: (style: Record<string, unknown>) => boolean): Record<string, unknown> {
  let current: ReactTestInstance | null = node.parent;
  while (current) {
    const style = (StyleSheet.flatten(current.props.style) ?? {}) as Record<string, unknown>;
    if (match(style)) return style;
    current = current.parent;
  }
  throw new Error('맞는 자리가 없다.');
}

function textNode(tree: ReactTestRenderer, label: string): ReactTestInstance {
  const node = tree.root.findAllByType(Text).find((n) => n.props.children === label);
  if (!node) throw new Error(`「${label}」을 찾지 못했다.`);
  return node;
}

describe('관리자 공용 부품 — 역할 · 키보드(감사 5)', () => {
  it('새로 고침과 로그아웃은 단추다', () => {
    const page = render(
      <Page title="요약" action={{ label: '새로 고침', onPress: () => undefined }}>
        <Text>본문</Text>
      </Page>
    );
    expect(roleAbove(page, '새로 고침').props.role).toBe('button');
    expect(roleAbove(page, '로그아웃').props.role).toBe('button');
  });

  it('상단 탭은 tablist 안의 tab이고 지금 탭만 aria-selected다', () => {
    const tree = render(
      <AdminTabShell
        tabs={[
          { key: 'home', label: '요약' },
          { key: 'briefing', label: '일일 브리핑' },
        ]}
        active="home"
        onChange={() => undefined}
      >
        <Text>본문</Text>
      </AdminTabShell>
    );
    const summary = roleAbove(tree, '요약');
    const briefing = roleAbove(tree, '일일 브리핑');
    expect(summary.props.role).toBe('tab');
    expect(summary.props['aria-selected']).toBe(true);
    expect(briefing.props['aria-selected']).toBe(false);
    expect(tree.root.findAll((node) => node.props.role === 'tablist').length).toBeGreaterThan(0);
    // 탭 셸에도 로그아웃이 있다 — 단추로.
    expect(roleAbove(tree, '로그아웃').props.role).toBe('button');
  });

  it('구간 칩은 켜고 끄는 단추이고 누르면 그 구간을 고른다', () => {
    const onChange = jest.fn();
    const tree = render(
      <ChoiceChips
        label="회원 추이 구간"
        items={[
          { key: 'day', label: '일' },
          { key: 'week', label: '주' },
        ]}
        value="day"
        onChange={onChange}
      />
    );
    const day = roleAbove(tree, '일');
    const week = roleAbove(tree, '주');
    expect(day.props.role).toBe('button');
    expect(day.props['aria-pressed']).toBe(true);
    expect(week.props['aria-pressed']).toBe(false);
    act(() => week.props.onPress());
    expect(onChange).toHaveBeenCalledWith('week');
  });

  it('칩의 모양은 옛 `bucketTab`과 같다 — 테두리 · 여백은 단추, 글자는 글자', () => {
    const tree = render(
      <ChoiceChips label="구간" items={[{ key: 'day', label: '일' }, { key: 'week', label: '주' }]} value="day" onChange={() => undefined} />
    );
    const off = StyleSheet.flatten(roleAbove(tree, '주').props.style);
    expect(off).toMatchObject({ paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1 });
    const onLabel = StyleSheet.flatten(textNode(tree, '일').props.style);
    expect(onLabel.fontWeight).toBe('700');
  });
});

describe('탭 키 처리 — Space로 고르고 ← →로 옮긴다', () => {
  const key = (k: string, currentTarget?: unknown) => ({ key: k, preventDefault: jest.fn(), currentTarget });

  it('Space는 고르고 기본 동작(스크롤)을 막는다', () => {
    const onSelect = jest.fn();
    const props = tabA11y(false, onSelect) as unknown as { onKeyDown: (e: ReturnType<typeof key>) => void };
    const event = key(' ');
    props.onKeyDown(event);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('Enter는 여기서 받지 않는다 — PressResponder가 받으므로 두 번 눌리지 않게', () => {
    const onSelect = jest.fn();
    const props = tabA11y(false, onSelect) as unknown as { onKeyDown: (e: ReturnType<typeof key>) => void };
    props.onKeyDown(key('Enter'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('→는 같은 목록의 다음 탭에 초점을 옮기고 끝에서는 처음으로 돈다', () => {
    const focus = [jest.fn(), jest.fn(), jest.fn()];
    const tabs = focus.map((f) => ({ focus: f, closest: () => list }));
    const list = { querySelectorAll: () => tabs };
    const props = tabA11y(true, jest.fn()) as unknown as { onKeyDown: (e: ReturnType<typeof key>) => void };
    props.onKeyDown(key('ArrowRight', tabs[2]));
    expect(focus[0]).toHaveBeenCalled();
    props.onKeyDown(key('ArrowLeft', tabs[0]));
    expect(focus[2]).toHaveBeenCalled();
  });

  it('도움 함수가 내는 값', () => {
    expect(buttonA11y()).toEqual({ role: 'button' });
    expect(buttonA11y(false)).toEqual({ role: 'button', 'aria-pressed': false });
    expect(headingA11y(2)).toEqual({ role: 'heading', 'aria-level': 2 });
  });
});

describe('제목 구조(감사 8b)', () => {
  it('문서 제목은 사이드바 메뉴 이름 + 콘솔 이름이다', () => {
    expect(adminDocumentTitle('/admin/home')).toBe('대시보드 — 웨딩픽 관리자');
    expect(adminDocumentTitle('/admin/automation')).toBe('자동화 — 웨딩픽 관리자');
    // 메뉴에 없는 주소(옛 주소 · 직접 친 주소)는 콘솔 이름만.
    expect(adminDocumentTitle('/admin/unknown')).toBe('웨딩픽 관리자');
  });

  it('화면 제목은 1단, 카드 제목은 2단 제목이다', () => {
    const tree = render(
      <Page title="요약" embedded>
        <Card title="회원" full>
          <Text>본문</Text>
        </Card>
      </Page>
    );
    const h1 = textNode(tree, '요약');
    const h2 = textNode(tree, '회원');
    expect(h1.props.role).toBe('heading');
    expect(h1.props['aria-level']).toBe(1);
    expect(h2.props.role).toBe('heading');
    expect(h2.props['aria-level']).toBe(2);
  });
});

describe('회원 차트가 카드 안에 든다(감사 4)', () => {
  it('한 줄 카드는 높이를 `flexBasis: 100%`로 잡지 않는다 — 세로 본문에서 카드가 눌렸다', () => {
    const tree = render(
      <Card title="회원" full>
        <Text>본문</Text>
      </Card>
    );
    const style = styleAbove(textNode(tree, '회원'), (st) => st.minWidth === '100%');
    expect(style.flexBasis).toBeUndefined();
    expect(style.width).toBe('100%');
  });

  it('막대 칸은 폭이 모자라면 줄고, 높이는 정본 150에 고정된다', () => {
    const tree = render(
      <Bars
        items={[
          { label: '9. 25.', pct: 100, kind: 'brand', value: '31', secondary: { pct: 5, value: '2', kind: 'danger' } },
          { label: '9. 26.', pct: 40, kind: 'brand', value: '11', secondary: { pct: 3, value: '1', kind: 'danger' } },
        ]}
      />
    );
    const label = textNode(tree, '9. 26.');
    expect(label.props.numberOfLines).toBe(1);
    const col = styleAbove(label, (st) => st.alignItems === 'center');
    expect(col).toMatchObject({ flexShrink: 1, minWidth: 0 });
    const wrap = styleAbove(label, (st) => st.justifyContent === 'space-around');
    /* 2026-09-26 대표 결정 「카드 레이아웃 영역 안에서 자동 리사이징」 — 칸이 자라지 않는다. */
    expect(wrap.height).toBe(150);
    expect(wrap.minHeight).toBeUndefined();
  });

  it('값 줄이 있으면 막대는 남은 높이의 비율(%)로 서고, 값은 비워 둔 자리 안에 선다', () => {
    const tree = render(
      <Bars
        items={[
          { label: '9. 25.', pct: 100, kind: 'brand', value: '31', secondary: { pct: 5, value: '2', kind: 'danger' } },
          { label: '9. 26.', pct: 40, kind: 'brand', secondary: { pct: 10, kind: 'danger' } },
        ]}
      />
    );
    /* 값 줄(17) + 사이(8)를 모든 칸이 똑같이 비워 둔다 — 값이 없는 칸도 같은 자를 쓴다. */
    const plots = tree.root.findAll(
      (n) => typeof n.type === 'string' && (StyleSheet.flatten(n.props.style) ?? {}).flex === 1
    );
    expect(plots).toHaveLength(2);
    for (const plot of plots) expect(StyleSheet.flatten(plot.props.style).paddingTop).toBe(25);

    const value = textNode(tree, '31 · 2');
    const valueStyle = StyleSheet.flatten(value.props.style);
    expect(valueStyle).toMatchObject({ position: 'absolute', bottom: '100%', marginBottom: 8 });

    /* 묶음 높이는 가장 높은 막대(pct), 막대는 묶음 안의 비율 — px 자(pct × 1.3)를 쓰지 않는다. */
    const pair = value.parent!;
    expect(StyleSheet.flatten(pair.props.style).height).toBe('100%');
    const heights = pair.children
      .filter((c): c is ReactTestInstance => typeof c !== 'string' && c.type !== Text)
      .map((c) => StyleSheet.flatten(c.props.style));
    expect(heights.map((st) => st.height)).toEqual(['100%', '5%']);
    expect(heights.every((st) => st.minHeight === 4)).toBe(true);
  });

  it('값 줄이 없으면 비워 두지 않는다', () => {
    const tree = render(<Bars items={[{ label: '가입', pct: 60 }, { label: '결제', pct: 0 }]} />);
    const col = styleAbove(textNode(tree, '결제'), (st) => st.alignItems === 'center');
    expect(col).toBeDefined();
    const plots = tree.root.findAll(
      (n) => typeof n.type === 'string' && (StyleSheet.flatten(n.props.style) ?? {}).flex === 1
    );
    expect(plots.map((p) => StyleSheet.flatten(p.props.style).paddingTop)).toEqual([undefined, undefined]);
  });

  it('날짜 줄이 겹쳐도 칸 수는 항목 수 그대로다 — 「일」→「월」 전환 중 옛 칸이 남던 문제', () => {
    const items = (labels: string[]) => labels.map((label) => ({ label, pct: 50, value: '1' }));
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<Bars items={items(Array.from({ length: 14 }, () => '9월'))} />);
    });
    act(() => {
      tree.update(<Bars items={items(['7월', '8월', '9월'])} />);
    });
    /*
     * 그려진 것(호스트 트리)을 센다 — 열쇠가 겹치면 React가 옛 칸을 지우지 못해 화면에만
     * 남고 컴포넌트 트리에서는 빠지므로, `tree.root`로는 보이지 않는다.
     */
    const drawn = JSON.stringify(tree.toJSON()).match(/"[0-9]+월"/g) ?? [];
    expect(drawn).toEqual(['"7월"', '"8월"', '"9월"']);
  });
});
