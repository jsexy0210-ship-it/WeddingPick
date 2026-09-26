import { KeyboardAvoidingView, StyleSheet, Text, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { hideTabBarForKeyboard } from '@/features/navigation/tab-bar';

/**
 * 키패드 피하기 — 시트 · 풀팝업 · 화면 껍데기가 같이 쓰는 `KeyboardAvoid`(2026-09-26 대표 지시
 * 「바텀시트 등 키패드와 겹치면 안된다」).
 *
 * 시험은 iOS로 돈다. 웹 판(`keyboard-avoid.web.tsx`)은 파일을 직접 불러 키패드 높이를 흉내 낸다.
 */

const mockKeyboard = { inset: 0, visible: false };
jest.mock('@/features/common/keyboard-inset', () => ({
  useKeyboardInset: () => mockKeyboard,
  useKeyboardAvoidingRoot: () => undefined,
  KEYBOARD_HIDDEN: { inset: 0, visible: false },
}));
jest.mock('@weddingpick/ui', () => ({
  ...jest.requireActual('@weddingpick/ui'),
  /* 움직임 없이 곧바로 옮긴다 — 올라간 «자리»를 본다. */
  useReduceMotion: () => true,
}));
/* 바텀시트가 웹 판 KeyboardAvoid를 쓰게 한다(모달이 앱 뿌리 밖이라 스스로 올라가는 자리). */
jest.mock('@/features/common/keyboard-avoid', () => jest.requireActual('@/features/common/keyboard-avoid.web'));

let tree: ReactTestRenderer | null = null;

afterEach(() => {
  if (tree) act(() => tree!.unmount());
  tree = null;
  mockKeyboard.inset = 0;
  mockKeyboard.visible = false;
});

function render(node: React.ReactElement) {
  act(() => {
    tree = create(node);
  });
  return tree!;
}

/** 그 testID가 실제로 그려진 자리(Animated 값이 숫자로 풀린 View)의 아래 여백. */
function paddingBottomOf(testID: string): unknown {
  return tree!.root
    .findAll((n) => n.props.testID === testID)
    .map((n) => StyleSheet.flatten(n.props.style)?.paddingBottom)
    .find((value) => typeof value === 'number');
}

describe('KeyboardAvoid — 네이티브', () => {
  it('RN KeyboardAvoidingView — iOS는 padding(자기 아래 끝과 키패드가 겹친 만큼만 민다)', () => {
    const { KeyboardAvoid, KEYBOARD_AVOID_BEHAVIOR } = jest.requireActual('./keyboard-avoid') as typeof import('./keyboard-avoid');
    render(
      <KeyboardAvoid style={{ flex: 1 }}>
        <Text>본문</Text>
      </KeyboardAvoid>
    );

    const kav = tree!.root.findByType(KeyboardAvoidingView);
    expect(KEYBOARD_AVOID_BEHAVIOR).toBe('padding');
    expect(kav.props.behavior).toBe('padding');
  });
});

describe('KeyboardAvoid — 웹', () => {
  const { KeyboardAvoid } = jest.requireActual('./keyboard-avoid.web') as typeof import('./keyboard-avoid.web');

  it('lift — 키패드가 가린 높이(336)만큼 아래 여백을 줘서 키패드 바로 위로 올린다', () => {
    mockKeyboard.inset = 336;
    mockKeyboard.visible = true;
    render(
      <KeyboardAvoid lift testID="lift">
        <Text>시트</Text>
      </KeyboardAvoid>
    );

    expect(paddingBottomOf('lift')).toBe(336);
  });

  it('lift — 키패드가 없으면 0', () => {
    render(
      <KeyboardAvoid lift testID="lift">
        <Text>시트</Text>
      </KeyboardAvoid>
    );

    expect(paddingBottomOf('lift')).toBe(0);
  });

  it('화면(lift 없음)은 밀지 않는다 — 앱 뿌리가 통째로 줄어서 여기서 또 밀면 두 번 밀린다', () => {
    mockKeyboard.inset = 336;
    mockKeyboard.visible = true;
    render(
      <KeyboardAvoid testID="screen" style={{ flex: 1 }}>
        <Text>화면</Text>
      </KeyboardAvoid>
    );

    const node = tree!.root.findAll((n) => n.props.testID === 'screen' && n.type === View)[0];
    expect(StyleSheet.flatten(node.props.style)).toEqual({ flex: 1 });
  });
});

describe('BottomSheet — 키패드 위로', () => {
  it('웹: 패널이 키패드가 가린 높이만큼 올라가고 줄어들 수 있다(안의 스크롤이 줄고 CTA는 남는다)', () => {
    const { BottomSheet } = jest.requireActual('./bottom-sheet') as typeof import('./bottom-sheet');
    mockKeyboard.inset = 336;
    mockKeyboard.visible = true;
    render(
      <BottomSheet visible onRequestClose={jest.fn()} testID="sheet">
        <Text>낸 금액</Text>
      </BottomSheet>
    );

    /* 스크림과 패널을 감싼 뿌리 — 아래 여백이 키패드 높이다. */
    const lifted = tree!.root.findAll(
      (n) => typeof n.type !== 'string' && StyleSheet.flatten(n.props.style)?.paddingBottom === 336
    );
    expect(lifted.length).toBeGreaterThan(0);
    const root = StyleSheet.flatten(lifted[0].props.style);
    expect(root).toMatchObject({ flex: 1, justifyContent: 'flex-end' });

    /* 패널 — 최대 90% · 줄어들 수 있다. */
    const panel = tree!.root.findAll(
      (n) => typeof n.type !== 'string' && StyleSheet.flatten(n.props.style)?.maxHeight === '90%'
    )[0];
    expect(StyleSheet.flatten(panel.props.style)).toMatchObject({ flexShrink: 1 });
  });
});

describe('탭 바 — 키패드가 뜨면 숨는다', () => {
  const up = { inset: 336, visible: true };
  const down = { inset: 0, visible: false };

  it('웹 · 안드로이드는 숨긴다 — 뿌리 · 창이 줄어 키패드 위로 떠오르지 않게', () => {
    expect(hideTabBarForKeyboard('web', up)).toBe(true);
    expect(hideTabBarForKeyboard('android', up)).toBe(true);
  });

  it('iOS는 키패드가 덮으므로 그대로 둔다 · 키패드가 없으면 어디서나 보인다', () => {
    expect(hideTabBarForKeyboard('ios', up)).toBe(false);
    expect(hideTabBarForKeyboard('web', down)).toBe(false);
    expect(hideTabBarForKeyboard('android', down)).toBe(false);
  });
});
