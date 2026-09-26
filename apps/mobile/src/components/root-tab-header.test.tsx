import { StyleSheet, Text, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { FontSize, LineHeight } from '@weddingpick/ui';

import { ROOT_TAB_GUTTER, RootTabHeader, ROOT_TAB_HEADER_HEIGHT } from '@/components/root-tab-header';

/**
 * Root 5탭 제목 줄의 **실제로 풀린 값**을 본다 — 이름(`f26` · `Layout.gutter`)이 아니라 숫자다.
 *
 * 2026-09-26 대표 지시 「히어로 영역이 제각각이다. 홈 화면 기준으로 통일한다」. 기준은 홈 정본
 * `home.js:288` `header`(`flex:0 0 66px;align-items:center;padding:0 20px`) · `home.js:289`
 * `wordmark`(26 · 700 · -.02em)이다. 좌우는 Root 5탭 공통 20(`ROOT_TAB_GUTTER`) — 같은 날 대표 지시
 * 「통일해」로 다섯 탭 제목 줄과 본문이 한 값을 쓴다(하위 화면은 그대로 `Layout.gutter` 24).
 * 줄높이 39는 `f26` 토큰 값이다 — 정본 34는 같은 값의 토큰이 없고 66 줄 가운데 정렬이라 글자
 * 자리는 같다.
 */

let tree: ReactTestRenderer;

afterEach(() => {
  if (tree) act(() => tree.unmount());
});

function render(node: React.ReactElement) {
  act(() => {
    tree = create(node);
  });

  const title = tree.root.findAll((n) => n.type === Text && n.props.accessibilityRole === 'header')[0];
  const row = tree.root.findAll((n) => n.type === View)[0];

  return {
    title,
    titleStyle: StyleSheet.flatten(title.props.style),
    rowStyle: StyleSheet.flatten(row.props.style),
  };
}

describe('RootTabHeader', () => {
  it('줄 66 · 좌우 20 · 위아래 0 · 가운데 정렬', () => {
    const { rowStyle } = render(<RootTabHeader title="Pick" />);

    expect(ROOT_TAB_HEADER_HEIGHT).toBe(66);
    expect(ROOT_TAB_GUTTER).toBe(20);
    expect(rowStyle).toMatchObject({
      minHeight: 66,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    });
    expect(rowStyle.paddingTop).toBeUndefined();
    expect(rowStyle.paddingBottom).toBeUndefined();
    expect(rowStyle.paddingVertical).toBeUndefined();
    expect(rowStyle.height).toBeUndefined();
  });

  it('제목 26 · 줄높이 39 · 700 · 자간 -0.52 · 한 줄', () => {
    const { title, titleStyle } = render(<RootTabHeader title="검색" />);

    expect(titleStyle).toMatchObject({ fontSize: FontSize.f26, lineHeight: LineHeight.lh39, fontWeight: 700, letterSpacing: -0.52 });
    expect(title.props.numberOfLines).toBe(1);
    expect(title.props.children).toBe('검색');
  });

  it('오른쪽 행동은 같은 줄 끝에 둔다 — 없으면 제목만', () => {
    act(() => {
      tree = create(<RootTabHeader title="웨딩픽" right={<View testID="bell" />} />);
    });
    expect(tree.root.findAll((n) => n.type === View && n.props.testID === 'bell')).toHaveLength(1);

    act(() => tree.unmount());
    act(() => {
      tree = create(<RootTabHeader title="MY" />);
    });
    // 줄 View 하나뿐 — 행동 자리를 비워 두지 않는다.
    expect(tree.root.findAll((n) => n.type === View)).toHaveLength(1);
  });

  it('좌우 여백만 화면 본문 여백으로 바꿀 수 있다 — 높이 · 글자는 그대로', () => {
    const { rowStyle, titleStyle } = render(<RootTabHeader title="웨딩픽" gutter={24} />);

    expect(rowStyle).toMatchObject({ minHeight: 66, paddingHorizontal: 24 });
    expect(titleStyle).toMatchObject({ fontSize: FontSize.f26, lineHeight: LineHeight.lh39, fontWeight: 700 });
  });
});
