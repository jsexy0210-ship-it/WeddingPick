import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { CatChipBar } from './my-kit';

declare const require: (id: string) => unknown;
declare const __dirname: string;
const { readFileSync } = require('fs') as { readFileSync: (path: string, encoding: 'utf8') => string };
const { join } = require('path') as { join: (...parts: string[]) => string };

/**
 * 라운지(리얼후기 · 웨딩정보) 카테고리 칩바 — 2026-09-26 대표 지시 「칩이 헤더에 너무 붙어 있다」.
 * 정본 my.js:180 `chipBar`는 위 0이라 칩이 헤더 선에 붙는다. 위만 정본 search.js:461 헤더 아래
 * 칩바(`padding:12px 20px`)의 12를 따른다 — 아래 14 · 칩 사이 8 · 좌우 공통 24는 그대로.
 */
describe('카테고리 칩바', () => {
  it('헤더와 칩 사이 12 · 아래 14 · 칩 사이 8 · 좌우 24', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<CatChipBar items={['전체', '웨딩홀']} selected="전체" onSelect={() => undefined} />);
    });

    const bar = StyleSheet.flatten(tree.root.findByType(ScrollView).props.contentContainerStyle);
    expect(bar).toMatchObject({ paddingTop: 12, paddingBottom: 14, gap: 8, paddingHorizontal: 24 });
    act(() => tree.unmount());
  });

  it('라운지 화면은 공용 칩바를 쓴다 — 화면마다 따로 여백을 들지 않는다', () => {
    const lounge = readFileSync(join(__dirname, '..', 'community', 'lounge-screen.tsx'), 'utf8');

    expect(lounge).toContain('<CatChipBar');
    expect(lounge).not.toMatch(/chipBar:\s*\{/);
  });
});
