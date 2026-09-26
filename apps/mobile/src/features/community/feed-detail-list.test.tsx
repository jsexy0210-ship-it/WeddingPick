import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ActionButton } from '@weddingpick/ui';

import WeddingFeedDetailScreen from '@/app/(tabs)/(home)/feed/[id]';
import { dismissToOrReplace } from '@/features/navigation/depth-back';

import { feedDetailHref, feedListHref } from './feed-href';

/**
 * 웨딩피드 글 상세 — 2026-09-26 대표 지시.
 * 「스크랩 저장 · 해제」 단추를 지우고, 하단 「돌아가기」를 「목록」(웨딩정보 목록 · 진입 출처 유지)으로.
 */

const mockParams: { id: string; from?: string } = { id: 'post-1' };

jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@/components/back-bar', () => ({ BackBar: 'BackBar' }));
jest.mock('@/features/refresh/use-pull-refresh', () => ({
  usePullRefresh: () => ({ refreshing: false, onRefresh: jest.fn(), refreshControl: undefined }),
  notifyRefreshFailed: jest.fn(),
}));
jest.mock('@/features/home/category-image', () => ({ CategoryImage: 'CategoryImage' }));
jest.mock('@/features/loading/delayed-loader', () => ({ DelayedLoadingView: 'Loading' }));
jest.mock('@/features/navigation/depth-back', () => ({ useDepthBack: () => jest.fn(), dismissToOrReplace: jest.fn() }));
jest.mock('@/features/home/content', () => ({
  getWeddingFeedDetail: async (id: string) => ({
    id,
    title: '웨딩홀 투어에서 꼭 물어볼 것',
    categoryLabel: '웨딩홀',
    summary: '요약',
    body: '본문',
    imageUri: null,
    bodyImageUri: null,
    publishedAt: null,
  }),
}));

let tree: ReactTestRenderer;

async function mount() {
  await act(async () => {
    tree = create(<WeddingFeedDetailScreen />);
  });
}

afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  jest.mocked(dismissToOrReplace).mockClear();
});

describe('웨딩피드 글 상세 하단', () => {
  it('스크랩 단추가 없다 — 하단 단추는 「목록」 하나뿐이다', async () => {
    mockParams.from = undefined;
    await mount();

    const labels = tree.root.findAllByType(ActionButton).map((button) => button.props.label);
    expect(labels).toEqual(['목록']);
    expect(JSON.stringify(tree.toJSON())).not.toContain('스크랩');
  });

  it('「목록」은 웨딩정보 목록으로 접는다 — 진입 출처(from)를 그대로 싣는다', async () => {
    mockParams.from = 'my';
    await mount();

    act(() => tree.root.findAllByType(ActionButton)[0]!.props.onPress());
    expect(dismissToOrReplace).toHaveBeenCalledWith('/community/feed?from=my');
  });

  it('출처 없이 들어오면 출처 없는 목록으로 간다', async () => {
    mockParams.from = undefined;
    await mount();

    act(() => tree.root.findAllByType(ActionButton)[0]!.props.onPress());
    expect(dismissToOrReplace).toHaveBeenCalledWith('/community/feed');
  });

  it('목록 → 상세 주소도 출처를 싣는다', () => {
    expect(feedDetailHref('post/a?b', 'my')).toBe('/community/feed/post%2Fa%3Fb?from=my');
    expect(feedDetailHref('post-1')).toBe('/community/feed/post-1');
    expect(feedListHref('my')).toBe('/community/feed?from=my');
  });
});
