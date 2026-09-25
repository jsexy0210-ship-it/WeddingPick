import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DatePickerSheet } from './date-picker-sheet';

/* 시트는 하단 안전영역을 더해 그린다 — 재 줄 사람이 없으면 훅이 던진다. iPhone 14 값. */
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * 예식일 시트 — OS 날짜 선택기(2026-09-25 대표 지시 「OS 데이트피커」).
 *
 * 선택기 자체는 OS가 그린다. 여기서는 **시트가 범위를 선택기에 제대로 넘기는지**와
 * **고른 날이 결과 줄 · 확인까지 이어지는지**만 본다.
 */
describe('날짜 선택 시트 — OS 날짜 선택기', () => {
  /* 2026-09-08. 고를 수 있는 첫 날은 내일(2026-09-09)이다. */
  const today = new Date(2026, 8, 8);

  beforeEach(() => {
    /* 시트가 「움직임 줄이기」를 물어본다. `resetMocks`가 jest-expo의 기본 답을 지워서 여기서 준다. */
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  function render(value: string | null, onConfirm = jest.fn()) {
    let tree!: ReactTestRenderer;

    act(() => {
      tree = create(
        <SafeAreaProvider initialMetrics={METRICS}>
          <DatePickerSheet visible value={value} today={today} onConfirm={onConfirm} onDismiss={jest.fn()} />
        </SafeAreaProvider>
      );
    });

    return tree;
  }

  /** 그 아래에 그려진 글자 전부. */
  function texts(node: ReactTestInstance): string[] {
    return node
      .findAll(() => true)
      .flatMap((child) => child.children)
      .filter((child): child is string => typeof child === 'string');
  }

  /** 필드를 눌러 OS 선택기를 연다(시험 환경은 iOS — 필드 아래에 펼쳐진다). */
  function openPicker(tree: ReactTestRenderer): ReactTestInstance {
    const field = tree.root.find(
      (node) => node.props.accessibilityLabel === '예식일' && typeof node.props.onPress === 'function'
    );

    act(() => field.props.onPress());

    return tree.root.find((node) => node.props.mode === 'date' && typeof node.props.onValueChange === 'function');
  }

  it('고른 날이 없으면 고를 수 있는 첫 날에서 시작한다 — 오늘이 아니라 내일', () => {
    expect(texts(render(null).root)).toContain('2026.09.09(수)');
  });

  it('선택기에 과거를 막는 첫 날과 5년 뒤 마지막 날을 건다', () => {
    const picker = openPicker(render('2027-05-16'));

    expect(picker.props.minimumDate).toEqual(new Date(2026, 8, 9));
    expect(picker.props.maximumDate).toEqual(new Date(2031, 11, 31));
  });

  it('선택기에서 고른 날이 결과 줄과 확인으로 이어진다', () => {
    const onConfirm = jest.fn();
    const tree = render('2027-05-16', onConfirm);
    const picker = openPicker(tree);

    act(() => picker.props.onValueChange({ type: 'set', nativeEvent: {} }, new Date(2028, 1, 29)));

    expect(texts(tree.root)).toContain('2028.02.29(화)');

    const confirm = tree.root.find(
      (node) => node.props.label === '확인' && typeof node.props.onPress === 'function'
    );
    act(() => confirm.props.onPress());

    expect(onConfirm).toHaveBeenCalledWith('2028-02-29');
  });

  it('범위 밖의 날은 받지 않는다 — 오늘은 고를 수 없다', () => {
    const tree = render('2027-05-16');
    const picker = openPicker(tree);

    act(() => picker.props.onValueChange({ type: 'set', nativeEvent: {} }, new Date(2026, 8, 8)));

    expect(texts(tree.root)).toContain('2027.05.16(일)');
  });
});
