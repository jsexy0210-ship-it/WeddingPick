import type { VendorSummary } from '@weddingpick/api-contract';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Board } from './board';
import { Recommendation } from './recommendation';

jest.mock('./category-image', () => ({ CategoryImage: () => null }));

const vendor = (id: string): VendorSummary => ({
  id,
  name: `업체 ${id}`,
  category: 'studio',
  region: '서울',
  coordinates: null,
  imageUrl: null,
  sourceNote: null,
  comparableQuoteCount: 3,
  paidPrice: { stage: 'normal', count: 3, low: 1000000, high: 1500000, caption: '실 제보 3건' },
  guidePrice: null,
  styleTags: [],
  reasons: ['고른 분위기와 잘 맞아요'],
  rating: null,
});

describe('WP-HOME-001 정본 렌더', () => {
  const views: ReactTestRenderer[] = [];
  afterEach(() => act(() => views.splice(0).forEach((view) => view.unmount())));

  it('준비 현황은 완료 여부와 무관하게 항상 네 칸을 렌더한다', () => {
    let view!: ReactTestRenderer;
    act(() => {
      view = create(<Board cells={[
        { category: 'hall', label: '웨딩홀', value: '완료', tone: 'done' },
        { category: 'studio', label: '스튜디오', value: '후보 2곳', tone: 'now' },
        { category: 'dress', label: '드레스', value: '시작 전', tone: 'none' },
        { category: 'makeup', label: '메이크업', value: '시작 전', tone: 'none' },
      ]} onPressCategory={jest.fn()} />);
    });
    views.push(view);

    const interactive = (label: string) => view.root.findAllByProps({ accessibilityLabel: label })
      .filter((node) => typeof node.props.onPress === 'function');
    expect(interactive('웨딩홀 완료')).toHaveLength(1);
    expect(interactive('스튜디오 후보 2곳')).toHaveLength(1);
    expect(interactive('드레스 시작 전')).toHaveLength(1);
    expect(interactive('메이크업 시작 전')).toHaveLength(1);
  });

  it('추천은 대표 한 곳과 보조 두 곳, 조건 칩, Pick, CTA를 함께 둔다', () => {
    const onPick = jest.fn();
    let view!: ReactTestRenderer;
    act(() => {
      view = create(<Recommendation
        categoryLabel="스튜디오"
        chips={[{ kind: 'region', label: '서울', dim: false }]}
        vendors={[vendor('1'), vendor('2'), vendor('3')]}
        cta={{ kind: 'compare', label: '3곳 비교하기', ids: ['1', '2', '3'] }}
        isPicked={(id) => id === '2'}
        onPressChip={jest.fn()}
        onPressVendor={jest.fn()}
        onPressPick={onPick}
        onPressCta={jest.fn()}
      />);
    });
    views.push(view);

    const interactive = (label: string) => view.root.findAllByProps({ accessibilityLabel: label })
      .filter((node) => typeof node.props.onPress === 'function');
    expect(interactive('서울 조건 빼고 보기')).toHaveLength(1);
    expect(interactive('업체 1 Pick')).toHaveLength(1);
    expect(interactive('업체 2 Pick 해제')).toHaveLength(1);
    expect(view.root.findAllByProps({ accessibilityRole: 'button' }).length).toBeGreaterThanOrEqual(7);
  });
});
