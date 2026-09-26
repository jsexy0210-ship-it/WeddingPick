import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import GuideScreen from '@/app/(tabs)/my/guide';

import { chevronRotation, INITIAL_EXPANDED, toggleExpanded } from './accordion';

/**
 * FAQ(WP-MY-013) — 2026-09-26 대표 지시 「카테고리 칩 삭제 · 아코디언 목록만 · 전부 닫힌
 * 채로 · 꺾쇠 닫힘 아래 / 열림 위」.
 */

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@/components/back-bar', () => ({ BackBar: 'BackBar' }));
jest.mock('@/features/refresh/use-pull-refresh', () => ({
  usePullRefresh: () => ({ refreshing: false, onRefresh: jest.fn(), refreshControl: undefined }),
  notifyRefreshFailed: jest.fn(),
}));
jest.mock('./use-faq', () => ({
  useFaq: () => ({
    loading: false,
    failed: false,
    items: [
      { key: 'a', category: 'Pick 인증', question: 'Pick 인증은 왜 하나요?', answer: '답 A' },
      { key: 'b', category: '금액', question: '금액이 제 것과 달라요', answer: '답 B' },
      { key: 'c', category: '계정', question: '탈퇴하면 어떻게 되나요?', answer: '답 C' },
    ],
  }),
}));

let tree: ReactTestRenderer;

afterEach(() => act(() => tree?.unmount()));

/** 질문 행 — 여닫기 상태와 누르기를 가진 가장 바깥 노드 하나씩(onPress로 겹침을 거른다). */
function questions() {
  const nodes = tree.root.findAll(
    (node) =>
      (node.props.accessibilityState as { expanded?: boolean } | undefined)?.expanded !== undefined &&
      typeof node.props.onPress === 'function'
  );

  return nodes.filter((node, index) => nodes.findIndex((other) => other.props.onPress === node.props.onPress) === index);
}

function expandedOf(node: { props: { accessibilityState?: unknown } }): boolean {
  return (node.props.accessibilityState as { expanded: boolean }).expanded;
}

describe('FAQ 화면', () => {
  it('카테고리 칩이 없다 — 라디오(칩)가 하나도 그려지지 않는다', () => {
    act(() => {
      tree = create(<GuideScreen />);
    });

    expect(tree.root.findAll((node) => node.props.accessibilityRole === 'radio')).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).not.toContain('"전체"');
  });

  it('처음에는 모든 질문이 닫혀 있고, 누른 것만 열린다', () => {
    act(() => {
      tree = create(<GuideScreen />);
    });

    const rows = questions();
    expect(rows).toHaveLength(3);
    expect(rows.map(expandedOf)).toEqual([false, false, false]);
    expect(JSON.stringify(tree.toJSON())).not.toContain('답 A');

    act(() => rows[1]!.props.onPress());

    expect(questions().map(expandedOf)).toEqual([false, true, false]);
    expect(JSON.stringify(tree.toJSON())).toContain('답 B');
    expect(JSON.stringify(tree.toJSON())).not.toContain('답 A');
  });

  it('꺾쇠 — 닫힘 아래(90°) · 열림 위(-90°)', () => {
    expect(chevronRotation(false)).toBe('90deg');
    expect(chevronRotation(true)).toBe('-90deg');

    act(() => {
      tree = create(<GuideScreen />);
    });
    const rotations = tree.root
      .findAll((node) => typeof node.type === 'string' && StyleSheet.flatten(node.props.style)?.transform !== undefined)
      .map((node) => (StyleSheet.flatten(node.props.style)!.transform as { rotate: string }[])[0]!.rotate);
    expect(rotations.slice(0, 3)).toEqual(['90deg', '90deg', '90deg']);
  });

  it('여닫기는 누른 질문 하나만 바꾼다', () => {
    const one = toggleExpanded(INITIAL_EXPANDED, 'a');
    const two = toggleExpanded(one, 'b');
    expect([...two]).toEqual(['a', 'b']);
    expect([...toggleExpanded(two, 'a')]).toEqual(['b']);
    expect(INITIAL_EXPANDED.size).toBe(0);
  });
});
