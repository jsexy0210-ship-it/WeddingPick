import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ActionButton } from '@weddingpick/ui';
import type { WeddingStyle } from '@weddingpick/domain';

import { StylePickSheet, toggleStyleFreely } from './style-pick-sheet';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** 내 웨딩설정 스타일 시트 — 2026-09-26 대표 지시 「개수제한 없다」(최소 1 · 넷까지). */
describe('스타일 선택 시트', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  function render(value: readonly WeddingStyle[], onConfirm = jest.fn()) {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <SafeAreaProvider initialMetrics={METRICS}>
          <StylePickSheet visible title="스타일 선택" value={value} onConfirm={onConfirm} onDismiss={jest.fn()} />
        </SafeAreaProvider>
      );
    });

    return tree;
  }

  function options(tree: ReactTestRenderer) {
    return tree.root.findAll(
      (node) => typeof node.type !== 'string' && node.props.accessibilityRole === 'checkbox' && typeof node.props.onPress === 'function'
    ).filter((node, index, all) => all.findIndex((other) => other.props.onPress === node.props.onPress) === index);
  }

  function confirmButton(tree: ReactTestRenderer) {
    return tree.root.findAllByType(ActionButton).find((node) => node.props.label === '확인')!;
  }

  it('보기 넷을 체크 상자로 그리고 지금 고른 것을 켜 둔다', () => {
    const tree = render(['ROMANTIC']);

    expect(options(tree)).toHaveLength(4);
    expect(options(tree).map((node) => node.props.accessibilityState.checked)).toEqual([false, false, true, false]);
  });

  it('넷 모두 고를 수 있다 — 세 번째에서 막지 않는다', () => {
    const onConfirm = jest.fn();
    const tree = render(['URBAN'], onConfirm);

    for (const index of [1, 2, 3]) act(() => options(tree)[index]!.props.onPress());
    expect(options(tree).map((node) => node.props.accessibilityState.checked)).toEqual([true, true, true, true]);

    act(() => confirmButton(tree).props.onPress());
    expect(onConfirm).toHaveBeenLastCalledWith(['URBAN', 'NATURAL', 'ROMANTIC', 'GLAMOROUS']);
  });

  it('하나도 안 고르면 「확인」이 잠긴다 — 최소 1개', () => {
    const tree = render(['URBAN']);

    act(() => options(tree)[0]!.props.onPress());
    expect(confirmButton(tree).props.disabled).toBe(true);
  });

  it('누르면 넣고 다시 누르면 뺀다 — 고른 순서를 지킨다', () => {
    expect(toggleStyleFreely(['ROMANTIC', 'URBAN'], 'GLAMOROUS')).toEqual(['ROMANTIC', 'URBAN', 'GLAMOROUS']);
    expect(toggleStyleFreely(['ROMANTIC', 'URBAN'], 'ROMANTIC')).toEqual(['URBAN']);
  });
});
