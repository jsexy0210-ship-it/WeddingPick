import { StyleSheet, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Layout } from '@weddingpick/ui';

import { BackBar } from '@/components/back-bar';
import { TOUCH_SLOT_SIZE, BACK_ICON_SIZE } from '@/components/back-button';
import { NavBar } from '@/features/wedding/screen-kit';

/**
 * **뒤로 가기 단추의 자리**를 지킨다.
 *
 * 2026-09-11 대표 지시 — 「Back 버튼 위치가 다른 상세 화면과 다른 부분이 있다.
 * 통일 하라」. 값은 v3.29로 다시 맞췄다(CLAUDE.md 「일반 화면」 행 — 헤더 56px ·
 * 좌측 36px 슬롯 뒤로가기 24px 아이콘). 옛 40 상자·24/20 아이콘 값에서 바뀌었다 —
 * `back-button.tsx`가 내보내는 `TOUCH_SLOT_SIZE`(36)·`BACK_ICON_SIZE`(24)를 그대로
 * 가져다 쓴다. 두 부품(`BackBar` · `NavBar`)은 여전히 같은 `BackButton`을 쓰므로
 * 자리도 같이 움직인다 — 이 시험은 그 사실을 지킨다.
 *
 * **기존 시험은 이것을 잡을 수 없었다.** `depth-back-buttons.test.tsx`는 뒤로가기가
 * **어디로 가는지**(경로 문자열)만 본다. 게다가 그 파일은 `BackBar`를 문자열로
 * 갈아끼우므로(`jest.mock`) 스타일이 아예 실행되지 않는다. 저장소 전체에
 * 자리·치수를 보는 단언이 하나도 없었다. 그래서 이 파일을 따로 둔다.
 */

/* 자리만 보는 시험이라 어디로 가는지는 상관없다 — 훅이 서기만 하면 된다. */
jest.mock('expo-router', () => ({
  router: { dismissTo: jest.fn(), replace: jest.fn() },
  usePathname: () => '/my/guide',
  useLocalSearchParams: () => ({}),
  useNavigation: () => ({ setOptions: jest.fn(), addListener: () => () => undefined }),
}));

/** 화살표 왼쪽 끝이 화면 왼쪽에서 떨어진 거리 — 막대 좌측 패딩 + 36 상자 안에서 24 아이콘이 밀려난 만큼. */
const CANONICAL_ICON_LEFT = 16 + (TOUCH_SLOT_SIZE - BACK_ICON_SIZE) / 2;
const CANONICAL_NAV_HEIGHT = 56;
/* RN 정본 `navBar` «padding:0 16px» — 여섯 보드 공통(2026-09-25, 옛 12/20에서). */
const CANONICAL_NAV_PADDING_LEFT = 16;
const CANONICAL_NAV_PADDING_RIGHT = 16;

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
 * 화살표 왼쪽 끝의 x. 막대의 좌측 패딩 + 36 상자 안에서 24 아이콘이 밀려난 만큼.
 * 가운데 정렬이면 그만큼, 왼쪽 붙임이면 0이다.
 */
function iconLeft(box: { alignItems?: unknown; width?: unknown }) {
  const inset = box.alignItems === 'center' ? (TOUCH_SLOT_SIZE - BACK_ICON_SIZE) / 2 : 0;

  return barStyle().paddingLeft + inset;
}

it(`BackBar의 화살표는 시안 자리(${CANONICAL_ICON_LEFT})에 앉는다`, () => {
  const box = backButtonStyle(<BackBar title="문의하기" />);

  expect(box.width).toBe(TOUCH_SLOT_SIZE);
  expect(box.height).toBe(TOUCH_SLOT_SIZE);
  /* 이 줄이 flex-start였다. 고침을 되돌리면 여기서 걸린다. */
  expect(box.alignItems).toBe('center');
  expect(iconLeft(box)).toBe(CANONICAL_ICON_LEFT);
});

it('NavBar의 화살표도 같은 자리에 앉는다', () => {
  const box = backButtonStyle(<NavBar title="일정" />);

  expect(box.width).toBe(TOUCH_SLOT_SIZE);
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
  expect(fromBackBar).toMatchObject({
    height: CANONICAL_NAV_HEIGHT,
    paddingLeft: CANONICAL_NAV_PADDING_LEFT,
    paddingRight: CANONICAL_NAV_PADDING_RIGHT,
  });
  expect(Layout.navPaddingLeft).toBe(CANONICAL_NAV_PADDING_LEFT);
  expect(Layout.navPaddingRight).toBe(CANONICAL_NAV_PADDING_RIGHT);
});

it('사용자 화면 콘텐츠는 정본 좌우 Gutter 24를 쓴다', () => {
  expect(Layout.gutter).toBe(24);
});
