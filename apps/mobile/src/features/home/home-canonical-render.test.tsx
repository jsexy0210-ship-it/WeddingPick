import type { CategoryRecommendation, VendorSummary } from '@weddingpick/api-contract';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { PendingPreparation } from './home-summary';
import { HomeRecommendations } from './pick-recommend';
import type { CategoryStatus } from './state';

jest.mock('./category-image', () => ({ CategoryImage: () => null }));

declare const require: (id: string) => unknown;
declare const __dirname: string;
const { readFileSync } = require('node:fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { join } = require('node:path') as { join: (...parts: string[]) => string };

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

const status = (
  category: CategoryStatus['category'],
  label: string,
  state: CategoryStatus['state'],
  pickCount = 0
): CategoryStatus => ({ category, label, state, pickCount, decidedName: null });

describe('WP-HOME-001 figma-export 구조', () => {
  const views: ReactTestRenderer[] = [];
  afterEach(() => act(() => views.splice(0).forEach((view) => view.unmount())));

  it('홈은 코랄 Hero 다음 남은 준비·가로 추천·예산·웨딩 준비 팁 순서다', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
    const order = [
      source.indexOf('<Hero'),
      source.indexOf('<PendingPreparation'),
      source.indexOf('<HomeRecommendations'),
      source.indexOf('<HomeBudget'),
      source.indexOf('웨딩 준비 팁</ThemedText>'),
    ];

    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(source).not.toContain('homeView({');
    expect(source).not.toContain('<Board');
    expect(source).not.toContain('<Recommendation');
    expect(source).toContain('accessibilityLabel="검색"');
    expect(source).toContain("router.push('/search')");
  });

  it('남은 준비 2×2는 완료 항목을 빼고 다음 네 업종을 자동 승격한다', () => {
    let view!: ReactTestRenderer;
    act(() => {
      view = create(
        <PendingPreparation
          statuses={[
            status('hall', '웨딩홀', 'decided'),
            status('studio', '스튜디오', 'picking', 2),
            status('dress', '드레스', 'before'),
            status('makeup', '메이크업', 'before'),
            status('hair', '헤어변형', 'before'),
            status('snap', '본식스냅', 'before'),
          ]}
          onOpen={jest.fn()}
          onMore={jest.fn()}
          onComplete={jest.fn()}
        />
      );
    });
    views.push(view);

    expect(view.root.findAllByProps({ accessibilityLabel: '웨딩홀' })).toHaveLength(0);
    for (const label of ['스튜디오', '드레스', '메이크업', '헤어변형']) {
      expect(view.root.findAllByProps({ accessibilityLabel: label }).length).toBeGreaterThan(0);
    }
    expect(view.root.findAllByProps({ accessibilityLabel: '본식스냅' })).toHaveLength(0);
  });

  it('추천은 첫 미결정 업종의 카드 최대 세 곳을 가로로 보여준다', () => {
    const groups: CategoryRecommendation[] = [{
      category: 'studio',
      categoryLabel: '스튜디오',
      state: 'EXPLORING',
      pickCount: 0,
      vendors: [vendor('1'), vendor('2'), vendor('3')],
    }];
    let view!: ReactTestRenderer;
    act(() => {
      view = create(
        <HomeRecommendations
          groups={groups}
          isFavorite={() => false}
          onPressVendor={jest.fn()}
          onPressFavorite={jest.fn()}
          onPressCompare={jest.fn()}
          onPressMore={jest.fn()}
        />
      );
    });
    views.push(view);

    expect(view.root.findAllByProps({ horizontal: true }).length).toBeGreaterThan(0);
    expect(view.root.findAllByProps({ label: '3곳 비교하기' })).toHaveLength(1);
    expect(view.root.findAllByProps({ accessibilityLabel: '서울 조건 빼고 보기' })).toHaveLength(0);
  });
});
