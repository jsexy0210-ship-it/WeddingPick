import { StyleSheet, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Layout } from '@weddingpick/ui';

import { BackBar } from '@/components/back-bar';
import { NavBar } from '@/features/wedding/screen-kit';

/**
 * **뒤로 가기 단추의 자리**를 지킨다.
 *
 * 2026-09-11 대표 지시 — 「Back 버튼 위치가 다른 상세 화면과 다른 부분이 있다.
 * 통일 하라」.
 *
 * 무엇이 어긋나 있었나. 상세 화면의 상단 막대를 그리는 부품이 셋인데
 * (`BackBar` · `NavBar` · `SubScreen`) 막대의 좌측 패딩 12는 셋이 같았다. 다른 것은
 * **40 상자 안에서 아이콘을 어디에 두는가**였다 —
 *
 * ```
 * NavBar · SubScreen   alignItems: 'center'       12 + (40−24)/2 = 20
 * BackBar              alignItems: 'flex-start'   12 + 0         = 12
 * ```
 *
 * 8px이다. 한 화면만 보면 모르지만 두 화면을 오가면 화살표가 움직인다.
 *
 * **기존 시험은 이것을 잡을 수 없었다.** `depth-back-buttons.test.tsx`는 뒤로가기가
 * **어디로 가는지**(경로 문자열)만 본다. 게다가 그 파일은 `BackBar`를 문자열로
 * 갈아끼우므로(`jest.mock`) 스타일이 아예 실행되지 않는다. 저장소 전체에
 * 자리·치수를 보는 단언이 하나도 없었다. 그래서 이 파일을 따로 둔다.
 *
 * 시안 근거: `backBtn`이 20개 dc.html에 정의돼 있고 전부 같다 —
 * `width:40px;height:40px;border-radius:999px;display:flex;align-items:center;`
 * `justify-content:center`. `navBack`은 19개 전부 `padding:0 20px 0 12px`.
 */

/* 자리만 보는 시험이라 어디로 가는지는 상관없다 — 훅이 서기만 하면 된다. */
jest.mock('expo-router', () => ({
  router: { dismissTo: jest.fn(), replace: jest.fn() },
  usePathname: () => '/my/guide',
}));

/** 시안 backBtn·navBack에서 나오는 값. 화살표 왼쪽 끝이 화면 왼쪽에서 떨어진 거리. */
const CANONICAL_ICON_LEFT = 20;

let tree: ReactTestRenderer;

afterEach(() => {
  if (tree) act(() => tree.unmount());
});

/** 뒤로가기 단추(`accessibilityLabel="뒤로"`)의 합쳐진 스타일. */
function backButtonStyle(node: React.ReactElement) {
  act(() => {
    tree = create(node);
  });

  const pressable = tree.root.findAll(
    (found) => found.props?.accessibilityLabel === '뒤로' && found.props?.style !== undefined,
    { deep: false }
  )[0];

  if (!pressable) throw new Error('뒤로가기 단추를 찾지 못했다');

  /* style이 함수면(눌림 상태를 받는 자리) 안 눌린 상태로 부른다. */
  const style = typeof pressable.props.style === 'function'
    ? pressable.props.style({ pressed: false })
    : pressable.props.style;

  return StyleSheet.flatten(style) ?? {};
}

/** 단추를 감싼 막대의 합쳐진 스타일 — 막대 자체의 좌측 패딩을 본다. */
function barStyle() {
  const bar = tree.root
    .findAllByType(View)
    .map((found) => StyleSheet.flatten(found.props.style) ?? {})
    .find((flat) => flat.height === Layout.navBar && flat.paddingLeft !== undefined);

  if (!bar) throw new Error('상단 막대를 찾지 못했다');

  return bar;
}

/**
 * 화살표 왼쪽 끝의 x. 막대의 좌측 패딩 + 40 상자 안에서 24 아이콘이 밀려난 만큼.
 * 가운데 정렬이면 8, 왼쪽 붙임이면 0이다.
 */
function iconLeft(box: { alignItems?: unknown; width?: unknown }) {
  const inset = box.alignItems === 'center' ? (Layout.iconButton - Layout.iconTab) / 2 : 0;

  return barStyle().paddingLeft + inset;
}

it('BackBar의 화살표는 시안 자리(20)에 앉는다', () => {
  const box = backButtonStyle(<BackBar title="문의하기" />);

  expect(box.width).toBe(Layout.iconButton);
  expect(box.height).toBe(Layout.iconButton);
  /* 이 줄이 flex-start였다. 고침을 되돌리면 여기서 걸린다. */
  expect(box.alignItems).toBe('center');
  expect(iconLeft(box)).toBe(CANONICAL_ICON_LEFT);
});

it('NavBar의 화살표도 같은 자리에 앉는다', () => {
  const box = backButtonStyle(<NavBar title="일정" />);

  expect(box.width).toBe(Layout.iconButton);
  expect(iconLeft(box)).toBe(CANONICAL_ICON_LEFT);
});

it('두 막대는 같은 치수를 쓴다 — 높이 · 좌우 패딩', () => {
  backButtonStyle(<BackBar title="문의하기" />);
  const fromBackBar = barStyle();

  act(() => tree.unmount());

  backButtonStyle(<NavBar title="일정" />);
  const fromNavBar = barStyle();

  expect(fromBackBar.height).toBe(fromNavBar.height);
  expect(fromBackBar.paddingLeft).toBe(fromNavBar.paddingLeft);
  expect(fromBackBar.paddingRight).toBe(fromNavBar.paddingRight);
  expect(fromBackBar.paddingLeft).toBe(Layout.navPaddingLeft);
});
