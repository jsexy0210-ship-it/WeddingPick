import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ActionButton } from '@weddingpick/ui';

import { OptionWheelSheet } from './wheel-picker-sheet';

/* 시트는 하단 안전영역을 더해 그린다 — 재 줄 사람이 없으면 훅이 던진다. iPhone 14 값. */
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const OPTIONS = [
  { value: 'a', label: '가' },
  { value: 'b', label: '나' },
  { value: 'c', label: '다' },
] as const;

/** 1열 휠 시트 — 2026-09-26 대표 지시 「날짜 외에는 1열 휠」(내 웨딩설정). */
describe('1열 휠 시트', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  function render(value: 'a' | 'b' | 'c' | null, onConfirm = jest.fn()) {
    let tree!: ReactTestRenderer;

    act(() => {
      tree = create(
        <SafeAreaProvider initialMetrics={METRICS}>
          <OptionWheelSheet
            visible
            title="예산 선택"
            accessibilityLabel="예산"
            options={OPTIONS}
            value={value}
            onConfirm={onConfirm}
            onDismiss={jest.fn()}
          />
        </SafeAreaProvider>
      );
    });

    return tree;
  }

  function wheels(tree: ReactTestRenderer): ReactTestInstance[] {
    return tree.root.findAll(
      (node) => typeof node.type === 'string' && typeof node.props.onScroll === 'function' && node.props.snapToInterval === 48
    );
  }

  function confirm(tree: ReactTestRenderer) {
    const button = tree.root.findAllByType(ActionButton).find((node) => node.props.label === '확인')!;

    act(() => button.props.onPress());
  }

  it('열이 하나이고 보기 글자를 그린다', () => {
    const tree = render('b');
    const json = JSON.stringify(tree.toJSON());

    expect(wheels(tree)).toHaveLength(1);
    expect(json).toContain('"가"');
    expect(json).toContain('"다"');
  });

  it('지금 값에서 시작하고, 굴린 칸을 「확인」에 넘긴다', () => {
    const onConfirm = jest.fn();
    const tree = render('b', onConfirm);

    confirm(tree);
    expect(onConfirm).toHaveBeenLastCalledWith('b');

    act(() => {
      wheels(tree)[0]!.props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: 2 * 48 } } });
    });
    confirm(tree);
    expect(onConfirm).toHaveBeenLastCalledWith('c');
  });

  it('값이 없으면 첫 보기에서 시작한다', () => {
    const onConfirm = jest.fn();
    const tree = render(null, onConfirm);

    confirm(tree);
    expect(onConfirm).toHaveBeenLastCalledWith('a');
  });
});
