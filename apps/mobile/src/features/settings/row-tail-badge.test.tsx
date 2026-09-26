import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Badge } from '@weddingpick/ui';

import { Row } from './my-kit';

/**
 * 프로필 계정 «카카오 · 연결됨» 행 — 2026-09-26 대표 지시 「연결됨 배지 위치 조정하라」.
 * 정본 my.jsx:153 `rowPlain`(my.js:254 · align-items:center · gap 12 · 좌우 20 · 최소 52)에서
 * 배지(`badgeVerify`)는 글자 칸(setCol flex:1) 뒤 행 오른쪽 끝, 세로 가운데다. 공용 배지 상자가
 * alignSelf flex-start라 행 위쪽에 붙어 있었다.
 */
describe('Row 꼬리 배지', () => {
  it('행 세로 가운데 · 글자 칸 뒤 오른쪽 끝', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<Row name="카카오" tail="연결됨" tailBadge="ok" wide />);
    });

    const badge = tree.root.findByType(Badge);
    expect(StyleSheet.flatten(badge.props.style)).toMatchObject({ alignSelf: 'center' });

    const row = tree.root.find(
      (node) => typeof node.type !== 'string' && StyleSheet.flatten(node.props.style)?.flexDirection === 'row'
    );
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({
      alignItems: 'center',
      gap: 12,
      minHeight: 52,
      paddingHorizontal: 20,
    });

    /* 배지 바로 앞 글자 칸이 flex 1 — 배지는 행 오른쪽 끝으로 밀린다. */
    const text = tree.root.find(
      (node) => typeof node.type !== 'string' && StyleSheet.flatten(node.props.style)?.flex === 1
    );
    expect(text).toBeDefined();
    act(() => tree.unmount());
  });
});
