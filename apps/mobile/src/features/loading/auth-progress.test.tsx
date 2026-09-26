import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import {
  authProgressStartedAt,
  beginAuthProgress,
  continueAuthProgress,
  endAuthProgress,
  useAuthProgressVisible,
} from './auth-progress';

/**
 * 로그인 → 약관 동의 → 온보딩 사이의 기다림 하나(2026-09-26 대표 지시 — 「로더 써클만 돌도록
 * 통합한다」). 700ms는 흐름이 **시작된 때**부터 세고, 화면이 갈아 끼워져도(고리가 새로 마운트돼도)
 * 다시 세지 않는다 — 그래서 고리가 사라졌다 다시 서지 않는다.
 */
function Probe() {
  return <Text>{useAuthProgressVisible() ? 'circle' : 'none'}</Text>;
}

function shown(tree: ReactTestRenderer): string {
  return String(tree.root.findByType(Text).props.children);
}

describe('로그인 흐름의 기다림 하나', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    endAuthProgress();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('700ms 전에는 고리가 없고, 지나면 선다', () => {
    beginAuthProgress();
    let tree!: ReactTestRenderer;
    act(() => { tree = create(<Probe />); });
    expect(shown(tree)).toBe('none');

    act(() => { jest.advanceTimersByTime(699); });
    expect(shown(tree)).toBe('none');

    act(() => { jest.advanceTimersByTime(1); });
    expect(shown(tree)).toBe('circle');
  });

  it('화면이 바뀌어 고리가 새로 마운트돼도 700ms를 다시 세지 않는다', () => {
    beginAuthProgress();
    let first!: ReactTestRenderer;
    act(() => { first = create(<Probe />); });
    act(() => { jest.advanceTimersByTime(900); });
    expect(shown(first)).toBe('circle');
    act(() => { first.unmount(); });

    /* 다음 화면(약관 동의 · 온보딩)의 고리 — 흐름을 이어 쓴다. */
    let second!: ReactTestRenderer;
    act(() => { second = create(<Probe />); });
    expect(shown(second)).toBe('circle');
  });

  it('흐름이 없을 때 마운트하면 그때부터 센다 · 이어 쓰기는 시작을 바꾸지 않는다', () => {
    let tree!: ReactTestRenderer;
    act(() => { tree = create(<Probe />); });
    const started = authProgressStartedAt();
    expect(started).not.toBeNull();

    act(() => { jest.advanceTimersByTime(300); });
    continueAuthProgress();
    expect(authProgressStartedAt()).toBe(started);

    act(() => { jest.advanceTimersByTime(400); });
    expect(shown(tree)).toBe('circle');
  });

  it('새로 누르면(카카오 단추 · 동의 제출) 앞 흐름과 무관하게 처음부터 센다', () => {
    beginAuthProgress();
    let tree!: ReactTestRenderer;
    act(() => { tree = create(<Probe />); });
    act(() => { jest.advanceTimersByTime(1000); });
    expect(shown(tree)).toBe('circle');

    act(() => { beginAuthProgress(); });
    expect(shown(tree)).toBe('none');
    act(() => { jest.advanceTimersByTime(700); });
    expect(shown(tree)).toBe('circle');
  });
});
