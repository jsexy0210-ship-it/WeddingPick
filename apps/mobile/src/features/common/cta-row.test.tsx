import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ActionButton } from '@weddingpick/ui';

import { Dock } from '@/features/wedding/screen-kit';

import { CTA_PRIMARY_FLEX, CtaRow, ctaSlotFlex } from './cta-row';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** 버튼마다 바로 위에 씌워진 칸의 flex 값. 칸이 없으면 undefined다. */
function slotFlexes(tree: ReactTestRenderer): (number | undefined)[] {
  return tree.root
    .findAllByType(ActionButton)
    .map((button) => StyleSheet.flatten(button.parent?.props.style)?.flex as number | undefined);
}

describe('CTA 줄 — 단일 CTA는 폭 전체, 두 개는 정본 1 : 1.4 (2026-09-26 대표 지시)', () => {
  it('칸 비율 — 한 개 1 · 두 개 1과 1.4', () => {
    expect(ctaSlotFlex(1, 0)).toBe(1);
    expect(ctaSlotFlex(2, 0)).toBe(1);
    expect(ctaSlotFlex(2, 1)).toBe(CTA_PRIMARY_FLEX);
    expect(CTA_PRIMARY_FLEX).toBe(1.4);
  });

  it('버튼 하나를 가로 줄에 넣어도 flex 1 칸이 씌워진다 — 글자 폭으로 줄지 않는다', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <CtaRow>
          <ActionButton variant="primary" size="sheet" label="확인하기" onPress={() => undefined} />
        </CtaRow>
      );
    });

    expect(slotFlexes(tree)).toEqual([1]);
  });

  it('조건부로 빠진 버튼(null)은 칸으로 세지 않는다', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <CtaRow>
          {null}
          <ActionButton variant="primary" size="sheet" label="지출만 넣기" onPress={() => undefined} />
        </CtaRow>
      );
    });

    expect(slotFlexes(tree)).toEqual([1]);
  });

  it('공용 Dock(배우자 초대 · 초대 받음)도 같은 칸을 쓴다', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <SafeAreaProvider initialMetrics={METRICS}>
          <Dock>
            <ActionButton variant="ghost" size="sheet" label="나중에" onPress={() => undefined} />
            <ActionButton variant="primary" size="sheet" label="수락하기" onPress={() => undefined} />
          </Dock>
        </SafeAreaProvider>
      );
    });

    expect(slotFlexes(tree)).toEqual([1, 1.4]);

    act(() => {
      tree.update(
        <SafeAreaProvider initialMetrics={METRICS}>
          <Dock>
            <ActionButton variant="primary" size="sheet" label="카카오로 초대하기" onPress={() => undefined} />
          </Dock>
        </SafeAreaProvider>
      );
    });

    expect(slotFlexes(tree)).toEqual([1]);
  });
});
