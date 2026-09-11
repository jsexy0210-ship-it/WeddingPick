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
 * 휠이 `calendar.ts`의 규칙을 **실제로 지나는가.**
 *
 * 규칙 자체는 `calendar.test.ts`가 이미 지킨다(`clampDay(2027, 2, 31) === 28`).
 * 하지만 계산이 맞아도 화면이 그것을 부르지 않으면 소용이 없다 — 휠이 `setPicked`를
 * 바로 부르면 2월 31일이 그대로 남고, 두 시험 중 하나도 빨개지지 않는다.
 * 그래서 여기서는 계산을 다시 시험하지 않고 **화면이 계산을 지나는지**만 본다.
 */
describe('날짜 선택 시트 — 휠 3열 (WP-APP-023)', () => {
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

  /** 휠 한 열을 `accessibilityLabel`로 찾는다. */
  function wheel(tree: ReactTestRenderer, label: string): ReactTestInstance {
    return tree.root.find(
      (node) => node.props.accessibilityLabel === label && typeof node.props.onScroll === 'function'
    );
  }

  /** n번째 칸까지 굴린다. 한 칸은 48이다. */
  function roll(tree: ReactTestRenderer, label: string, index: number) {
    const target = wheel(tree, label);

    act(() => {
      target.props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: index * 48 } } });
    });
  }

  /** 그 아래에 그려진 글자 전부. */
  function texts(node: ReactTestInstance): string[] {
    return node
      .findAll(() => true)
      .flatMap((child) => child.children)
      .filter((child): child is string => typeof child === 'string');
  }

  /** 결과 줄에 적힌 날짜. `2027.02.28(일)` 꼴. */
  function shown(tree: ReactTestRenderer): string | undefined {
    return texts(tree.root).find((text) => /^\d{4}\.\d{2}\.\d{2}\(/.test(text));
  }

  it('월을 바꿔 없는 날짜가 되면 그 달 마지막 날로 당긴다 — 1월 31일에서 2월로', () => {
    const tree = render('2027-01-31');

    expect(shown(tree)).toBe('2027.01.31(일)');

    /* 2027년의 월 목록은 1~12월 — 2월은 두 번째 칸이다. */
    roll(tree, '월', 1);

    expect(shown(tree)).toBe('2027.02.28(일)');
  });

  it('윤년이면 29일까지 당겨진다', () => {
    const tree = render('2028-01-31');

    roll(tree, '월', 1);

    expect(shown(tree)).toBe('2028.02.29(화)');
  });

  it('고른 날이 없으면 고를 수 있는 첫 날에서 시작한다 — 오늘이 아니라 내일', () => {
    expect(shown(render(null))).toBe('2026.09.09(수)');
  });

  it('연도를 굴리면 결과가 곧바로 따라온다 — 멈추기를 기다리지 않는다(시안 B)', () => {
    const tree = render('2027-05-16');

    expect(shown(tree)).toBe('2027.05.16(일)');

    /* 연도 목록은 2026 … 2031. 2028은 세 번째 칸이다. */
    roll(tree, '연도', 2);

    expect(shown(tree)).toBe('2028.05.16(화)');
  });

  it('첫 해의 지난 달은 목록에 아예 없다 — 비활성으로 그리지 않는다', () => {
    const tree = render(null);

    expect(texts(wheel(tree, '월'))).toEqual(['9월', '10월', '11월', '12월']);
  });
});
